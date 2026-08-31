import { DEFAULT_CERTIFICATE_TEMPLATE } from '../types/dto';

export const ACCESS_TTL_SEC = 900;
export const ACCESS_TOKEN_TTL_SEC = 900;
export const REFRESH_TTL_SEC = 604800;
export const REFRESH_TOKEN_TTL_SEC = 604800;
export const BCRYPT_ROUNDS_MIN = 12;
export const BCRYPT_ROUNDS_DEFAULT = 12;
export const PAGE_SIZE_DEFAULT = 25;
export const PAGE_SIZE_MAX = 100;
export const JSON_BODY_LIMIT = '1mb';
export const URLENCODED_LIMIT = '32kb';
export const LOGIN_MAX_ATTEMPTS = 10;
export const LOGIN_MAX_FAILURES = 10;
export const LOGIN_WINDOW_MS = 15 * 60 * 1000;
export const MFA_LOGIN_TTL_MS = 5 * 60 * 1000;
/** LoginLockout.organizationId is not an FK; used as the platform-admin lockout key. */
export const PLATFORM_LOCKOUT_ORG_ID = 'platform';
export const AUTH_RATE_WINDOW_MS = 15 * 60 * 1000;
export const AUTH_RATE_MAX = 5;
export const REFRESH_RATE_MAX = 30;
export const GLOBAL_RATE_MAX_PROD = 300;
export const GLOBAL_RATE_MAX_DEV = 2000;
export const AUTHENTICATED_RATE_MAX = 600;
export const CERT_VERIFY_RATE_MAX = 30;
export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const RESET_TTL_MS = 60 * 60 * 1000;
export const PASSWORD_RESET_TTL_MS = RESET_TTL_MS;
export const TX_SERIALIZABLE = {
  isolationLevel: 'Serializable' as const,
  timeout: 5000,
  maxWait: 2000,
};
export const TX_DEFAULT = { timeout: 10000, maxWait: 2000 };
export const ENROLLMENT_CHUNK = 500;
export const CERT_NUMBER_RETRY = 3;
export const HSTS_MAX_AGE = 15552000;
export const REQUEST_ID_RE = /^[A-Za-z0-9_-]{8,64}$/;
export const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,46}[a-z0-9])$/;
export const PASSWORD_MIN = 12;
export const PASSWORD_MAX = 128;
export const DUMMY_PASSWORD_HASH =
  '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4pZqKqYqKqYqKqYe';
export const DEFAULT_ORG_SETTINGS = {
  timezone: 'UTC',
  allowDivisionlessDepts: true,
  allowSelfEnrollment: false,
  certificatePrefix: 'COR',
  showAnswersAfterAttempt: false,
  certificateTemplate: DEFAULT_CERTIFICATE_TEMPLATE,
  trainingCurrency: 'MMK' as 'USD' | 'MMK',
  defaultTrainingCostMinor: 0,
};
