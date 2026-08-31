import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { decryptSecret, encryptSecret, isEncryptedSecret, promotePendingSecret } from './secret-box';

describe('secret-box', () => {
  it('roundtrips plaintext when no encryption key is configured or dual-reads plaintext', () => {
    const plain = 'totp-secret-value';
    const stored = encryptSecret(plain);
    const read = decryptSecret(stored);
    assert.equal(read, plain);
  });

  it('treats unprefixed values as plaintext (dual-read)', () => {
    assert.equal(decryptSecret('legacy-plain'), 'legacy-plain');
    assert.equal(isEncryptedSecret('legacy-plain'), false);
  });

  it('promotes a pending secret without double-wrapping', () => {
    const plain = 'totp-secret-value';
    const pending = encryptSecret(plain);
    const stored = promotePendingSecret(pending);
    assert.equal(decryptSecret(stored), plain);
    if (isEncryptedSecret(pending)) {
      assert.equal(isEncryptedSecret(stored), true);
      assert.equal(stored.startsWith('enc:v1:enc:v1:'), false);
    }
  });
});
