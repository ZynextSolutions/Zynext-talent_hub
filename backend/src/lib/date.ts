export function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function daysUntilDue(dueAt: Date, now: Date): number {
  return Math.ceil((dueAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
}
