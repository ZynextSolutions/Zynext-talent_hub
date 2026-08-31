import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { assertSafeWebhookUrl } from './ssrf';

describe('webhook SSRF guard', () => {
  it('rejects loopback addresses', async () => {
    await assert.rejects(() => assertSafeWebhookUrl('https://127.0.0.1/hook'), /not allowed|HTTPS|invalid/i);
  });

  it('rejects link-local metadata', async () => {
    await assert.rejects(() => assertSafeWebhookUrl('https://169.254.169.254/latest/meta-data'), /not allowed/i);
  });

  it('rejects private RFC1918 hosts', async () => {
    await assert.rejects(() => assertSafeWebhookUrl('https://10.0.0.5/hooks'), /not allowed/i);
  });

  it('rejects IPv6-mapped private addresses', async () => {
    await assert.rejects(() => assertSafeWebhookUrl('https://[::ffff:10.0.0.5]/hooks'), /not allowed/i);
  });
});
