import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { uploadsRoot } from './uploads';

export async function saveReportExport(
  organizationId: string,
  filename: string,
  buffer: Buffer,
): Promise<string> {
  const dir = path.join(uploadsRoot(), 'reports', organizationId);
  await mkdir(dir, { recursive: true });
  const stored = `${randomUUID()}-${filename}`;
  await writeFile(path.join(dir, stored), buffer);
  return `/uploads/reports/${organizationId}/${stored}`;
}
