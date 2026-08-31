import { Prisma } from '@prisma/client';
import { TX_SERIALIZABLE } from '../config/constants';
import { AppError } from '../errors/app-error';
import { isPrismaWriteConflict } from '../errors/prisma-map';
import { treeEtag } from '../lib/crypto';
import { parseSettings } from '../lib/mappers';
import { prisma } from '../repositories/prisma';
import { organizationRepository } from '../repositories/organization.repository';
import { departmentRepository } from '../repositories/department.repository';
import { teamRepository } from '../repositories/team.repository';
import { userRepository } from '../repositories/user.repository';
import { divisionRepository } from '../repositories/division.repository';
import type { MoveableNodeType, MoveParentType } from '../domain/node-types';
import { enrollmentService } from './enrollment.service';
import { auditService } from './audit.service';

interface MoveInput {
  organizationId: string;
  nodeType: MoveableNodeType;
  nodeId: string;
  targetParentType: MoveParentType;
  targetParentId?: string | null;
  ifMatch?: string;
  actorId: string;
}

function allowedEdge(nodeType: MoveableNodeType, parentType: MoveParentType): boolean {
  if (nodeType === 'DEPARTMENT') return parentType === 'DIVISION' || parentType === 'ORGANIZATION';
  if (nodeType === 'TEAM') return parentType === 'DEPARTMENT';
  if (nodeType === 'USER') return parentType === 'TEAM';
  return false;
}

class OrgMoveService {
  async moveNode(input: MoveInput) {
    const run = () => this.execute(input);
    try {
      return await run();
    } catch (err) {
      if (isPrismaWriteConflict(err)) {
        try {
          return await run();
        } catch (retry) {
          if (isPrismaWriteConflict(retry)) throw AppError.from('TX_WRITE_CONFLICT');
          throw retry;
        }
      }
      throw err;
    }
  }

