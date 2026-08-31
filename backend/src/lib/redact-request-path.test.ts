import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { redactRequestPath } from './redact-request-path';

describe('redactRequestPath', () => {
  it('redacts ticket and access_token query values', () => {
    assert.equal(
      redactRequestPath('/api/v1/learn/scorm/abc/player.html?ticket=secret-ticket&x=1'),
      '/api/v1/learn/scorm/abc/player.html?ticket=redacted&x=1',
    );
    assert.equal(redactRequestPath('/auth/callback?code=oauth&state=ok'), '/auth/callback?code=redacted&state=ok');
  });

  it('leaves paths without secrets unchanged', () => {
    assert.equal(redactRequestPath('/health'), '/health');
    assert.equal(redactRequestPath('/api/v1/courses?page=1'), '/api/v1/courses?page=1');
  });
});
