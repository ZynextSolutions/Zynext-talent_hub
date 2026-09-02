import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  CERT_EXPIRY_THRESHOLDS,
  matchesCertExpiryThreshold,
  selectCertExpiryThreshold,
} from './cert-expiry';

describe('cert expiry thresholds', () => {
  it('matches inclusive windows instead of exact days', () => {
    const t90 = CERT_EXPIRY_THRESHOLDS[0];
    assert.equal(matchesCertExpiryThreshold(90, t90), true);
    assert.equal(matchesCertExpiryThreshold(45, t90), true);
    assert.equal(matchesCertExpiryThreshold(31, t90), true);
    assert.equal(matchesCertExpiryThreshold(30, t90), false);

    const t30 = CERT_EXPIRY_THRESHOLDS[1];
    assert.equal(matchesCertExpiryThreshold(30, t30), true);
    assert.equal(matchesCertExpiryThreshold(8, t30), true);
    assert.equal(matchesCertExpiryThreshold(7, t30), false);

    const t7 = CERT_EXPIRY_THRESHOLDS[2];
    assert.equal(matchesCertExpiryThreshold(7, t7), true);
    assert.equal(matchesCertExpiryThreshold(0, t7), true);
    assert.equal(matchesCertExpiryThreshold(-1, t7), false);

    const expired = CERT_EXPIRY_THRESHOLDS[3];
    assert.equal(matchesCertExpiryThreshold(-1, expired), true);
    assert.equal(matchesCertExpiryThreshold(-100, expired), true);
    assert.equal(matchesCertExpiryThreshold(0, expired), false);
  });

  it('selects the first matching window and still hits after a missed day', () => {
    // Missed exact day 90 → still in 90-day window on day 89.
    assert.equal(selectCertExpiryThreshold(89)?.kind, 'cert_expiring_90');
    assert.equal(selectCertExpiryThreshold(29)?.kind, 'cert_expiring_30');
    assert.equal(selectCertExpiryThreshold(3)?.kind, 'cert_expiring_7');
    assert.equal(selectCertExpiryThreshold(-2)?.kind, 'cert_expired');
    assert.equal(selectCertExpiryThreshold(120), null);
  });
});
