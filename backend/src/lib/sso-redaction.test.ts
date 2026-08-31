import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { publicSsoSettings } from './sso-public';

describe('SSO DTO redaction', () => {
  it('never returns clientSecret and reports clientSecretSet', () => {
    const redacted = publicSsoSettings({
      enabled: true,
      issuer: 'https://idp.example.com',
      clientId: 'abc',
      clientSecret: 'super-secret',
      domains: ['example.com'],
    });
    assert.ok(redacted);
    assert.equal('clientSecret' in redacted!, false);
    assert.equal(redacted!.clientSecretSet, true);
  });

  it('reports clientSecretSet false when omitted', () => {
    const redacted = publicSsoSettings({ enabled: true, issuer: 'https://idp.example.com' });
    assert.equal(redacted?.clientSecretSet, false);
  });
});
