import bcrypt from 'bcryptjs';
import { env } from '../config/env';
import { DUMMY_PASSWORD_HASH } from '../config/constants';

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, env.BCRYPT_ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export async function dummyPasswordCompare(plain: string): Promise<void> {
  await bcrypt.compare(plain, DUMMY_PASSWORD_HASH);
}
