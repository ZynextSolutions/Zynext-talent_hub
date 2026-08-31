import { AppError } from '../errors/app-error';
import { assessmentRepository } from '../repositories/assessment.repository';
import { courseRepository } from '../repositories/course.repository';

export async function assertPreAssessmentPassed(
  organizationId: string,
  courseId: string,
  userId: string,
) {
  const course = await courseRepository.getById(organizationId, courseId);
  if (!course?.requirePreAssessment) return;

  const pre = await assessmentRepository.findByCourseAndKind(organizationId, courseId, 'PRE');
  if (!pre) return;

  const passed = await assessmentRepository.hasPassingAttempt(pre.id, userId);
  if (!passed) {
    throw AppError.from('PRE_ASSESSMENT_REQUIRED');
  }
}

export async function hasPassedPreAssessment(
  organizationId: string,
  courseId: string,
  userId: string,
): Promise<boolean> {
  const course = await courseRepository.getById(organizationId, courseId);
  if (!course?.requirePreAssessment) return true;

  const pre = await assessmentRepository.findByCourseAndKind(organizationId, courseId, 'PRE');
  if (!pre) return true;

  return assessmentRepository.hasPassingAttempt(pre.id, userId);
}
