import type { SessionDeliveryMode } from '@prisma/client';
import { AppError } from '../errors/app-error';
import { TX_SERIALIZABLE } from '../config/constants';
import { prisma } from '../repositories/prisma';
import { toSessionDto, toSessionRegistrationDto } from '../lib/mappers';
import { sessionRepository } from '../repositories/session.repository';
import { enrollmentRepository } from '../repositories/enrollment.repository';
import { courseRepository } from '../repositories/course.repository';
import { lessonRepository } from '../repositories/lesson.repository';
import { progressService } from './progress.service';
import type { AuthPrincipal } from '../types/auth';
import { clock } from '../lib/clock';
import { isPrismaUniqueViolation } from '../errors/prisma-map';

class SessionService {
  async list(
    organizationId: string,
    courseId: string,
    query: { lessonId?: string },
    _actor: AuthPrincipal,
  ) {
    const course = await courseRepository.getById(organizationId, courseId);
    if (!course) throw AppError.from('NOT_FOUND');
    const items = await sessionRepository.list(organizationId, {
      courseId,
      lessonId: query.lessonId,
    });
    return items.map(toSessionDto);
  }

  async create(
    organizationId: string,
    courseId: string,
    actor: AuthPrincipal,
    body: {
      lessonId: string;
      title: string;
      description?: string;
      deliveryMode: SessionDeliveryMode;
      startsAt: string;
      endsAt: string;
      timezone?: string;
      location?: string | null;
      meetingUrl?: string | null;
      capacity?: number | null;
      instructorUserId?: string | null;
    },
  ) {
    if (!actor.permissions.includes('course:write')) throw AppError.from('RBAC_FORBIDDEN');
    const course = await courseRepository.getById(organizationId, courseId);
    if (!course) throw AppError.from('NOT_FOUND');
    const lesson = await lessonRepository.getById(organizationId, body.lessonId);
    if (!lesson || lesson.courseId !== courseId) throw AppError.from('NOT_FOUND');

    const row = await sessionRepository.create({
      organizationId,
      courseId,
      lessonId: body.lessonId,
      title: body.title,
      description: body.description ?? '',
      deliveryMode: body.deliveryMode,
      startsAt: new Date(body.startsAt),
      endsAt: new Date(body.endsAt),
      timezone: body.timezone ?? 'UTC',
      location: body.location ?? null,
      meetingUrl: body.meetingUrl ?? null,
      capacity: body.capacity ?? null,
      instructorUserId: body.instructorUserId ?? (actor.actorType === 'user' ? actor.sub : null),
    });
    return toSessionDto(row);
  }

  async update(
    organizationId: string,
    courseId: string,
    sessionId: string,
    actor: AuthPrincipal,
    body: Partial<{
      title: string;
      description: string;
      startsAt: string;
      endsAt: string;
      location: string | null;
      meetingUrl: string | null;
      capacity: number | null;
    }>,
  ) {
    if (!actor.permissions.includes('course:write')) throw AppError.from('RBAC_FORBIDDEN');
    const session = await sessionRepository.findById(organizationId, sessionId);
    if (!session || session.courseId !== courseId) throw AppError.from('NOT_FOUND');
    await sessionRepository.update(organizationId, sessionId, {
      ...(body.title !== undefined ? { title: body.title } : {}),
      ...(body.description !== undefined ? { description: body.description } : {}),
      ...(body.startsAt !== undefined ? { startsAt: new Date(body.startsAt) } : {}),
      ...(body.endsAt !== undefined ? { endsAt: new Date(body.endsAt) } : {}),
      ...(body.location !== undefined ? { location: body.location } : {}),
      ...(body.meetingUrl !== undefined ? { meetingUrl: body.meetingUrl } : {}),
      ...(body.capacity !== undefined ? { capacity: body.capacity } : {}),
    });
    const updated = await sessionRepository.findById(organizationId, sessionId);
    return toSessionDto(updated!);
  }

