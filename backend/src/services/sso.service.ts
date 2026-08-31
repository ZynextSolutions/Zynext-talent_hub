import type { Response } from 'express';
import { AppError } from '../errors/app-error';
import { sha256, randomToken } from '../lib/crypto';
import { parseSettings } from '../lib/mappers';
import { prisma } from '../lib/prisma';
import { toOrganizationDto, toUserDto } from '../lib/mappers';
import { organizationRepository } from '../repositories/organization.repository';
import { userRepository } from '../repositories/user.repository';
import { decryptSecret } from '../lib/secret-box';
import { MFA_LOGIN_TTL_MS } from '../config/constants';
import { env } from '../config/env';
import { tokenService } from './token.service';
import { loginEventService } from './login-event.service';
import { loginLockoutRepository } from '../repositories/login-lockout.repository';
import { oneTimeTokenRepository } from '../repositories/one-time-token.repository';
import { assertSafeOutboundUrl, fetchSafe } from '../lib/ssrf';

const SSO_STATE_TTL_MS = 10 * 60 * 1000;
const SSO_EXCHANGE_TTL_MS = 2 * 60 * 1000;

type OidcConfig = {
  issuer: string;
  clientId: string;
  clientSecret: string;
  domains: string[];
};

function apiBase(): string {
  return `${env.API_PUBLIC_URL.replace(/\/$/, '')}/api/v1`;
}

function webLoginUrl(params: Record<string, string>): string {
  const qs = new URLSearchParams(params).toString();
  return `${env.PUBLIC_WEB_URL}/login${qs ? `?${qs}` : ''}`;
}

function readSso(raw: unknown): OidcConfig | null {
  const settings = parseSettings(raw);
  const sso = settings.sso;
  if (!sso || sso.enabled !== true) return null;
  const issuer = sso.issuer?.trim() ?? '';
  const clientId = sso.clientId?.trim() ?? '';
  const clientSecret = decryptSecret(typeof sso.clientSecret === 'string' ? sso.clientSecret : undefined) ?? '';
  const domains = (sso.domains ?? []).map((d) => d.toLowerCase());
  if (!issuer || !clientId || !clientSecret) return null;
  return { issuer: issuer.replace(/\/$/, ''), clientId, clientSecret, domains };
}

async function discover(issuer: string) {
  await assertSafeOutboundUrl(issuer, 'OIDC issuer');
  const wellKnown = `${issuer.replace(/\/$/, '')}/.well-known/openid-configuration`;
  const res = await fetchSafe(wellKnown, {}, 'OIDC discovery');
  if (!res.ok) throw AppError.from('VALIDATION_ERROR', 'OIDC discovery failed.');
  const doc = (await res.json()) as {
    authorization_endpoint?: string;
    token_endpoint?: string;
    userinfo_endpoint?: string;
  };
  if (!doc.authorization_endpoint || !doc.token_endpoint || !doc.userinfo_endpoint) {
    throw AppError.from('VALIDATION_ERROR', 'OIDC provider is missing required endpoints.');
  }
  await assertSafeOutboundUrl(doc.authorization_endpoint, 'OIDC authorization endpoint');
  await assertSafeOutboundUrl(doc.token_endpoint, 'OIDC token endpoint');
  await assertSafeOutboundUrl(doc.userinfo_endpoint, 'OIDC userinfo endpoint');
  return doc;
}

class SsoService {
  async startRedirect(slug: string, res: Response): Promise<void> {
    const org = await organizationRepository.findBySlug(slug.toLowerCase());
    if (!org || org.status === 'SUSPENDED' || org.deletedAt) {
      throw AppError.from('ORGANIZATION_NOT_FOUND');
    }
    const cfg = readSso(org.settings);
    if (!cfg) throw AppError.from('VALIDATION_ERROR', 'SSO is not configured for this organization.');
    const state = randomToken(32);
    await prisma.oneTimeToken.create({
      data: {
        organizationId: org.id,
        purpose: 'SSO_STATE',
        tokenHash: sha256(state),
        expiresAt: new Date(Date.now() + SSO_STATE_TTL_MS),
      },
    });
    const oidc = await discover(cfg.issuer);
    const redirectUri = `${apiBase()}/auth/sso/callback`;
    const url = new URL(oidc.authorization_endpoint!);
    url.searchParams.set('client_id', cfg.clientId);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', 'openid email profile');
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('state', state);
    res.redirect(url.toString());
  }

