import bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'crypto';
import { env } from '../config/env';

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, env.BCRYPT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function generateRefreshToken(): string {
  return randomBytes(48).toString('base64url');
}

export function validatePasswordPolicy(password: string, email: string): string | null {
  if (password.length < 12) return 'Password must be at least 12 characters';
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    return 'Password must contain letters and numbers';
  }
  const localPart = email.split('@')[0]?.toLowerCase();
  if (localPart && password.toLowerCase().includes(localPart)) {
    return 'Password must not contain your email';
  }
  return null;
}

export async function dummyHashCompare(): Promise<void> {
  await bcrypt.compare('dummy', '$2a$12$dummyhashdummyhashdummyhashdummyha');
}
