import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const PREFIX = 'enc:v1:';

function key(): Buffer | null {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) return null;
  const buf = Buffer.from(raw, 'base64');
  if (buf.length !== 32) return null;
  return buf;
}

export function encryptSecret(plaintext: string): string {
  const k = key();
  if (!k) return plaintext;
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', k, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${Buffer.concat([iv, tag, encrypted]).toString('base64')}`;
}

export function decryptSecret(value: string | null | undefined): string | null {
  if (!value) return null;
  if (!value.startsWith(PREFIX)) return value;
  const k = key();
  if (!k) return null;
  const buf = Buffer.from(value.slice(PREFIX.length), 'base64');
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const encrypted = buf.subarray(28);
  const decipher = createDecipheriv('aes-256-gcm', k, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}

export function isEncryptedSecret(value: string | null | undefined): boolean {
  return Boolean(value?.startsWith(PREFIX));
}

/** Decrypt a pending secret (if wrapped) and encrypt once for durable storage. */
export function promotePendingSecret(pending: string): string {
  const plaintext = decryptSecret(pending) ?? pending;
  return encryptSecret(plaintext);
}
