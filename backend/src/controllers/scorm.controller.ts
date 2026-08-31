import type { Request, Response } from 'express';
import path from 'node:path';
import { verifyAccessToken } from '../lib/jwt';
import { AppError } from '../errors/app-error';
import { asyncHandler, tenantOrgId, validated, validatedParams } from '../lib/controller';
import { scormService } from '../services/scorm.service';
import { sendOk } from '../lib/http';
import { userRepository } from '../repositories/user.repository';
import { rbacService } from '../services/rbac.service';
import { isRoleName } from '../domain/roles';
import type { AuthPrincipal } from '../types/auth';
import { requestAccessToken } from '../lib/request-access-token';
import { parseCookieHeader } from '../lib/cookies';
import { verifyScormTicket } from '../lib/scorm-ticket';
import { env } from '../config/env';

function scormTicketFromRequest(req: Request): string | undefined {
  const cookies = parseCookieHeader(req.header('cookie'));
  if (cookies.scorm_session) return cookies.scorm_session;
  if (typeof req.query.ticket === 'string' && req.query.ticket.trim()) {
    return req.query.ticket.trim();
  }
  return undefined;
}

async function principalFromUser(sub: string, organizationId: string): Promise<AuthPrincipal> {
  const user = await userRepository.findByIdAndOrg(sub, organizationId);
  if (!user || user.status !== 'ACTIVE') throw AppError.from('AUTH_PRINCIPAL_INVALID');
  const roleName = isRoleName(user.role.name) ? user.role.name : 'EMPLOYEE';
  return {
    actorType: 'user',
    sub: user.id,
    email: user.email,
    organizationId: user.organizationId,
    role: roleName,
    permissions: rbacService.getPermissions(roleName),
    tokenFamilyId: 'scorm-ticket',
    departmentId: user.departmentId,
    teamId: user.teamId,
    divisionId: user.divisionId,
  };
}

async function authFromRequest(
  req: Request,
  bound?: { enrollmentId?: string; courseId?: string },
): Promise<AuthPrincipal> {
  if (req.auth) return req.auth;

  const bearer = requestAccessToken(req);
  if (bearer) {
    const payload = verifyAccessToken(bearer);
    if (!payload.organizationId) throw AppError.from('AUTH_PRINCIPAL_INVALID');
    return principalFromUser(payload.sub, payload.organizationId);
  }

  const ticket = scormTicketFromRequest(req);
  if (!ticket) throw AppError.from('AUTH_MISSING_TOKEN');
  const claims = verifyScormTicket(ticket, env.JWT_ACCESS_SECRET, bound ?? {});
  return principalFromUser(claims.sub, claims.organizationId);
}

function setScormCookie(res: Response, pathValue: string, ticket: string) {
  res.cookie('scorm_session', ticket, {
    httpOnly: true,
    secure: env.isProd,
    sameSite: 'lax',
    path: pathValue,
    maxAge: env.JWT_ACCESS_TTL_SEC * 1000,
  });
}

export const scormController = {
  upload: asyncHandler(async (req, res) => {
    if (!req.auth) throw AppError.from('AUTH_MISSING_TOKEN');
    const { id } = validatedParams<{ id: string }>(req);
    if (!Buffer.isBuffer(req.body) || !req.body.length) {
      throw AppError.from('VALIDATION_ERROR', 'Upload a SCORM ZIP package.');
    }
    sendOk(
      res,
      req.requestId,
      await scormService.uploadPackage(tenantOrgId(req), id, req.auth, req.body),
    );
  }),

  launch: asyncHandler(async (req, res) => {
    const auth = await authFromRequest(req);
    const { enrollmentId } = validatedParams<{ enrollmentId: string }>(req);
    sendOk(
      res,
      req.requestId,
      await scormService.getLaunch(auth.organizationId!, enrollmentId, auth),
    );
  }),

  state: asyncHandler(async (req, res) => {
    const { enrollmentId } = validatedParams<{ enrollmentId: string }>(req);
    const auth = await authFromRequest(req, { enrollmentId });
    const state = await scormService.getState(auth.organizationId!, enrollmentId, auth);
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(state));
  }),

  commit: asyncHandler(async (req, res) => {
    const { enrollmentId } = validatedParams<{ enrollmentId: string }>(req);
    const auth = await authFromRequest(req, { enrollmentId });
    const body = validated<{ values: Record<string, string> }>(req);
    sendOk(
      res,
      req.requestId,
      await scormService.commit(auth.organizationId!, enrollmentId, auth, body.values, false),
    );
  }),

  finish: asyncHandler(async (req, res) => {
    const { enrollmentId } = validatedParams<{ enrollmentId: string }>(req);
    const auth = await authFromRequest(req, { enrollmentId });
    const body = validated<{ values: Record<string, string> }>(req);
    sendOk(
      res,
      req.requestId,
      await scormService.commit(auth.organizationId!, enrollmentId, auth, body.values, true),
    );
  }),

  player: asyncHandler(async (req, res) => {
    const { enrollmentId } = validatedParams<{ enrollmentId: string }>(req);
    const auth = await authFromRequest(req, { enrollmentId });
    const launch = await scormService.getLaunch(auth.organizationId!, enrollmentId, auth);
    const ticket = scormTicketFromRequest(req);
    if (ticket) setScormCookie(res, scormService.scormContentCookiePath(enrollmentId), ticket);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(scormService.renderPlayerHtml(enrollmentId, launch.contentUrl));
  }),

  content: asyncHandler(async (req, res) => {
    const { enrollmentId } = validatedParams<{ enrollmentId: string }>(req);
    const auth = await authFromRequest(req, { enrollmentId });
    const suffix = req.params[0] ?? '';
    const ticket = scormTicketFromRequest(req);
    if (ticket) setScormCookie(res, scormService.scormContentCookiePath(enrollmentId), ticket);
    const served = await scormService.serveContentFile(
      auth.organizationId!,
      enrollmentId,
      auth,
      suffix,
    );
    if (served.contentType) res.setHeader('Content-Type', served.contentType);
    res.sendFile(path.resolve(served.filePath));
  }),

  previewLaunch: asyncHandler(async (req, res) => {
    if (!req.auth) throw AppError.from('AUTH_MISSING_TOKEN');
    const { id } = validatedParams<{ id: string }>(req);
    sendOk(
      res,
      req.requestId,
      await scormService.getPreviewLaunch(tenantOrgId(req), id, req.auth),
    );
  }),

  previewPlayer: asyncHandler(async (req, res) => {
    const { courseId } = validatedParams<{ courseId: string }>(req);
    const auth = await authFromRequest(req, { courseId });
    const launch = await scormService.getPreviewLaunch(auth.organizationId!, courseId, auth);
    const ticket = scormTicketFromRequest(req);
    if (ticket) setScormCookie(res, scormService.scormPreviewContentCookiePath(courseId), ticket);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(scormService.renderPreviewPlayerHtml(courseId, launch.contentUrl));
  }),

  previewContent: asyncHandler(async (req, res) => {
    const { courseId } = validatedParams<{ courseId: string }>(req);
    const auth = await authFromRequest(req, { courseId });
    const suffix = req.params[0] ?? '';
    const ticket = scormTicketFromRequest(req);
    if (ticket) setScormCookie(res, scormService.scormPreviewContentCookiePath(courseId), ticket);
    const served = await scormService.servePreviewContentFile(
      auth.organizationId!,
      courseId,
      auth,
      suffix,
    );
    if (served.contentType) res.setHeader('Content-Type', served.contentType);
    res.sendFile(path.resolve(served.filePath));
  }),
};