  async remove(organizationId: string, courseId: string, sessionId: string, actor: AuthPrincipal) {
    if (!actor.permissions.includes('course:write')) throw AppError.from('RBAC_FORBIDDEN');
    const session = await sessionRepository.findById(organizationId, sessionId);
    if (!session || session.courseId !== courseId) throw AppError.from('NOT_FOUND');
    await sessionRepository.delete(organizationId, sessionId);
    return { deleted: true };
  }

  async register(organizationId: string, courseId: string, sessionId: string, actor: AuthPrincipal) {
    if (actor.actorType !== 'user') throw AppError.from('RBAC_FORBIDDEN');
    const session = await sessionRepository.findById(organizationId, sessionId);
    if (!session || session.courseId !== courseId) throw AppError.from('NOT_FOUND');

    const enrollment = await enrollmentRepository.findByUserCourse(organizationId, actor.sub, courseId);
    if (!enrollment || enrollment.status === 'REVOKED') {
      throw AppError.from('RBAC_FORBIDDEN', 'Enroll in this course to register for sessions.');
    }

    const existing = await sessionRepository.findRegistration(sessionId, actor.sub);
    if (existing && existing.status !== 'CANCELLED') {
      return toSessionRegistrationDto(existing);
    }

    try {
      const row = await prisma.$transaction(async (tx) => {
        const sessions = sessionRepository.withTx(tx);
        const current = await sessions.findById(organizationId, sessionId);
        if (!current) throw AppError.from('NOT_FOUND');
        if (current.capacity) {
          const count = await sessions.countRegistrations(sessionId, 'REGISTERED');
          if (count >= current.capacity) throw AppError.from('VALIDATION_ERROR', 'Session is full.');
        }
        return sessions.createRegistration({
          organizationId,
          sessionId,
          userId: actor.sub,
          enrollmentId: enrollment.id,
          status: 'REGISTERED',
        });
      }, TX_SERIALIZABLE);
      return toSessionRegistrationDto(row);
    } catch (err) {
      if (isPrismaUniqueViolation(err, 'sessionId') || isPrismaUniqueViolation(err, 'session_id')) {
        const again = await sessionRepository.findRegistration(sessionId, actor.sub);
        if (again && again.status !== 'CANCELLED') return toSessionRegistrationDto(again);
      }
      throw err;
    }
  }

  async markAttendance(
    organizationId: string,
    courseId: string,
    sessionId: string,
    actor: AuthPrincipal,
    body: { userIds: string[]; status: 'ATTENDED' | 'NO_SHOW' },
  ) {
    if (!actor.permissions.includes('course:write')) throw AppError.from('RBAC_FORBIDDEN');
    const session = await sessionRepository.findById(organizationId, sessionId);
    if (!session || session.courseId !== courseId) throw AppError.from('NOT_FOUND');

    const now = clock.now();
    for (const userId of body.userIds) {
      const reg = await sessionRepository.findRegistration(sessionId, userId);
      if (!reg) continue;
      await sessionRepository.updateRegistration(organizationId, reg.id, {
        status: body.status,
        ...(body.status === 'ATTENDED' ? { attendedAt: now } : {}),
      });
      if (body.status === 'ATTENDED') {
        const enrollment = await enrollmentRepository.findByUserCourse(organizationId, userId, courseId);
        if (enrollment && enrollment.status !== 'REVOKED') {
          await progressService.completeLessonByEnrollment(organizationId, enrollment.id, session.lessonId);
        }
      }
    }

    const updated = await sessionRepository.findById(organizationId, sessionId);
    return toSessionDto(updated!);
  }

  async getRegistrations(organizationId: string, courseId: string, sessionId: string, actor: AuthPrincipal) {
    if (!actor.permissions.includes('course:write')) throw AppError.from('RBAC_FORBIDDEN');
    const session = await sessionRepository.findById(organizationId, sessionId);
    if (!session || session.courseId !== courseId) throw AppError.from('NOT_FOUND');
    const rows = await sessionRepository.listRegistrations(organizationId, sessionId);
    return rows.map(toSessionRegistrationDto);
  }
}

export const sessionService = new SessionService();
