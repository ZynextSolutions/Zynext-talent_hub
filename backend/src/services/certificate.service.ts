import { Prisma } from '@prisma/client';
import { CERT_NUMBER_RETRY } from '../config/constants';
import { AppError } from '../errors/app-error';
import { certificateNumber } from '../lib/crypto';
import { parseSettings, toCertificateDto, toPathCertificateDto } from '../lib/mappers';
import { clock } from '../lib/clock';
import { prisma } from '../repositories/prisma';
import { certificateRepository } from '../repositories/certificate.repository';
import { enrollmentRepository } from '../repositories/enrollment.repository';
import { assessmentRepository } from '../repositories/assessment.repository';
import { organizationRepository } from '../repositories/organization.repository';
import { learningPathRepository } from '../repositories/learning-path.repository';
import { auditService } from './audit.service';
import { mailService } from './mail.service';
import { learningPathService } from './learning-path.service';
import { parsePagination, paginationMeta } from '../lib/pagination';
import type { AuthPrincipal, DataScope } from '../types/auth';

class CertificateService {
  async issueIfEligible(
    organizationId: string,
    enrollmentId: string,
    tx: Prisma.TransactionClient,
  ) {
    const enrollments = enrollmentRepository.withTx(tx);
    const certs = certificateRepository.withTx(tx);
    const assessments = assessmentRepository.withTx(tx);

    const enrollment = await enrollments.getById(organizationId, enrollmentId);
    if (!enrollment || enrollment.status === 'REVOKED') return null;
    if (Math.floor(enrollment.progressPct) !== 100) return null;

    const live = await certs.findLiveByEnrollment(organizationId, enrollmentId);
    if (live) return toCertificateDto(live);

    const revoked = await certs.findByEnrollment(enrollmentId);
    if (revoked?.revokedAt) {
      await certs.deleteByEnrollment(enrollmentId);
    }

    const assessment = await assessments.findFinalByCourse(organizationId, enrollment.courseId);
    if (assessment) {
      const passing = await assessments.hasPassingAttempt(assessment.id, enrollment.userId);
      if (!passing) return null;
    }

    const org = await organizationRepository.withTx(tx).findById(organizationId);
    if (!org) throw AppError.from('ORGANIZATION_NOT_FOUND');
    const settings = parseSettings(org.settings);
    const year = clock.now().getUTCFullYear();
    const issuedAt = clock.now();
    let expiresAt: Date | undefined;
    if (enrollment.assignmentId) {
      const assignment = await prisma.courseAssignment.findFirst({
        where: { organizationId, id: enrollment.assignmentId },
        select: { recertifyEveryDays: true },
      });
      if (assignment?.recertifyEveryDays) {
        expiresAt = new Date(issuedAt.getTime() + assignment.recertifyEveryDays * 24 * 60 * 60 * 1000);
      }
    }

    let created = null;
    for (let i = 0; i < CERT_NUMBER_RETRY; i += 1) {
      const number = certificateNumber(settings.certificatePrefix, year);
      try {
        created = await certs.create({
          organizationId,
          enrollmentId,
          userId: enrollment.userId,
          courseId: enrollment.courseId,
          certificateNumber: number,
          issuedAt,
          expiresAt: expiresAt ?? null,
        });
        break;
      } catch (err) {
        const existing = await certs.findByEnrollment(enrollmentId);
        if (existing && !existing.revokedAt) return toCertificateDto(existing);
        const uniqueOnNumber = isCertificateNumberConflict(err);
        if (!uniqueOnNumber || i === CERT_NUMBER_RETRY - 1) {
          throw AppError.from('CONFLICT_UNIQUE');
        }
      }
    }
    if (!created) return null;

    await enrollments.update(organizationId, enrollmentId, {
      status: 'COMPLETED',
      completedAt: clock.now(),
    });
    await auditService.record({
      organizationId,
      actorType: 'system',
      actorId: enrollment.userId,
      action: 'CERTIFICATE_ISSUED',
      resourceType: 'Certificate',
      resourceId: created.id,
    });
    void mailService.sendCertificateIssued(
      enrollment.user.email,
      enrollment.course.title,
      created.certificateNumber,
    );
    // Path unlock runs when enrollment becomes COMPLETED (progress/SCORM). Kept here as
    // an idempotent fallback for cert-only completion edges and pre-fix enrollments.
    await learningPathService.onCourseCompleted(organizationId, enrollmentId, tx);
    return toCertificateDto(created);
  }

