import { Router, raw } from 'express';
import { authController } from '../controllers/auth.controller';
import { authenticate } from '../middleware/authenticate';
import { validate } from '../middleware/validate';
import { authRateLimit, refreshRateLimit } from '../middleware/rate-limit';
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

export const authRouter = Router();

authRouter.get('/registration-status', authController.registrationStatus);
authRouter.post('/register', authRateLimit, validate({ body: registerBody }), authController.register);
authRouter.post('/login', authRateLimit, validate({ body: loginBody }), authController.login);
authRouter.post('/platform/login', authRateLimit, validate({ body: platformLoginBody }), authController.platformLogin);
authRouter.post('/refresh', refreshRateLimit, validate({ body: refreshBody }), authController.refresh);
authRouter.post('/forgot-password', authRateLimit, validate({ body: forgotPasswordBody }), authController.forgotPassword);
authRouter.post('/reset-password', authRateLimit, validate({ body: resetPasswordBody }), authController.resetPassword);
authRouter.post('/accept-invite', authRateLimit, validate({ body: acceptInviteBody }), authController.acceptInvite);
authRouter.get('/sso/callback', authController.ssoCallback);
authRouter.get('/sso/:slug', validate({ params: ssoSlugParam }), authController.ssoStart);
authRouter.post('/sso/exchange', authRateLimit, validate({ body: ssoExchangeBody }), authController.ssoExchange);
authRouter.post('/mfa/login', authRateLimit, validate({ body: mfaLoginBody }), authController.mfaLogin);

authRouter.post('/logout', validate({ body: logoutBody }), authController.logout);
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
