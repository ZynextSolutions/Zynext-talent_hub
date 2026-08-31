import { randomUUID } from 'node:crypto';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../config/env';
import { AppError } from '../errors/app-error';
import type { AccessJwtPayload, ActorType, RefreshJwtPayload } from '../types/auth';

export type { ActorType };
export type JwtPayload = AccessJwtPayload;

const accessSignOptions = {
  algorithm: 'HS256' as const,
  expiresIn: env.JWT_ACCESS_TTL_SEC,
  issuer: env.JWT_ISS,
  audience: env.JWT_AUD,
} as SignOptions;

const refreshSignOptions = {
  algorithm: 'HS256' as const,
  expiresIn: env.JWT_REFRESH_TTL_SEC,
  issuer: env.JWT_ISS,
  audience: env.JWT_AUD,
} as SignOptions;

export function signAccessToken(
  payload: Omit<AccessJwtPayload, 'iss' | 'aud' | 'iat' | 'exp'>,
): string {
  return jwt.sign({ ...payload }, env.JWT_ACCESS_SECRET, accessSignOptions);
}

export function signRefreshToken(
  payload: Omit<RefreshJwtPayload, 'iss' | 'aud' | 'iat' | 'exp'>,
): string {
  return jwt.sign({ ...payload }, env.JWT_REFRESH_SECRET, refreshSignOptions);
}

export function issueAccessToken(input: {
  sub: string;
  actorType: ActorType;
  organizationId: string | null;
  role: AccessJwtPayload['role'];
  familyId: string;
}): { token: string; expiresIn: number } {
  const token = signAccessToken({
    sub: input.sub,
    actorType: input.actorType,
    organizationId: input.organizationId,
    role: input.role,
    typ: 'access',
    fam: input.familyId,
    jti: randomUUID(),
  });
  return { token, expiresIn: env.JWT_ACCESS_TTL_SEC };
}

function verifyWithSecrets(
  token: string,
  secrets: string[],
  kind: 'access' | 'refresh',
): AccessJwtPayload | RefreshJwtPayload {
  let lastError: unknown;
  for (const secret of secrets) {
    try {
      return jwt.verify(token, secret, {
        algorithms: ['HS256'],
        issuer: env.JWT_ISS,
        audience: env.JWT_AUD,
      }) as AccessJwtPayload | RefreshJwtPayload;
    } catch (err) {
      lastError = err;
    }
  }
  if (lastError instanceof jwt.TokenExpiredError) {
    throw AppError.from(kind === 'access' ? 'AUTH_TOKEN_EXPIRED' : 'AUTH_REFRESH_EXPIRED');
  }
  throw AppError.from(kind === 'access' ? 'AUTH_TOKEN_INVALID' : 'AUTH_REFRESH_INVALID');
}

export function verifyAccessToken(token: string): AccessJwtPayload {
  const secrets = [env.JWT_ACCESS_SECRET];
  if (env.JWT_ACCESS_SECRET_PREVIOUS) secrets.push(env.JWT_ACCESS_SECRET_PREVIOUS);
  const payload = verifyWithSecrets(token, secrets, 'access') as AccessJwtPayload;
  if (payload.typ !== 'access') throw AppError.from('AUTH_TOKEN_INVALID');
  return payload;
}

export function verifyRefreshToken(token: string): RefreshJwtPayload {
  const payload = verifyWithSecrets(token, [env.JWT_REFRESH_SECRET], 'refresh') as RefreshJwtPayload;
  if (payload.typ !== 'refresh') throw AppError.from('AUTH_REFRESH_INVALID');
  return payload;
}
