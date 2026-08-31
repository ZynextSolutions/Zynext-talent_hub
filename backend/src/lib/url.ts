import { AppError } from '../errors/app-error';

const UPLOAD_PATH_RE = /^\/uploads\/[A-Za-z0-9][A-Za-z0-9._/-]{0,238}$/;

export function isUploadPath(value: string): boolean {
  return UPLOAD_PATH_RE.test(value) && !value.includes('..');
}

export function assertHttpsUrl(value: string | null | undefined): void {
  if (value === undefined || value === null || value === '') return;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw AppError.from('VALIDATION_ERROR', 'Invalid URL.');
  }
  if (url.protocol !== 'https:') {
    throw AppError.from('VALIDATION_ERROR', 'Media URLs must use https.');
  }
}

export function assertMediaUrl(value: string | null | undefined): void {
  if (value === undefined || value === null || value === '') return;
  if (isUploadPath(value)) return;
  assertHttpsUrl(value);
}
