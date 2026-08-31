import type { AuditActorType, Prisma } from '@prisma/client';
import { auditLogRepository } from '../repositories/audit-log.repository';
import { logger } from '../lib/logger';
import { AppError } from '../errors/app-error';

class AuditService {
  async record(
    input: {
      organizationId?: string | null;
      actorType: 'user' | 'platform' | 'system';
      actorId: string;
      action: string;
      resourceType?: string;
      resourceId?: string;
      metadata?: Prisma.InputJsonValue;
      ip?: string | null;
      userAgent?: string | null;
      requestId?: string | null;
    },
    opts?: { required?: boolean },
  ): Promise<void> {
    try {
      await auditLogRepository.create({
        ...input,
        actorType: input.actorType as AuditActorType,
      });
    } catch (err) {
      logger.error({ err: String(err), action: input.action, audit_write_failed: true }, 'audit_write_failed');
      if (opts?.required) {
        throw AppError.from('INTERNAL_ERROR', 'Failed to record a required audit event.');
      }
    }
  }

  list(opts: Parameters<typeof auditLogRepository.list>[0]) {
    return auditLogRepository.list(opts);
  }
}

export const auditService = new AuditService();
