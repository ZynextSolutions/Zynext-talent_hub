import { Router, raw } from 'express';
import rateLimit from 'express-rate-limit';
import { authController } from '../controllers/auth.controller';
import { authenticate } from '../middleware/authenticate';
import { validate } from '../middleware/validate';
import {
  acceptInviteBody,
  changePasswordBody,
  forgotPasswordBody,
  loginBody,
  logoutBody,
  mfaDisableBody,
  mfaLoginBody,
  mfaVerifyBody,
  patchMeBody,
  platformLoginBody,
  refreshBody,
  registerBody,
  resetPasswordBody,
  ssoExchangeBody,
  ssoSlugParam,
} from '../validators/schemas';
import { env } from '../config/env';

const authBurst = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: env.isDev ? 100 : 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { code: 'RATE_LIMITED', message: 'Too many requests. Try again later.' } },
});

const refreshBurst = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
});

export const authRouter = Router();

authRouter.get('/registration-status', authController.registrationStatus);
authRouter.post('/register', authBurst, validate({ body: registerBody }), authController.register);
authRouter.post('/login', authBurst, validate({ body: loginBody }), authController.login);
authRouter.post('/platform/login', authBurst, validate({ body: platformLoginBody }), authController.platformLogin);
authRouter.post('/refresh', refreshBurst, validate({ body: refreshBody }), authController.refresh);
authRouter.post('/forgot-password', authBurst, validate({ body: forgotPasswordBody }), authController.forgotPassword);
authRouter.post('/reset-password', authBurst, validate({ body: resetPasswordBody }), authController.resetPassword);
authRouter.post('/accept-invite', authBurst, validate({ body: acceptInviteBody }), authController.acceptInvite);
authRouter.get('/sso/callback', authController.ssoCallback);
authRouter.get('/sso/:slug', validate({ params: ssoSlugParam }), authController.ssoStart);
authRouter.post('/sso/exchange', authBurst, validate({ body: ssoExchangeBody }), authController.ssoExchange);
authRouter.post('/mfa/login', authBurst, validate({ body: mfaLoginBody }), authController.mfaLogin);

authRouter.post('/logout', authenticate, validate({ body: logoutBody }), authController.logout);
authRouter.get('/me', authenticate, authController.me);
authRouter.patch('/me', authenticate, validate({ body: patchMeBody }), authController.patchMe);
authRouter.post(
  '/me/avatar',
  authenticate,
  raw({ type: () => true, limit: '1mb' }),
  authController.uploadAvatar,
);
authRouter.post('/change-password', authenticate, validate({ body: changePasswordBody }), authController.changePassword);
authRouter.post('/mfa/setup', authenticate, authController.mfaSetup);
authRouter.post('/mfa/verify', authenticate, validate({ body: mfaVerifyBody }), authController.mfaVerify);
authRouter.post('/mfa/disable', authenticate, validate({ body: mfaDisableBody }), authController.mfaDisable);
