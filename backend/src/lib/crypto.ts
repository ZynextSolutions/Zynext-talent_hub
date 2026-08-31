import { createHash, randomBytes, randomUUID } from 'node:crypto';

const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function newId(): string {
  return randomUUID();
}

export function requestId(): string {
  return randomUUID().replace(/-/g, '').slice(0, 26);
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

export function crockford(length = 8): string {
  const buf = randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += CROCKFORD[buf[i]! % CROCKFORD.length];
  }
  return out;
}

export function certificateNumber(prefix: string, year: number): string {
  return `${prefix}-${year}-${crockford(8)}`;
}

export function treeEtag(parts: Date[]): string {
  const stamp = parts
    .map((d) => d.getTime())
    .sort((a, b) => b - a)
    .join('|');
  return `W/"${sha256(stamp).slice(0, 16)}"`;
}
