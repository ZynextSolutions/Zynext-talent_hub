import { createHash, timingSafeEqual } from 'node:crypto';

export function timingSafeSecretEqual(
  provided: string | undefined,
  expected: string | undefined,
): boolean {
  if (!provided || !expected) return false;
  const a = createHash('sha256').update(provided).digest();
  const b = createHash('sha256').update(expected).digest();
  return timingSafeEqual(a, b) && provided.length === expected.length;
}

export function isExplicitAllJobScope(header: string | undefined): boolean {
  return (header ?? '').trim().toLowerCase() === 'all';
}
