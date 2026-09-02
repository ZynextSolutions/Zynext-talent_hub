import type { Request, Response } from 'express';
import { authService } from '../services/auth.service';
import { mfaService } from '../services/mfa.service';
import { ssoService } from '../services/sso.service';
import { sendOk } from '../lib/http';
import { asyncHandler, validated, validatedParams } from '../lib/controller';
import { AppError } from '../errors/app-error';
import { env } from '../config/env';
import {
  clearAuthCookies,
  refreshTokenFromRequest,
  setAuthCookies,
  shouldClearAuthCookiesOnRefreshError,
} from '../lib/auth-cookies';
import { tryResolveBearerAuth } from '../middleware/authenticate';

type TokenBundle = { accessToken: string; refreshToken: string; expiresIn: number };

function publicTokens(tokens: TokenBundle): TokenBundle | Omit<TokenBundle, 'refreshToken'> & { refreshToken?: string } {
  if (env.isProd) {
    return { accessToken: tokens.accessToken, expiresIn: tokens.expiresIn };
  }
  return tokens;
}

function sendAuthOk<T extends { tokens?: TokenBundle }>(
  res: Response,
  requestId: string,
  data: T,
  status = 200,
): void {
  if (data.tokens) {
    setAuthCookies(res, data.tokens);
    sendOk(res, requestId, { ...data, tokens: publicTokens(data.tokens) }, status);
    return;
  }
  sendOk(res, requestId, data, status);
}

