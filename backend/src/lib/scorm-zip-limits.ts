import { AppError } from '../errors/app-error';

export const SCORM_MAX_BYTES = 100 * 1024 * 1024;
export const SCORM_MAX_ENTRIES = 10_000;
export const SCORM_MAX_UNCOMPRESSED = 500 * 1024 * 1024;
export const SCORM_MAX_RATIO = 15;
export const SCORM_MAX_ENTRY_BYTES = 50 * 1024 * 1024;

export function assertScormZipLimits(
  bufferLength: number,
  entryCount: number,
  entrySizes: number[],
): void {
  if (entryCount > SCORM_MAX_ENTRIES) {
    throw AppError.from('VALIDATION_ERROR', 'SCORM package has too many files.');
  }
  let uncompressed = 0;
  for (const size of entrySizes) {
    uncompressed += size;
    if (size > SCORM_MAX_ENTRY_BYTES) {
      throw AppError.from('PAYLOAD_TOO_LARGE', 'A SCORM file exceeds the 50 MB entry limit.');
    }
  }
  if (uncompressed > SCORM_MAX_UNCOMPRESSED) {
    throw AppError.from('PAYLOAD_TOO_LARGE', 'SCORM package uncompressed size exceeds 500 MB.');
  }
  if (bufferLength > 0 && uncompressed / bufferLength > SCORM_MAX_RATIO) {
    throw AppError.from('VALIDATION_ERROR', 'SCORM package compression ratio is not allowed.');
  }
}
