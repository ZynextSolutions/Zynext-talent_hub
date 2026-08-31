import { generateSecret, generateURI, verify } from 'otplib';
import { AppError } from '../errors/app-error';
import { encryptSecret, decryptSecret, promotePendingSecret } from '../lib/secret-box';
import { organizationRepository } from '../repositories/organization.repository';
import { platformAdminRepository } from '../repositories/platform-admin.repository';
import { userRepository } from '../repositories/user.repository';
import type { AuthPrincipal } from '../types/auth';
import { passwordService } from './password.service';
import { auditService } from './audit.service';

class MfaService {
  async setup(auth: AuthPrincipal) {
    if (auth.actorType === 'platform') {
      const admin = await platformAdminRepository.findById(auth.sub);
      if (!admin) throw AppError.from('NOT_FOUND');
      if (admin.mfaEnabled) throw AppError.from('VALIDATION_ERROR', 'MFA is already enabled.');
      const secret = generateSecret();
      await platformAdminRepository.update(auth.sub, { mfaSecretPending: encryptSecret(secret) });
      const otpauthUrl = generateURI({
        issuer: 'Zynext TalentHub Platform',
        label: admin.email,
        secret,
      });
      return { secret, otpauthUrl };
    }
    if (auth.actorType !== 'user' || !auth.organizationId) throw AppError.from('RBAC_FORBIDDEN');
    const user = await userRepository.getById(auth.organizationId, auth.sub);
    if (!user) throw AppError.from('NOT_FOUND');
    if (user.mfaEnabled) throw AppError.from('VALIDATION_ERROR', 'MFA is already enabled.');
    const secret = generateSecret();
    await userRepository.update(auth.organizationId, auth.sub, { mfaSecretPending: encryptSecret(secret) });
    const org = await organizationRepository.findById(auth.organizationId);
    const otpauthUrl = generateURI({
      issuer: org?.name ?? 'Zynext TalentHub',
      label: user.email,
      secret,
    });
    return { secret, otpauthUrl };
  }

  async verifySetup(auth: AuthPrincipal, code: string) {
    if (auth.actorType === 'platform') {
      const admin = await platformAdminRepository.findById(auth.sub);
      if (!admin?.mfaSecretPending) throw AppError.from('VALIDATION_ERROR', 'Start MFA setup first.');
      if (!(await this.verifyCode(admin.mfaSecretPending, code))) {
        throw AppError.from('VALIDATION_ERROR', 'Invalid verification code.');
      }
      await platformAdminRepository.update(auth.sub, {
        mfaSecret: promotePendingSecret(admin.mfaSecretPending),
        mfaSecretPending: null,
        mfaEnabled: true,
      });
      await auditService.record({
        organizationId: null,
        actorType: auth.actorType,
        actorId: auth.sub,
        action: 'MFA_ENABLED',
        resourceType: 'PlatformAdmin',
        resourceId: auth.sub,
      });
      return { enabled: true };
    }
    if (auth.actorType !== 'user' || !auth.organizationId) throw AppError.from('RBAC_FORBIDDEN');
    const user = await userRepository.getById(auth.organizationId, auth.sub);
    if (!user?.mfaSecretPending) throw AppError.from('VALIDATION_ERROR', 'Start MFA setup first.');
    if (!(await this.verifyCode(user.mfaSecretPending, code))) {
      throw AppError.from('VALIDATION_ERROR', 'Invalid verification code.');
    }
    await userRepository.update(auth.organizationId, auth.sub, {
      mfaSecret: promotePendingSecret(user.mfaSecretPending),
      mfaSecretPending: null,
      mfaEnabled: true,
    });
    await auditService.record({
      organizationId: auth.organizationId,
      actorType: auth.actorType,
      actorId: auth.sub,
      action: 'MFA_ENABLED',
      resourceType: 'User',
      resourceId: auth.sub,
    });
    return { enabled: true };
  }

  async disable(auth: AuthPrincipal, body: { code: string; password: string }) {
    if (auth.actorType === 'platform') {
      const admin = await platformAdminRepository.findById(auth.sub);
      if (!admin?.mfaEnabled || !admin.mfaSecret) {
        throw AppError.from('VALIDATION_ERROR', 'MFA is not enabled.');
      }
      const codeOk = await this.verifyCode(admin.mfaSecret, body.code);
      const passOk = await passwordService.verify(body.password, admin.passwordHash);
      if (!codeOk || !passOk) {
        throw AppError.from('AUTH_INVALID_CREDENTIALS', 'Provide a valid authenticator code and password.');
      }
      await platformAdminRepository.update(auth.sub, {
        mfaEnabled: false,
        mfaSecret: null,
        mfaSecretPending: null,
      });
      await auditService.record({
        organizationId: null,
        actorType: auth.actorType,
        actorId: auth.sub,
        action: 'MFA_DISABLED',
        resourceType: 'PlatformAdmin',
        resourceId: auth.sub,
      });
      return { disabled: true };
    }
    if (auth.actorType !== 'user' || !auth.organizationId) throw AppError.from('RBAC_FORBIDDEN');
    const user = await userRepository.getById(auth.organizationId, auth.sub);
    if (!user?.mfaEnabled || !user.mfaSecret) {
      throw AppError.from('VALIDATION_ERROR', 'MFA is not enabled.');
    }
    const codeOk = await this.verifyCode(user.mfaSecret, body.code);
    const passOk = await passwordService.verify(body.password, user.passwordHash);
    if (!codeOk || !passOk) {
      throw AppError.from('AUTH_INVALID_CREDENTIALS', 'Provide a valid authenticator code and password.');
    }
    await userRepository.update(auth.organizationId, auth.sub, {
      mfaEnabled: false,
      mfaSecret: null,
      mfaSecretPending: null,
    });
    await auditService.record({
      organizationId: auth.organizationId,
      actorType: auth.actorType,
      actorId: auth.sub,
      action: 'MFA_DISABLED',
      resourceType: 'User',
      resourceId: auth.sub,
    });
    return { disabled: true };
  }

  async verifyCode(secret: string, code: string): Promise<boolean> {
    const result = await verify({ secret: decryptSecret(secret) ?? secret, token: code.trim(), epochTolerance: 30 });
    return result.valid;
  }
}

export const mfaService = new MfaService();
