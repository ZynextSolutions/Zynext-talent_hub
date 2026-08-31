import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { filterApiKeyScopes } from '../domain/roles';

describe('API key scopes', () => {
  it('keeps allowlisted permissions and drops platform scopes', () => {
    const filtered = filterApiKeyScopes([
      'course:read',
      'platform:org:write',
      'not-a-scope',
      'user:read',
    ]);
    assert.deepEqual(filtered, ['course:read', 'user:read']);
  });

  it('returns empty when nothing valid remains', () => {
    assert.deepEqual(filterApiKeyScopes(['platform:org:read', 'nope']), []);
  });
});
