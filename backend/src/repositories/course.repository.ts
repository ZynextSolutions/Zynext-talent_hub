import type { CourseStatus, Prisma } from '@prisma/client';
import { prisma, type DbClient } from '../lib/prisma';
import { AppError } from '../errors/AppError';
import { assertSingle, orgWhere } from './base.repository';

const courseCount = {
  lessons: true,
  enrollments: { where: { status: { not: 'REVOKED' as const } } },
};

export class CourseRepository {
  constructor(private db: DbClient = prisma) {}

  withTx(tx: Prisma.TransactionClient) {
    return new CourseRepository(tx);
  }

  findById(organizationId: string, id: string) {
    return this.db.course.findFirst({
      where: { id, ...orgWhere(organizationId) },
      include: {
        lessons: {
          orderBy: { orderIndex: 'asc' },
          include: { moduleQuiz: { select: { id: true } } },
        },
        modules: {
          orderBy: { orderIndex: 'asc' },
          include: {
            lessons: {
              orderBy: { orderIndex: 'asc' },
              include: { moduleQuiz: { select: { id: true } } },
            },
          },
        },
        courseAssignments: true,
        _count: { select: courseCount },
      },
    });
  }

  getById(organizationId: string, id: string) {
    return this.findById(organizationId, id);
  }

  getByIdWithLessons(organizationId: string, id: string) {
    return this.findById(organizationId, id);
  }

  list(
    organizationId: string,
    params: {
      skip: number;
      take: number;
      q?: string;
      status?: CourseStatus;
      enrolledUserId?: string;
    },
  ) {
    const where: Prisma.CourseWhereInput = {
      ...orgWhere(organizationId),
      ...(params.status ? { status: params.status } : {}),
      ...(params.q
        ? {
            OR: [
              { title: { contains: params.q, mode: 'insensitive' } },
              { description: { contains: params.q, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(params.enrolledUserId
        ? { enrollments: { some: { userId: params.enrolledUserId, status: { not: 'REVOKED' } } } }
        : {}),
    };
    return Promise.all([
      this.db.course.findMany({
        where,
        skip: params.skip,
        take: params.take,
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: courseCount } },
      }),
      this.db.course.count({ where }),
    ]).then(([items, total]) => ({ items, total }));
  }

  listCatalog(
    organizationId: string,
    params: {
      skip: number;
      take: number;
      q?: string;
      availability?: 'open' | 'upcoming';
      enrolledUserId?: string;
      excludeEnrolledUserId?: string;
      prerequisitesMetCompletedIds?: string[];
      duration?: 'short' | 'medium' | 'long';
    },
  ) {
    const now = new Date();
    const and: Prisma.CourseWhereInput[] = [
      orgWhere(organizationId),
      { status: 'PUBLISHED' },
      { OR: [{ availableUntil: null }, { availableUntil: { gte: now } }] },
    ];
    const q = params.q?.trim();
    if (q) {
      and.push({
        OR: [
          { title: { contains: q, mode: 'insensitive' } },
          { description: { contains: q, mode: 'insensitive' } },
        ],
      });
    }
    if (params.availability === 'open') {
      and.push({ OR: [{ availableFrom: null }, { availableFrom: { lte: now } }] });
    } else if (params.availability === 'upcoming') {
      and.push({ availableFrom: { gt: now } });
    }
    if (params.enrolledUserId) {
      and.push({
        enrollments: {
          some: { userId: params.enrolledUserId, status: { not: 'REVOKED' } },
        },
      });
    }
    if (params.excludeEnrolledUserId) {
      and.push({
        NOT: {
          enrollments: {
            some: { userId: params.excludeEnrolledUserId, status: { not: 'REVOKED' } },
          },
        },
      });
    }
    if (params.prerequisitesMetCompletedIds !== undefined) {
      const completedIds = params.prerequisitesMetCompletedIds;
      if (completedIds.length === 0) {
        and.push({ prerequisites: { none: {} } });
      } else {
        and.push({
          NOT: {
            prerequisites: {
              some: { prerequisiteCourseId: { notIn: completedIds } },
            },
          },
        });
      }
    }
    if (params.duration === 'short') {
      and.push({ durationMinutes: { not: null, lte: 30 } });
    } else if (params.duration === 'medium') {
      and.push({ durationMinutes: { gte: 31, lte: 120 } });
    } else if (params.duration === 'long') {
      and.push({ durationMinutes: { gt: 120 } });
    }
    const where: Prisma.CourseWhereInput = { AND: and };
    return Promise.all([
      this.db.course.findMany({
        where,
        skip: params.skip,
        take: params.take,
        orderBy: { publishedAt: 'desc' },
        include: { _count: { select: courseCount } },
      }),
      this.db.course.count({ where }),
    ]).then(([items, total]) => ({ items, total }));
  }

  create(
    organizationId: string,
    data: {
      title: string;
      description?: string;
      thumbnailUrl?: string | null;
      videoUrl?: string | null;
      scormPackageUrl?: string | null;
      durationMinutes?: number | null;
      createdByUserId?: string | null;
      status?: CourseStatus;
      organizationId?: string;
    },
  ) {
    return this.db.course.create({
      data: {
        organizationId,
        title: data.title,
        description: data.description ?? '',
        thumbnailUrl: data.thumbnailUrl ?? null,
        videoUrl: data.videoUrl ?? null,
        scormPackageUrl: data.scormPackageUrl ?? null,
        durationMinutes: data.durationMinutes ?? null,
        createdByUserId: data.createdByUserId ?? null,
        status: data.status ?? 'DRAFT',
      },
      include: { _count: { select: courseCount } },
    });
  }

  async update(organizationId: string, id: string, data: Prisma.CourseUncheckedUpdateManyInput) {
    const res = await this.db.course.updateMany({
      where: { id, ...orgWhere(organizationId) },
      data,
    });
    assertSingle(res.count);
    return this.findById(organizationId, id);
  }

  async softDelete(organizationId: string, id: string) {
    const res = await this.db.course.updateMany({
      where: { id, ...orgWhere(organizationId) },
      data: { deletedAt: new Date() },
    });
    assertSingle(res.count);
    return { id };
  }

  countActiveEnrollments(organizationId: string, courseId: string) {
    return this.db.enrollment.count({
      where: {
        organizationId,
        courseId,
        status: { in: ['ENROLLED', 'IN_PROGRESS'] },
      },
    });
  }

  countBlockingEnrollments(organizationId: string, courseId: string) {
    return this.db.enrollment.count({
      where: {
        organizationId,
        courseId,
        status: { not: 'REVOKED' },
      },
    });
  }

  async requireById(organizationId: string, id: string) {
    const row = await this.findById(organizationId, id);
    if (!row) throw AppError.from('NOT_FOUND', 'Course not found.');
    return row;
  }
}

export const courseRepository = new CourseRepository();