  async handleCallback(code: string | undefined, state: string | undefined, res: Response): Promise<void> {
    if (!code || !state) {
      res.redirect(webLoginUrl({ ssoError: 'missing_params' }));
      return;
    }
    const stateRow = await oneTimeTokenRepository.consume(sha256(state), 'SSO_STATE');
    if (!stateRow?.organizationId) {
      res.redirect(webLoginUrl({ ssoError: 'invalid_state' }));
      return;
    }
    const org = await organizationRepository.findById(stateRow.organizationId);
    if (!org) {
      res.redirect(webLoginUrl({ ssoError: 'org_not_found' }));
      return;
    }
    const cfg = readSso(org.settings);
    if (!cfg) {
      res.redirect(webLoginUrl({ ssoError: 'sso_disabled' }));
      return;
    }
    try {
      const oidc = await discover(cfg.issuer);
      const redirectUri = `${apiBase()}/auth/sso/callback`;
      const tokenRes = await fetchSafe(
        oidc.token_endpoint!,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            grant_type: 'authorization_code',
            code,
            redirect_uri: redirectUri,
            client_id: cfg.clientId,
            client_secret: cfg.clientSecret,
          }),
        },
        'OIDC token endpoint',
      );
      if (!tokenRes.ok) {
        res.redirect(webLoginUrl({ ssoError: 'token_exchange_failed' }));
        return;
      }
      const tokens = (await tokenRes.json()) as { access_token?: string };
      if (!tokens.access_token) {
        res.redirect(webLoginUrl({ ssoError: 'token_exchange_failed' }));
        return;
      }
      const userInfoRes = await fetchSafe(
        oidc.userinfo_endpoint!,
        { headers: { Authorization: `Bearer ${tokens.access_token}` } },
        'OIDC userinfo endpoint',
      );
      if (!userInfoRes.ok) {
        res.redirect(webLoginUrl({ ssoError: 'userinfo_failed' }));
        return;
      }
      const profile = (await userInfoRes.json()) as { email?: string };
      const email = profile.email?.trim().toLowerCase();
      if (!email) {
        res.redirect(webLoginUrl({ ssoError: 'email_missing' }));
        return;
      }
      if (cfg.domains.length) {
        const domain = email.split('@')[1]?.toLowerCase();
        if (!domain || !cfg.domains.includes(domain)) {
          res.redirect(webLoginUrl({ ssoError: 'domain_not_allowed' }));
          return;
        }
      }
      const user = await userRepository.findByEmail(org.id, email);
      if (!user || user.status !== 'ACTIVE') {
        res.redirect(webLoginUrl({ ssoError: 'user_not_found' }));
        return;
      }
      const exchange = randomToken(32);
      await prisma.oneTimeToken.create({
        data: {
          organizationId: org.id,
          userId: user.id,
          purpose: 'SSO_EXCHANGE',
          tokenHash: sha256(exchange),
          expiresAt: new Date(Date.now() + SSO_EXCHANGE_TTL_MS),
        },
      });
      res.redirect(webLoginUrl({ ssoExchange: exchange, organizationSlug: org.slug }));
    } catch {
      res.redirect(webLoginUrl({ ssoError: 'sso_failed' }));
    }
  }

  async exchange(token: string, meta?: { userAgent?: string | null; ip?: string | null }) {
    const row = await oneTimeTokenRepository.consume(sha256(token), 'SSO_EXCHANGE');
    if (!row?.organizationId || !row.userId) {
      throw AppError.from('AUTH_TOKEN_INVALID');
    }
    const user = await userRepository.getById(row.organizationId, row.userId);
    const org = await organizationRepository.findById(row.organizationId);
    if (!user || !org || user.status !== 'ACTIVE') throw AppError.from('AUTH_TOKEN_INVALID');
    await loginLockoutRepository.clear(org.id, user.email);
    if (user.mfaEnabled && user.mfaSecret) {
      const mfaToken = randomToken(32);
      await prisma.oneTimeToken.create({
        data: {
          organizationId: org.id,
          userId: user.id,
          purpose: 'MFA_LOGIN',
          tokenHash: sha256(mfaToken),
          expiresAt: new Date(Date.now() + MFA_LOGIN_TTL_MS),
        },
      });
      return { mfaRequired: true as const, mfaToken };
    }
    await userRepository.update(org.id, user.id, { lastLoginAt: new Date() });
    loginEventService.recordLogin({
      organizationId: org.id,
      userId: user.id,
      method: 'sso',
      ip: meta?.ip,
      userAgent: meta?.userAgent,
    });
    const tokens = await tokenService.issuePair({
      sub: user.id,
      actorType: 'user',
      organizationId: org.id,
      role: user.role.name as 'ORG_ADMIN' | 'MANAGER' | 'INSTRUCTOR' | 'EMPLOYEE',
      userAgent: meta?.userAgent,
      ip: meta?.ip,
    });
    return {
      user: toUserDto(user),
      organization: toOrganizationDto(org),
      tokens: { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, expiresIn: tokens.expiresIn },
    };
  }
}

export const ssoService = new SsoService();
