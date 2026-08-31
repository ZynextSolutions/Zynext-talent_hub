import type { Request } from 'express';
import { env } from '../config/env';
import { MEDIA_COOKIE } from './auth-cookies';
import { parseCookieHeader } from './cookies';

export function requestAccessToken(
  req: Request,
  opts?: { includeMediaCookie?: boolean },
): string | undefined {
  const header = req.header('authorization');
  if (header?.startsWith('Bearer ')) {
    const bearer = header.slice(7).trim();
    if (bearer) return bearer;
  }
  const cookies = parseCookieHeader(req.header('cookie'));
  if (opts?.includeMediaCookie && cookies[MEDIA_COOKIE]) return cookies[MEDIA_COOKIE];
  if (env.allowQueryAccessToken && typeof req.query.access_token === 'string') {
    return req.query.access_token;
  }
  return undefined;
}
