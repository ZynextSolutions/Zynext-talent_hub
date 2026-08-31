import type { Prisma } from '@prisma/client';
import {
  toCourseDto,
  toCourseModuleDto,
  toLessonDto,
} from './mappers';
import type { CourseRevisionSnapshotDto } from '../types/dto';

type CourseWithContent = Prisma.CourseGetPayload<{
  include: {
    _count: { select: { lessons: true; enrollments: true } };
    lessons: true;
    modules: { include: { lessons: true } };
  };
}>;

type AssessmentWithQuestions = Prisma.AssessmentGetPayload<{
  include: { questions: { orderBy: { orderIndex: 'asc' } } };
}>;

type PrerequisiteRow = Prisma.CoursePrerequisiteGetPayload<{
  include: { prerequisiteCourse: { select: { id: true; title: true } } };
}>;

export function buildCourseRevisionSnapshot(
  course: CourseWithContent,
  assessments: AssessmentWithQuestions[],
  prerequisites: PrerequisiteRow[],
): CourseRevisionSnapshotDto {
  const courseDto = toCourseDto(course, course._count.lessons);
  return {
    course: {
      title: courseDto.title,
      description: courseDto.description,
      thumbnailUrl: courseDto.thumbnailUrl,
      videoUrl: courseDto.videoUrl,
      scormPackageUrl: courseDto.scormPackageUrl,
      scormVersion: courseDto.scormVersion,
      durationMinutes: courseDto.durationMinutes,
      availableFrom: courseDto.availableFrom,
      availableUntil: courseDto.availableUntil,
      completionMode: courseDto.completionMode,
      completionPercent: courseDto.completionPercent,
      status: courseDto.status,
    },
    modules: (course.modules ?? []).map(toCourseModuleDto),
    lessons: course.lessons.map(toLessonDto),
    assessments: assessments.map((assessment) => ({
      id: assessment.id,
      title: assessment.title,
      kind: assessment.kind,
      passingScore: assessment.passingScore,
      maxAttempts: assessment.maxAttempts,
      timeLimitSeconds: assessment.timeLimitSeconds,
      questions: assessment.questions.map((question) => ({
        question: question.question,
        type: question.type,
        orderIndex: question.orderIndex,
      })),
    })),
    prerequisites: prerequisites.map((row) => ({
      id: row.prerequisiteCourse.id,
      title: row.prerequisiteCourse.title,
    })),
  };
}