  private async execute(input: MoveInput) {
    return prisma.$transaction(
      async (tx) => {
        const org = await organizationRepository.withTx(tx).findById(input.organizationId);
        if (!org) throw AppError.from('ORGANIZATION_NOT_FOUND');
        const settings = parseSettings(org.settings);

        const depts = departmentRepository.withTx(tx);
        const teams = teamRepository.withTx(tx);
        const users = userRepository.withTx(tx);
        const divisions = divisionRepository.withTx(tx);

        if (!allowedEdge(input.nodeType, input.targetParentType)) {
          throw AppError.from('ORG_MOVE_INVALID_PARENT');
        }

        if (input.ifMatch) {
          const etag = await this.computeEtag(input.organizationId, tx);
          if (etag !== input.ifMatch) throw AppError.from('ORG_TREE_STALE');
        }

        let previousParent: { type: MoveParentType; id: string | null };
        let affectedUserIds: string[] = [];
        let unchanged = false;

        if (input.nodeType === 'DEPARTMENT') {
          const locked = await depts.lockForUpdate(input.organizationId, input.nodeId);
          if (locked.length === 0) throw AppError.from('ORG_MOVE_NODE_NOT_FOUND');
          const node = await depts.getById(input.organizationId, input.nodeId);
          if (!node) throw AppError.from('ORG_MOVE_NODE_NOT_FOUND');
          previousParent = { type: node.divisionId ? 'DIVISION' : 'ORGANIZATION', id: node.divisionId };

          if (input.targetParentType === 'ORGANIZATION') {
            if (!settings.allowDivisionlessDepts) throw AppError.from('ORG_MOVE_DIVISION_REQUIRED');
            if (node.divisionId === null) unchanged = true;
            else {
              await depts.setDivision(input.organizationId, node.id, null);
              await users.updateHierarchy(input.organizationId, { departmentId: node.id }, { divisionId: null });
            }
          } else {
            if (!input.targetParentId) throw AppError.from('ORG_MOVE_INVALID_PARENT');
            const parentLock = await divisions.lockForUpdate(input.organizationId, input.targetParentId);
            if (parentLock.length === 0) throw AppError.from('ORG_MOVE_TARGET_NOT_FOUND');
            const parent = await divisions.getById(input.organizationId, input.targetParentId);
            if (!parent) throw AppError.from('ORG_MOVE_TARGET_NOT_FOUND');
            if (parent.organizationId !== input.organizationId) throw AppError.from('ORG_MOVE_CROSS_TENANT');
            if (node.divisionId === parent.id) unchanged = true;
            else {
              await depts.setDivision(input.organizationId, node.id, parent.id);
              await users.updateHierarchy(
                input.organizationId,
                { departmentId: node.id },
                { divisionId: parent.id },
              );
            }
          }
          const affected = await users.listIdsUnder(input.organizationId, { departmentId: node.id });
          affectedUserIds = affected.map((u) => u.id);
        } else if (input.nodeType === 'TEAM') {
          if (!input.targetParentId) throw AppError.from('ORG_MOVE_INVALID_PARENT');
          const locked = await teams.lockForUpdate(input.organizationId, input.nodeId);
          if (locked.length === 0) throw AppError.from('ORG_MOVE_NODE_NOT_FOUND');
          const node = await teams.getById(input.organizationId, input.nodeId);
          if (!node) throw AppError.from('ORG_MOVE_NODE_NOT_FOUND');
          previousParent = { type: 'DEPARTMENT', id: node.departmentId };
          const parentLock = await depts.lockForUpdate(input.organizationId, input.targetParentId);
          if (parentLock.length === 0) throw AppError.from('ORG_MOVE_TARGET_NOT_FOUND');
          const parent = await depts.getById(input.organizationId, input.targetParentId);
          if (!parent) throw AppError.from('ORG_MOVE_TARGET_NOT_FOUND');
          if (parent.organizationId !== input.organizationId) throw AppError.from('ORG_MOVE_CROSS_TENANT');
          if (node.departmentId === parent.id) unchanged = true;
          else {
            await teams.setDepartment(input.organizationId, node.id, parent.id);
            await users.updateHierarchy(
              input.organizationId,
              { teamId: node.id },
              { departmentId: parent.id, divisionId: parent.divisionId },
            );
          }
          const affected = await users.listIdsUnder(input.organizationId, { teamId: node.id });
          affectedUserIds = affected.map((u) => u.id);
        } else {
          if (!input.targetParentId) throw AppError.from('ORG_MOVE_INVALID_PARENT');
          const locked = await users.lockForUpdate(input.organizationId, input.nodeId);
          if (locked.length === 0) throw AppError.from('ORG_MOVE_NODE_NOT_FOUND');
          const node = await users.getById(input.organizationId, input.nodeId);
          if (!node) throw AppError.from('ORG_MOVE_NODE_NOT_FOUND');
          previousParent = { type: 'TEAM', id: node.teamId };
          const parentLock = await teams.lockForUpdate(input.organizationId, input.targetParentId);
          if (parentLock.length === 0) throw AppError.from('ORG_MOVE_TARGET_NOT_FOUND');
          const parent = await teams.getById(input.organizationId, input.targetParentId);
          if (!parent) throw AppError.from('ORG_MOVE_TARGET_NOT_FOUND');
          if (parent.organizationId !== input.organizationId) throw AppError.from('ORG_MOVE_CROSS_TENANT');
          if (node.teamId === parent.id) unchanged = true;
          else {
            await users.update(input.organizationId, node.id, {
              teamId: parent.id,
              departmentId: parent.departmentId,
              divisionId: parent.department.divisionId,
            });
          }
          affectedUserIds = [node.id];
        }

        if (unchanged) {
          return {
            nodeType: input.nodeType,
            nodeId: input.nodeId,
            previousParent,
            parent: {
              type: input.targetParentType,
              id: input.targetParentId ?? input.organizationId,
            },
            affectedUserIds,
            enrollmentsAdded: 0,
            enrollmentsRetained: 0,
            unchanged: true,
            treeEtag: await this.computeEtag(input.organizationId, tx),
          };
        }

        const recon = await enrollmentService.reconcileAfterHierarchyChange({
          organizationId: input.organizationId,
          affectedUserIds,
          tx,
        });
        await organizationRepository.withTx(tx).touch(input.organizationId);
        await auditService.record({
          organizationId: input.organizationId,
          actorType: 'user',
          actorId: input.actorId,
          action: 'ORG_MOVE',
          resourceType: input.nodeType,
          resourceId: input.nodeId,
          metadata: {
            targetParentType: input.targetParentType,
            targetParentId: input.targetParentId ?? null,
          },
        });

        return {
          nodeType: input.nodeType,
          nodeId: input.nodeId,
          previousParent,
          parent: {
            type: input.targetParentType,
            id: input.targetParentId ?? input.organizationId,
          },
          affectedUserIds,
          enrollmentsAdded: recon.enrollmentsAdded,
          enrollmentsRetained: recon.enrollmentsRetained,
          unchanged: false,
          treeEtag: await this.computeEtag(input.organizationId, tx),
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 5000, maxWait: 2000 },
    );
  }

  private async computeEtag(organizationId: string, tx: Prisma.TransactionClient): Promise<string> {
    const org = await tx.organization.findFirst({ where: { id: organizationId } });
    const [d, dept, t, u] = await Promise.all([
      tx.division.findFirst({
        where: { organizationId, deletedAt: null },
        orderBy: { updatedAt: 'desc' },
        select: { updatedAt: true },
      }),
      tx.department.findFirst({
        where: { organizationId, deletedAt: null },
        orderBy: { updatedAt: 'desc' },
        select: { updatedAt: true },
      }),
      tx.team.findFirst({
        where: { organizationId, deletedAt: null },
        orderBy: { updatedAt: 'desc' },
        select: { updatedAt: true },
      }),
      tx.user.findFirst({
        where: { organizationId, deletedAt: null },
        orderBy: { updatedAt: 'desc' },
        select: { updatedAt: true },
      }),
    ]);
    return treeEtag(
      [org?.updatedAt, d?.updatedAt, dept?.updatedAt, t?.updatedAt, u?.updatedAt].filter(
        (x): x is Date => Boolean(x),
      ),
    );
  }
}

export const orgMoveService = new OrgMoveService();
