export type TrendGranularity = 'day' | 'week' | 'month';

export function pgDateTrunc(granularity: TrendGranularity): 'day' | 'week' | 'month' {
  return granularity;
}

export function formatTrendPeriod(date: Date, granularity: TrendGranularity): string {
  const iso = date.toISOString();
  if (granularity === 'month') return iso.slice(0, 7);
  return iso.slice(0, 10);
}

export function fillTrendGaps(
  rows: Array<{ period: Date; value: number }>,
  from: Date,
  to: Date,
  granularity: TrendGranularity,
): Array<{ period: string; value: number }> {
  const byKey = new Map(rows.map((r) => [formatTrendPeriod(r.period, granularity), r.value]));
  const out: Array<{ period: string; value: number }> = [];
  const cursor = new Date(from);
  cursor.setUTCHours(0, 0, 0, 0);

  while (cursor.getTime() <= to.getTime()) {
    const key = formatTrendPeriod(cursor, granularity);
    out.push({ period: key, value: byKey.get(key) ?? 0 });
    if (granularity === 'month') {
      cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    } else if (granularity === 'week') {
      cursor.setUTCDate(cursor.getUTCDate() + 7);
    } else {
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  }

  return out;
}