export const authController = {
  register: asyncHandler(async (req: Request, res: Response) => {
    if (!env.allowPublicOrgRegister) {
      throw AppError.from('REGISTRATION_DISABLED');
    }
    const body = validated<{
      organizationName: string;
      organizationSlug: string;
      admin: { email: string; password: string; firstName: string; lastName: string };
    }>(req);
    const data = await authService.register({
      ...body,
      userAgent: req.get('user-agent'),
      ip: req.ip,
    });
    sendAuthOk(res, req.requestId, data, 201);
  }),

  registrationStatus: asyncHandler(async (req, res) => {
    sendOk(res, req.requestId, { allowed: env.allowPublicOrgRegister });
  }),

  login: asyncHandler(async (req, res) => {
    const body = validated<{ email: string; password: string; organizationSlug: string }>(req);
    const data = await authService.login({
      ...body,
      userAgent: req.get('user-agent'),
      ip: req.ip,
    });
    sendAuthOk(res, req.requestId, data);
  }),

  platformLogin: asyncHandler(async (req, res) => {
    const body = validated<{ email: string; password: string }>(req);
    const data = await authService.platformLogin({
      ...body,
      userAgent: req.get('user-agent'),
      ip: req.ip,
    });
    sendAuthOk(res, req.requestId, data);
  }),

  refresh: asyncHandler(async (req, res) => {
    const body = validated<{ refreshToken?: string }>(req);
    const token = refreshTokenFromRequest(req, body.refreshToken);
    if (!token) {
      clearAuthCookies(res);
      throw AppError.from('AUTH_REFRESH_INVALID', 'Refresh token is missing.');
    }
    try {
      const data = await authService.refresh(token, {
        userAgent: req.get('user-agent'),
        ip: req.ip,
      });
      sendAuthOk(res, req.requestId, { ...data, tokens: data });
    } catch (err) {
      if (shouldClearAuthCookiesOnRefreshError(err)) {
        clearAuthCookies(res);
      }
      throw err;
    }
  }),

  logout: asyncHandler(async (req, res) => {
    const body = validated<{ refreshToken?: string }>(req);
    const token = refreshTokenFromRequest(req, body.refreshToken);
    const auth = req.auth ?? (await tryResolveBearerAuth(req));
    if (!auth && !token) {
      clearAuthCookies(res);
      sendOk(res, req.requestId, { loggedOut: true });
      return;
    }
    const data = await authService.logout(auth ?? null, token);
    clearAuthCookies(res);
    sendOk(res, req.requestId, data);
  }),

  me: asyncHandler(async (req, res) => {
    if (!req.auth) throw AppError.from('AUTH_MISSING_TOKEN');
    const data = await authService.me(req.auth);
    sendOk(res, req.requestId, data);
  }),

  patchMe: asyncHandler(async (req, res) => {
    if (!req.auth) throw AppError.from('AUTH_MISSING_TOKEN');
    const data = await authService.updateMe(req.auth, validated(req));
    sendOk(res, req.requestId, data);
  }),

  uploadAvatar: asyncHandler(async (req, res) => {
    if (!req.auth) throw AppError.from('AUTH_MISSING_TOKEN');
    if (!Buffer.isBuffer(req.body) || !req.body.length) {
      throw AppError.from('VALIDATION_ERROR', 'Upload an image.');
    }
    const rawName = String(req.headers['x-filename'] ?? 'avatar.png');
    let filename = rawName;
    try {
      filename = decodeURIComponent(rawName);
    } catch {
      filename = rawName;
    }
    const data = await authService.uploadAvatar(req.auth, filename, req.body);
    sendOk(res, req.requestId, data);
  }),

  changePassword: asyncHandler(async (req, res) => {
    if (!req.auth) throw AppError.from('AUTH_MISSING_TOKEN');
    const data = await authService.changePassword(req.auth, validated(req));
    sendOk(res, req.requestId, data);
  }),

  forgotPassword: asyncHandler(async (req, res) => {
    const body = validated<{ email: string; organizationSlug: string }>(req);
    const data = await authService.forgotPassword(body.email, body.organizationSlug);
    sendOk(res, req.requestId, data);
  }),

  resetPassword: asyncHandler(async (req, res) => {
    const body = validated<{ token: string; newPassword: string }>(req);
    const data = await authService.resetPassword(body.token, body.newPassword);
    sendOk(res, req.requestId, data);
  }),

  acceptInvite: asyncHandler(async (req, res) => {
    const data = await authService.acceptInvite(validated(req));
    sendAuthOk(res, req.requestId, data, 201);
  }),

  mfaSetup: asyncHandler(async (req, res) => {
    if (!req.auth) throw AppError.from('AUTH_MISSING_TOKEN');
    sendOk(res, req.requestId, await mfaService.setup(req.auth));
  }),

  mfaVerify: asyncHandler(async (req, res) => {
    if (!req.auth) throw AppError.from('AUTH_MISSING_TOKEN');
    const body = validated<{ code: string }>(req);
    sendOk(res, req.requestId, await mfaService.verifySetup(req.auth, body.code));
  }),

  mfaDisable: asyncHandler(async (req, res) => {
    if (!req.auth) throw AppError.from('AUTH_MISSING_TOKEN');
    sendOk(res, req.requestId, await mfaService.disable(req.auth, validated(req)));
  }),

  mfaLogin: asyncHandler(async (req, res) => {
    const body = validated<{ mfaToken: string; code: string }>(req);
    const data = await authService.completeMfaLogin(body.mfaToken, body.code, {
      userAgent: req.get('user-agent'),
      ip: req.ip,
    });
    sendAuthOk(res, req.requestId, data);
  }),

  ssoStart: asyncHandler(async (req, res) => {
    const { slug } = validatedParams<{ slug: string }>(req);
    await ssoService.startRedirect(slug, res);
  }),

  ssoCallback: asyncHandler(async (req, res) => {
    const code = typeof req.query.code === 'string' ? req.query.code : undefined;
    const state = typeof req.query.state === 'string' ? req.query.state : undefined;
    await ssoService.handleCallback(code, state, res);
  }),

  ssoExchange: asyncHandler(async (req, res) => {
    const body = validated<{ token: string }>(req);
    const data = await ssoService.exchange(body.token, {
      userAgent: req.get('user-agent'),
      ip: req.ip,
    });
    sendAuthOk(res, req.requestId, data);
  }),
};
