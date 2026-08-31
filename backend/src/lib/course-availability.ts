import { AppError } from '../errors/app-error';

export type CatalogAvailability = 'open' | 'upcoming' | 'closed';

type AvailabilityCourse = {
  availableFrom: Date | null;
  availableUntil: Date | null;
};

export function getCatalogAvailability(
  course: AvailabilityCourse,
  now: Date = new Date(),
): CatalogAvailability {
  if (course.availableUntil && course.availableUntil < now) return 'closed';
  if (course.availableFrom && course.availableFrom > now) return 'upcoming';
  return 'open';
}

export function isCourseAvailableNow(course: AvailabilityCourse, now: Date = new Date()): boolean {
  return getCatalogAvailability(course, now) === 'open';
}

export function assertCourseAvailableNow(course: AvailabilityCourse, now: Date = new Date()): void {
  const status = getCatalogAvailability(course, now);
  if (status === 'upcoming') throw AppError.from('COURSE_NOT_YET_AVAILABLE');
  if (status === 'closed') throw AppError.from('COURSE_NO_LONGER_AVAILABLE');
}
