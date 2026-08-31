import type { ReportScheduleFrequency } from '@prisma/client';
import { startOfUtcDay } from './date';

export function computeNextRun(frequency: ReportScheduleFrequency, after: Date): Date {
  const base = startOfUtcDay(after);
  if (frequency === 'DAILY') {
    const next = new Date(base);
    next.setUTCDate(next.getUTCDate() + 1);
    return next;
  }
  if (frequency === 'WEEKLY') {
    const next = new Date(base);
    const day = next.getUTCDay();
    const daysUntilMonday = day === 0 ? 1 : 8 - day;
    next.setUTCDate(next.getUTCDate() + daysUntilMonday);
    return next;
  }
  return new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 1));
}

export function initialNextRun(): Date {
  return startOfUtcDay(new Date());
}
