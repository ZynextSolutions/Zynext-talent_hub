export const ENROLLMENT_STATUSES = ['ENROLLED', 'IN_PROGRESS', 'COMPLETED', 'REVOKED'] as const;
export type EnrollmentStatusName = (typeof ENROLLMENT_STATUSES)[number];

export const ENROLLMENT_SOURCES = ['ASSIGNMENT', 'MANUAL', 'MOVE_RECONCILE', 'RECERTIFY', 'PATH'] as const;
export type EnrollmentSourceName = (typeof ENROLLMENT_SOURCES)[number];
