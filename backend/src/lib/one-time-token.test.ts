import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { consumeWhere } from './one-time-token';

describe('one-time token consume', () => {
  it('only matches unused, unexpired hashes', () => {
    const now = new Date('2026-09-01T00:00:00.000Z');
    const where = consumeWhere('abc', 'INVITE', now);
    assert.equal(where.tokenHash, 'abc');
    assert.equal(where.purpose, 'INVITE');
    assert.equal(where.usedAt, null);
    assert.deepEqual(where.expiresAt, { gt: now });
  });
});
