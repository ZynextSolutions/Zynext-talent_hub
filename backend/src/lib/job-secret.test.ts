import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isExplicitAllJobScope, timingSafeSecretEqual } from './job-secret';

describe('job secret compare', () => {
  it('matches equal secrets', () => {
    assert.equal(timingSafeSecretEqual('dev-job-secret', 'dev-job-secret'), true);
  });

  it('rejects mismatched or missing secrets', () => {
    assert.equal(timingSafeSecretEqual('wrong', 'dev-job-secret'), false);
    assert.equal(timingSafeSecretEqual(undefined, 'dev-job-secret'), false);
    assert.equal(timingSafeSecretEqual('dev-job-secret', undefined), false);
  });
});

describe('job all-tenant scope', () => {
  it('requires an explicit all header', () => {
    assert.equal(isExplicitAllJobScope('all'), true);
    assert.equal(isExplicitAllJobScope('ALL'), true);
    assert.equal(isExplicitAllJobScope(undefined), false);
    assert.equal(isExplicitAllJobScope('org'), false);
  });
});
