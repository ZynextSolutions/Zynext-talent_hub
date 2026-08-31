import fs from 'node:fs';
import path from 'node:path';
import { PASSWORD_MAX, PASSWORD_MIN } from '../config/constants';
import { AppError } from '../errors/app-error';
import { dummyPasswordCompare, hashPassword, verifyPassword } from '../lib/bcrypt';

const blocklistPath = path.resolve(__dirname, '../data/blocklist.txt');
let blocklist: Set<string> | null = null;

function loadBlocklist(): Set<string> {
  if (blocklist) return blocklist;
  try {
    const raw = fs.readFileSync(blocklistPath, 'utf8');
    blocklist = new Set(
      raw
        .split(/\r?\n/)
        .map((l) => l.trim().toLowerCase())
        .filter(Boolean),
    );
  } catch {
    blocklist = new Set();
  }
  return blocklist;
}

class PasswordService {
  assertPolicy(password: string, extras?: { email?: string; orgSlug?: string }): void {
    if (password.length < PASSWORD_MIN || password.length > PASSWORD_MAX) {
      throw AppError.from('PASSWORD_POLICY', 'Password must be between 12 and 128 characters.');
    }
    if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
      throw AppError.from('PASSWORD_POLICY', 'Password must include at least one letter and one number.');
    }
    const lower = password.toLowerCase();
    if ([...loadBlocklist()].some((banned) => lower.includes(banned))) {
      throw AppError.from('PASSWORD_POLICY', 'Password is too common.');
    }
    if (extras?.email) {
      const local = extras.email.split('@')[0]?.toLowerCase();
      if (local && local.length >= 3 && lower.includes(local)) {
        throw AppError.from('PASSWORD_POLICY', 'Password must not contain your email.');
      }
    }
    if (extras?.orgSlug && extras.orgSlug.length >= 3 && lower.includes(extras.orgSlug.toLowerCase())) {
      throw AppError.from('PASSWORD_POLICY', 'Password must not contain the organization slug.');
    }
  }

  hash(plain: string): Promise<string> {
    return hashPassword(plain);
  }

  verify(plain: string, hash: string): Promise<boolean> {
    return verifyPassword(plain, hash);
  }

  dummyCompare(plain: string): Promise<void> {
    return dummyPasswordCompare(plain);
  }
}

export const passwordService = new PasswordService();
