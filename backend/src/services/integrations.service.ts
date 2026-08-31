import { AppError } from '../errors/app-error';
import { filterApiKeyScopes } from '../domain/roles';
import {
  generateApiKeySecret,
  integrationsRepository,
  signWebhookPayload,
} from '../repositories/integrations.repository';
import { sha256 } from '../lib/crypto';
import { assertSafeWebhookUrl, postWebhook } from '../lib/ssrf';
import { auditService } from './audit.service';

class IntegrationsService {
  listApiKeys(organizationId: string) {
    return integrationsRepository.listApiKeys(organizationId).then((rows) =>
      rows.map((r) => ({
        id: r.id,
        name: r.name,
        keyPrefix: r.keyPrefix,
        scopes: r.scopes,
        lastUsedAt: r.lastUsedAt?.toISOString() ?? null,
        createdAt: r.createdAt.toISOString(),
      })),
    );
  }

  async createApiKey(organizationId: string, userId: string, input: { name: string; scopes: string[] }) {
    const scopes = filterApiKeyScopes(input.scopes);
    if (!scopes.length) {
      throw AppError.from('VALIDATION_ERROR', 'Provide at least one valid API scope.');
    }
    const { secret, prefix, hash } = generateApiKeySecret();
    const row = await integrationsRepository.createApiKey({
      organizationId,
      name: input.name,
      scopes,
      createdByUserId: userId,
      keyPrefix: prefix,
      keyHash: hash,
    });
    await auditService.record(
      {
        organizationId,
        actorType: 'user',
        actorId: userId,
        action: 'API_KEY_CREATED',
        resourceType: 'ApiKey',
        resourceId: row.id,
      },
      { required: true },
    );
    return {
      id: row.id,
      name: row.name,
      keyPrefix: row.keyPrefix,
      scopes: row.scopes,
      secret,
    };
  }

  async revokeApiKey(organizationId: string, id: string, actorId?: string) {
    const result = await integrationsRepository.revokeApiKey(organizationId, id);
    if (result.count === 0) throw AppError.from('NOT_FOUND');
    await auditService.record(
      {
        organizationId,
        actorType: 'user',
        actorId: actorId ?? 'system',
        action: 'API_KEY_REVOKED',
        resourceType: 'ApiKey',
        resourceId: id,
      },
      { required: true },
    );
    return { revoked: true };
  }

  async authenticateApiKey(rawKey: string) {
    const prefix = rawKey.slice(0, 12);
    const row = await integrationsRepository.findApiKeyByPrefix(prefix);
    if (!row || row.keyHash !== sha256(rawKey)) return null;
    void integrationsRepository.touchApiKey(row.id);
    return row;
  }

  listWebhooks(organizationId: string) {
    return integrationsRepository.listWebhooks(organizationId).then((rows) =>
      rows.map((r) => ({
        id: r.id,
        url: r.url,
        events: r.events,
        enabled: r.enabled,
        lastDeliveryAt: r.lastDeliveryAt?.toISOString() ?? null,
        createdAt: r.createdAt.toISOString(),
      })),
    );
  }

  createWebhook(organizationId: string, input: { url: string; events: string[] }) {
    return assertSafeWebhookUrl(input.url).then(() => {
      const secret = generateApiKeySecret().secret;
      return integrationsRepository.createWebhook({
        organizationId,
        url: input.url,
        secret,
        events: input.events,
      }).then((r) => ({
        id: r.id,
        url: r.url,
        events: r.events,
        enabled: r.enabled,
        secret,
      }));
    });
  }

  async updateWebhook(organizationId: string, id: string, input: { url?: string; events?: string[]; enabled?: boolean }) {
    if (input.url) await assertSafeWebhookUrl(input.url);
    const result = await integrationsRepository.updateWebhook(organizationId, id, input);
    if (result.count === 0) throw AppError.from('NOT_FOUND');
    return { updated: true };
  }

  async deleteWebhook(organizationId: string, id: string) {
    const result = await integrationsRepository.deleteWebhook(organizationId, id);
    if (result.count === 0) throw AppError.from('NOT_FOUND');
    return { deleted: true };
  }

  async dispatchWebhook(organizationId: string, event: string, payload: Record<string, unknown>) {
    const hooks = await integrationsRepository.findWebhooksForEvent(organizationId, event);
    if (!hooks.length) return;
    const body = JSON.stringify({ event, organizationId, payload, timestamp: new Date().toISOString() });
    await Promise.allSettled(
      hooks.map(async (hook) => {
        const signature = signWebhookPayload(hook.secret, body);
        await postWebhook(hook.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Cor-Signature': signature,
            'X-Cor-Event': event,
          },
          body,
        });
      }),
    );
  }
}

export const integrationsService = new IntegrationsService();
