import { createHmac, timingSafeEqual } from 'node:crypto';
import { AppError } from '../errors/app-error';

export type ScormTicketPayload = {
  sub: string;
  organizationId: string;
  enrollmentId?: string;
  courseId?: string;
  exp: number;
};

export function signScormTicket(
  payload: Omit<ScormTicketPayload, 'exp'>,
  secret: string,
  ttlSec: number,
): string {
  const body: ScormTicketPayload = { ...payload, exp: Date.now() + ttlSec * 1000 };
  const encoded = Buffer.from(JSON.stringify(body)).toString('base64url');
  const sig = createHmac('sha256', secret).update(encoded).digest('base64url');
  return `${encoded}.${sig}`;
}

export function verifyScormTicket(
  token: string,
  secret: string,
  expect: { enrollmentId?: string; courseId?: string },
): ScormTicketPayload {
  const dot = token.lastIndexOf('.');
  if (dot <= 0) throw AppError.from('AUTH_TOKEN_INVALID');
  const encoded = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = createHmac('sha256', secret).update(encoded).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expected);
  if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) {
    throw AppError.from('AUTH_TOKEN_INVALID');
  }
  let body: ScormTicketPayload;
  try {
    body = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as ScormTicketPayload;
  } catch {
    throw AppError.from('AUTH_TOKEN_INVALID');
  }
  if (!body.sub || !body.organizationId || typeof body.exp !== 'number') {
    throw AppError.from('AUTH_TOKEN_INVALID');
  }
  if (body.exp < Date.now()) throw AppError.from('AUTH_TOKEN_EXPIRED');
  if (expect.enrollmentId && body.enrollmentId !== expect.enrollmentId) {
    throw AppError.from('RBAC_FORBIDDEN');
  }
  if (expect.courseId && body.courseId !== expect.courseId) {
    throw AppError.from('RBAC_FORBIDDEN');
  }
  return body;
}
