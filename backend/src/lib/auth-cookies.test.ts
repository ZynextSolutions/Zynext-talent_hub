import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { AppError } from '../errors/app-error';
import { shouldClearAuthCookiesOnRefreshError } from './auth-cookies';

describe('shouldClearAuthCookiesOnRefreshError', () => {
  it('clears on terminal refresh auth failures', () => {
    for (const code of [
      'AUTH_REFRESH_INVALID',
      'AUTH_REFRESH_EXPIRED',
      'AUTH_REFRESH_REUSE',
      'AUTH_ACCOUNT_SUSPENDED',
      'AUTH_ORG_SUSPENDED',
      'AUTH_MISSING_TOKEN',
    ] as const) {
      assert.equal(shouldClearAuthCookiesOnRefreshError(AppError.from(code)), true, code);
    }
  });

  it('does not clear on rate limit or unexpected errors', () => {
    assert.equal(shouldClearAuthCookiesOnRefreshError(AppError.from('RATE_LIMITED')), false);
    assert.equal(shouldClearAuthCookiesOnRefreshError(AppError.from('INTERNAL_ERROR')), false);
    assert.equal(shouldClearAuthCookiesOnRefreshError(new Error('boom')), false);
  });
});
