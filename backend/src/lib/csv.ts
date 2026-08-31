export function csvEscape(value: string | number | null | undefined): string {
  const s = value == null ? '' : String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCsv(headers: string[], rows: Array<Array<string | number | null | undefined>>): string {
  const lines = [
    headers.map((h) => csvEscape(h)).join(','),
    ...rows.map((row) => row.map((cell) => csvEscape(cell)).join(',')),
  ];
  return lines.join('\n');
}
