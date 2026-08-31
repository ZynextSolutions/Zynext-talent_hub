export type ScormEnrollmentAccessMode = 'read' | 'write';

type ScormActor = {
  sub: string;
  role?: string;
  permissions: readonly string[];
};

/**
 * Owner may always access. Employees cannot read another learner's CMI.
 * Managers/admins/instructors with enrollment:read or course:write may read, never write.
 */
export function canAccessScormEnrollment(
  enrollmentUserId: string,
  actor: ScormActor,
  mode: ScormEnrollmentAccessMode,
): boolean {
  if (enrollmentUserId === actor.sub) return true;
  if (mode === 'write') return false;
  if (actor.role === 'EMPLOYEE') return false;
  if (actor.permissions.includes('course:write')) return true;
  return actor.permissions.includes('enrollment:read');
}
