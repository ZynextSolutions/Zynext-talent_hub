import AdmZip from 'adm-zip';
import fs from 'node:fs/promises';
import path from 'node:path';
import { AppError } from '../errors/app-error';
import { parseScormManifest } from './scorm-manifest';
import { uploadsRoot } from './uploads';
import {
  SCORM_MAX_BYTES,
  assertScormZipLimits,
} from './scorm-zip-limits';

export { SCORM_MAX_BYTES, SCORM_MAX_ENTRIES, SCORM_MAX_UNCOMPRESSED, SCORM_MAX_RATIO, SCORM_MAX_ENTRY_BYTES } from './scorm-zip-limits';

function normalizeEntryName(name: string): string | null {
  const normalized = name.replace(/\\/g, '/').replace(/^\/+/, '');
  if (!normalized || normalized.includes('..') || normalized.startsWith('/')) return null;
  return normalized;
}

function findManifestPath(entries: string[]): string | null {
  const manifests = entries.filter((entry) => entry.toLowerCase().endsWith('imsmanifest.xml'));
  if (!manifests.length) return null;
  manifests.sort((a, b) => a.split('/').length - b.split('/').length);
  return manifests[0]!;
}

export function scormPackageDir(organizationId: string, courseId: string): string {
  return path.join(uploadsRoot(), 'scorm', organizationId, courseId);
}

export async function extractScormPackage(
  organizationId: string,
  courseId: string,
  buffer: Buffer,
): Promise<{ launchHref: string; title: string; version: '1.2'; packageUrl: string }> {
  if (!buffer.length) throw AppError.from('VALIDATION_ERROR', 'SCORM package is empty.');
  if (buffer.length > SCORM_MAX_BYTES) {
    throw AppError.from('PAYLOAD_TOO_LARGE', 'SCORM package must be smaller than 100 MB.');
  }

  let zip: AdmZip;
  try {
    zip = new AdmZip(buffer);
  } catch {
    throw AppError.from('VALIDATION_ERROR', 'Upload a valid SCORM ZIP package.');
  }

  const zipEntries = zip.getEntries();
  assertScormZipLimits(
    buffer.length,
    zipEntries.length,
    zipEntries.map((entry) => entry.header.size),
  );

  const entries = zipEntries
    .map((entry) => normalizeEntryName(entry.entryName))
    .filter((entry): entry is string => Boolean(entry));
  const manifestPath = findManifestPath(entries);
  if (!manifestPath) {
    throw AppError.from('VALIDATION_ERROR', 'SCORM package must include imsmanifest.xml.');
  }

  const manifestEntry = zip.getEntry(manifestPath);
  if (!manifestEntry) throw AppError.from('VALIDATION_ERROR', 'Could not read imsmanifest.xml.');
  const parsed = parseScormManifest(manifestEntry.getData().toString('utf8'));
  const manifestDir = path.posix.dirname(manifestPath);
  const launchRelative = manifestDir === '.' ? parsed.launchHref : `${manifestDir}/${parsed.launchHref}`;
  const normalizedLaunch = normalizeEntryName(launchRelative);
  if (!normalizedLaunch || !entries.includes(normalizedLaunch)) {
    throw AppError.from('VALIDATION_ERROR', 'SCORM launch file is missing from the package.');
  }

  const targetDir = scormPackageDir(organizationId, courseId);
  await fs.rm(targetDir, { recursive: true, force: true });
  await fs.mkdir(targetDir, { recursive: true });

  for (const entry of zip.getEntries()) {
    const relative = normalizeEntryName(entry.entryName);
    if (!relative || entry.isDirectory) continue;
    const abs = path.resolve(targetDir, relative);
    if (!abs.startsWith(path.resolve(targetDir))) {
      throw AppError.from('VALIDATION_ERROR', 'SCORM package contains invalid file paths.');
    }
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, entry.getData());
  }

  const packageUrl = `/uploads/scorm/${organizationId}/${courseId}/${normalizedLaunch}`;
  return {
    launchHref: normalizedLaunch,
    title: parsed.title,
    version: parsed.version,
    packageUrl,
  };
}
