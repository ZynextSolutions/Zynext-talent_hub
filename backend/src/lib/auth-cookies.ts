import type { CookieOptions, Request, Response } from 'express';
import { env } from '../config/env';
import { AppError } from '../errors/app-error';
import { parseCookieHeader } from './cookies';

export const REFRESH_COOKIE = 'cor_refresh';
export const AUTH_FLAG_COOKIE = 'cor_logged_in';
export const MEDIA_COOKIE = 'media_session';

/** Terminal refresh failures — clear httpOnly cookies so the client cannot keep a dead session. */
const REFRESH_COOKIE_CLEAR_CODES = new Set([
  'AUTH_MISSING_TOKEN',
  'AUTH_REFRESH_INVALID',
  'AUTH_REFRESH_EXPIRED',
  'AUTH_REFRESH_REUSE',
  'AUTH_ACCOUNT_SUSPENDED',
  'AUTH_ORG_SUSPENDED',
  'AUTH_PRINCIPAL_INVALID',
  'AUTH_TOKEN_INVALID',
  'AUTH_TOKEN_EXPIRED',
]);

function baseCookie(path: string, httpOnly: boolean, maxAgeMs: number): CookieOptions {
  return {
    httpOnly,
    secure: env.isProd,
    sameSite: 'lax',
    path,
    maxAge: maxAgeMs,
  };
}

function clearCookieOptions(path: string): CookieOptions {
  return {
    path,
    secure: env.isProd,
    sameSite: 'lax',
  };
}

export function setAuthCookies(
  res: Response,
  tokens: { accessToken: string; refreshToken: string; expiresIn: number },
): void {
  const refreshMs = env.JWT_REFRESH_TTL_SEC * 1000;
  const accessMs = env.JWT_ACCESS_TTL_SEC * 1000;
  res.cookie(REFRESH_COOKIE, tokens.refreshToken, baseCookie('/api/v1/auth', true, refreshMs));
  res.cookie(AUTH_FLAG_COOKIE, '1', baseCookie('/', false, refreshMs));
  res.cookie(MEDIA_COOKIE, tokens.accessToken, baseCookie('/api/v1/media', true, accessMs));
}

export function clearAuthCookies(res: Response): void {
  res.clearCookie(REFRESH_COOKIE, clearCookieOptions('/api/v1/auth'));
  res.clearCookie(AUTH_FLAG_COOKIE, clearCookieOptions('/'));
  res.clearCookie(MEDIA_COOKIE, clearCookieOptions('/api/v1/media'));
}

export function shouldClearAuthCookiesOnRefreshError(err: unknown): boolean {
  if (!(err instanceof AppError)) return false;
  return REFRESH_COOKIE_CLEAR_CODES.has(String(err.code));
}

export function refreshTokenFromRequest(req: Request, bodyToken?: string): string | undefined {
  if (bodyToken?.trim()) return bodyToken.trim();
  const cookies = parseCookieHeader(req.header('cookie'));
  return cookies[REFRESH_COOKIE] || undefined;
}

export function mediaTokenFromRequest(req: Request): string | undefined {
  const cookies = parseCookieHeader(req.header('cookie'));
  return cookies[MEDIA_COOKIE] || undefined;
}
