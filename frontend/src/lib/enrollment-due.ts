export interface EnrollmentDueFields {
  dueAt?: string | null;
  isOverdue?: boolean;
  isDueSoon?: boolean;
}

export function formatDueDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function enrollmentDueLabel(enrollment: EnrollmentDueFields): string | null {
  if (!enrollment.dueAt) return null;
  const formatted = formatDueDate(enrollment.dueAt);
  if (enrollment.isOverdue) return `Overdue · due ${formatted}`;
  if (enrollment.isDueSoon) return `Due ${formatted}`;
  return `Due ${formatted}`;
}

export function hasDueDateAlert(enrollment: EnrollmentDueFields) {
  return Boolean(enrollment.dueAt && (enrollment.isOverdue || enrollment.isDueSoon));
}