  async list(
    organizationId: string,
    query: { page?: number; pageSize?: number; userId?: string; courseId?: string },
    scope?: DataScope,
    actorId?: string,
    role?: string,
  ) {
    const pg = parsePagination(query.page, query.pageSize);
    const userId = role === 'EMPLOYEE' ? actorId : query.userId;
    const fetchSize = pg.skip + pg.pageSize;
    const listParams = {
      skip: 0,
      take: fetchSize,
      userId,
      scope,
    };

    const [courseResult, pathResult] = await Promise.all([
      certificateRepository.list(organizationId, {
        ...listParams,
        courseId: query.courseId,
      }),
      query.courseId
        ? Promise.resolve({ items: [], total: 0 })
        : learningPathRepository.listPathCertificates(organizationId, listParams),
    ]);

    const merged = [
      ...courseResult.items.map(toCertificateDto),
      ...pathResult.items.map(toPathCertificateDto),
    ]
      .sort((a, b) => b.issuedAt.localeCompare(a.issuedAt))
      .slice(pg.skip, pg.skip + pg.pageSize);

    return {
      items: merged,
      pagination: paginationMeta(pg.page, pg.pageSize, courseResult.total + pathResult.total),
    };
  }

  async get(organizationId: string, id: string, actor?: AuthPrincipal, scope?: DataScope) {
    const row = await certificateRepository.getById(organizationId, id);
    if (row) {
      this.assertCertificateScope(row, actor, scope);
      return toCertificateDto(row);
    }

    const pathRow = await learningPathRepository.findPathCertificateById(organizationId, id);
    if (!pathRow) throw AppError.from('NOT_FOUND');
    this.assertCertificateScope(pathRow, actor, scope);
    return toPathCertificateDto(pathRow);
  }

  async getByNumber(certificateNumberValue: string) {
    const row = await certificateRepository.findByNumber(certificateNumberValue);
    if (row) {
      if (row.revokedAt) return { valid: false, reason: 'REVOKED' as const };
      const settings = parseSettings(row.organization.settings);
      return {
        valid: true as const,
        kind: 'course' as const,
        holderName: `${row.user.firstName} ${row.user.lastName}`.trim(),
        courseTitle: row.course.title,
        issuedAt: row.issuedAt.toISOString(),
        organizationName: row.organization.name,
        template: settings.certificateTemplate,
      };
    }

    const pathRow = await learningPathRepository.findPathCertificateByNumber(certificateNumberValue);
    if (!pathRow) return { valid: false, reason: 'NOT_FOUND' as const };
    const settings = parseSettings(pathRow.organization.settings);
    return {
      valid: true as const,
      kind: 'path' as const,
      holderName: `${pathRow.user.firstName} ${pathRow.user.lastName}`.trim(),
      courseTitle: pathRow.path.title,
      pathTitle: pathRow.path.title,
      issuedAt: pathRow.issuedAt.toISOString(),
      organizationName: pathRow.organization.name,
      template: settings.certificateTemplate,
    };
  }

  async revoke(organizationId: string, id: string, reason: string, actor: AuthPrincipal, scope?: DataScope) {
    const row = await certificateRepository.getById(organizationId, id);
    if (!row) throw AppError.from('NOT_FOUND');
    this.assertCertificateScope(row, actor, scope);
    await certificateRepository.revoke(organizationId, id, clock.now());
    await auditService.record(
      {
        organizationId,
        actorType: 'user',
        actorId: actor.sub,
        action: 'CERTIFICATE_REVOKED',
        resourceType: 'Certificate',
        resourceId: id,
        metadata: { reason },
      },
      { required: true },
    );
    const updated = await certificateRepository.getById(organizationId, id);
    return toCertificateDto(updated!);
  }

  private assertCertificateScope(
    row: { userId: string; user?: { departmentId?: string | null } },
    actor?: AuthPrincipal,
    scope?: DataScope,
  ) {
    if (!actor) return;
    if (actor.role === 'EMPLOYEE' && row.userId !== actor.sub) {
      throw AppError.from('NOT_FOUND');
    }
    if (scope?.kind === 'department' && row.user?.departmentId !== scope.departmentId) {
      throw AppError.from('NOT_FOUND');
    }
  }
}

function isCertificateNumberConflict(err: unknown): boolean {
  if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== 'P2002') {
    return false;
  }
  const target = err.meta?.target;
  const fields = Array.isArray(target) ? target.map(String) : [String(target ?? '')];
  return fields.some((f) => f.includes('certificate_number') || f.includes('certificateNumber'));
}

export const certificateService = new CertificateService();
