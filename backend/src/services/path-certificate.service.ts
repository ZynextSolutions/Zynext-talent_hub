import type { Prisma } from '@prisma/client';
import { CERT_NUMBER_RETRY } from '../config/constants';
import { AppError } from '../errors/app-error';
import { certificateNumber } from '../lib/crypto';
import { parseSettings, toPathCertificateDto } from '../lib/mappers';
import { clock } from '../lib/clock';
import { learningPathRepository } from '../repositories/learning-path.repository';
import { organizationRepository } from '../repositories/organization.repository';

function isCertificateNumberConflict(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: string }).code === 'P2002'
  );
}

class PathCertificateService {
  async issueIfEligible(
    organizationId: string,
    pathEnrollmentId: string,
    tx: Prisma.TransactionClient,
  ) {
    const paths = learningPathRepository.withTx(tx);
    const enrollment = await tx.pathEnrollment.findFirst({
      where: { id: pathEnrollmentId, organizationId },
      include: {
        path: { include: { courses: { orderBy: { orderIndex: 'asc' } } } },
        courseEnrolls: true,
        certificate: true,
      },
    });
    if (!enrollment || enrollment.certificate) return null;

    const required = enrollment.path.courses.filter((c) => c.required);
    const completed = enrollment.courseEnrolls.filter((e) => e.status === 'COMPLETED');
    const requiredComplete = required.every((rc) =>
      completed.some((e) => e.courseId === rc.courseId),
    );
    if (!requiredComplete) return null;

    const org = await organizationRepository.withTx(tx).findById(organizationId);
    if (!org) throw AppError.from('ORGANIZATION_NOT_FOUND');
    const settings = parseSettings(org.settings);
    const year = clock.now().getUTCFullYear();

    let created = null;
    for (let i = 0; i < CERT_NUMBER_RETRY; i += 1) {
      const number = certificateNumber(`${settings.certificatePrefix}-PATH`, year);
      try {
        created = await paths.createPathCertificate({
          organizationId,
          pathEnrollmentId: enrollment.id,
          userId: enrollment.userId,
          pathId: enrollment.pathId,
          certificateNumber: number,
          issuedAt: clock.now(),
        });
        break;
      } catch (err) {
        if (!isCertificateNumberConflict(err) || i === CERT_NUMBER_RETRY - 1) {
          throw AppError.from('CONFLICT_UNIQUE');
        }
      }
    }
    if (!created) return null;

    await paths.updateEnrollment(enrollment.id, {
      status: 'COMPLETED',
      progressPct: 100,
      completedAt: clock.now(),
    });

    return toPathCertificateDto(created);
  }
}

export const pathCertificateService = new PathCertificateService();
