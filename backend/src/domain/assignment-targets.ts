export const ASSIGNMENT_TARGET_TYPES = [
  'ORGANIZATION',
  'DIVISION',
  'DEPARTMENT',
  'TEAM',
  'USER',
] as const;

export type AssignmentTargetType = (typeof ASSIGNMENT_TARGET_TYPES)[number];
