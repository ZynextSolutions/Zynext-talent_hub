import path from 'node:path';
import { AppError } from '../errors/app-error';
import { enrollmentRepository } from '../repositories/enrollment.repository';
import { courseRepository } from '../repositories/course.repository';
import type { AuthPrincipal } from '../types/auth';
import { isCatalogThumbnailFilename } from './media-filenames';

const UPLOAD_PREFIX = /^\/uploads\/([a-z]+)\/([^/]+)(?:\/([^/]+))?(?:\/(.+))?$/;

function courseIdFromUploadFilename(filename: string): string {
  const withoutExt = filename.replace(/\.[^.]+$/, '');
  return withoutExt.endsWith('-intro') ? withoutExt.slice(0, -'-intro'.length) : withoutExt;
}

export function parseUploadPath(relativePath: string): {
  kind: string;
  organizationId: string;
  segment2: string;
  segment3?: string;
} | null {
  const normalized = relativePath.startsWith('/') ? relativePath : `/${relativePath}`;
  if (normalized.includes('..')) return null;
  const match = UPLOAD_PREFIX.exec(normalized);
  if (!match) return null;
  return {
    kind: match[1]!,
    organizationId: match[2]!,
    segment2: match[3] ?? '',
    segment3: match[4],
  };
}

export async function assertMediaAccess(
  auth: AuthPrincipal,
  relativePath: string,
): Promise<void> {
  const parsed = parseUploadPath(relativePath);
  if (!parsed) throw AppError.from('NOT_FOUND');

  if (auth.actorType === 'platform') return;

  if (!auth.organizationId || auth.organizationId !== parsed.organizationId) {
    throw AppError.from('RBAC_FORBIDDEN');
  }

  if (parsed.kind === 'avatars') {
    return;
  }

  if (parsed.kind === 'courses') {
    const courseId = courseIdFromUploadFilename(parsed.segment2);
    const course = await courseRepository.getById(auth.organizationId, courseId);
    if (!course) throw AppError.from('NOT_FOUND');
    if (auth.permissions.includes('course:write')) {
      if (auth.role === 'INSTRUCTOR' && course.createdByUserId !== auth.sub) {
        throw AppError.from('RBAC_FORBIDDEN');
      }
      return;
    }
    const enrollment = await enrollmentRepository.findByUserCourse(
      auth.organizationId,
      auth.sub,
      courseId,
    );
    const enrolled = Boolean(enrollment && enrollment.status !== 'REVOKED');
    if (enrolled) return;
    if (course.status === 'PUBLISHED' && isCatalogThumbnailFilename(parsed.segment2)) {
      return;
    }
    throw AppError.from('RBAC_FORBIDDEN');
  }

  if (parsed.kind === 'lessons') {
    const courseId = parsed.segment2;
    if (auth.permissions.includes('course:write')) {
      const course = await courseRepository.getById(auth.organizationId, courseId);
      if (!course) throw AppError.from('NOT_FOUND');
      if (auth.role === 'INSTRUCTOR' && course.createdByUserId !== auth.sub) {
        throw AppError.from('RBAC_FORBIDDEN');
      }
      return;
    }
    const enrollment = await enrollmentRepository.findByUserCourse(
      auth.organizationId,
      auth.sub,
      courseId,
    );
    if (!enrollment || enrollment.status === 'REVOKED') {
      throw AppError.from('RBAC_FORBIDDEN');
    }
    return;
  }

  if (parsed.kind === 'scorm') {
    const courseId = parsed.segment2;
    const course = await courseRepository.getById(auth.organizationId, courseId);
    if (!course) throw AppError.from('NOT_FOUND');
    if (auth.permissions.includes('course:write')) {
      if (auth.role === 'INSTRUCTOR' && course.createdByUserId !== auth.sub) {
        throw AppError.from('RBAC_FORBIDDEN');
      }
      return;
    }
    const enrollment = await enrollmentRepository.findByUserCourse(
      auth.organizationId,
      auth.sub,
      courseId,
    );
    if (!enrollment || enrollment.status === 'REVOKED') {
      throw AppError.from('RBAC_FORBIDDEN');
    }
    return;
  }

  if (parsed.kind === 'certificates') {
    if (auth.permissions.includes('certificate:read') || auth.permissions.includes('org:write')) {
      return;
    }
    throw AppError.from('RBAC_FORBIDDEN');
  }

  throw AppError.from('NOT_FOUND');
}

export function resolveUploadFilePath(relativePath: string, uploadsRoot: string): string | null {
  const normalized = relativePath.startsWith('/') ? relativePath : `/${relativePath}`;
  if (!normalized.startsWith('/uploads/') || normalized.includes('..')) return null;
  const abs = path.resolve(uploadsRoot, normalized.slice('/uploads/'.length));
  if (!abs.startsWith(path.resolve(uploadsRoot))) return null;
  return abs;
}
