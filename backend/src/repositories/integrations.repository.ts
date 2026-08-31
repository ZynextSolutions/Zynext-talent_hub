import { createHmac } from 'node:crypto';
import { prisma } from '../lib/prisma';
import { sha256, randomToken } from '../lib/crypto';
import { clock } from '../lib/clock';

export class IntegrationsRepository {
  listApiKeys(organizationId: string) {
    return prisma.apiKey.findMany({
      where: { organizationId, revokedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  createApiKey(input: {
    organizationId: string;
    name: string;
    scopes: string[];
    createdByUserId?: string;
    keyPrefix: string;
    keyHash: string;
  }) {
    return prisma.apiKey.create({ data: input });
  }

  findApiKeyByPrefix(prefix: string) {
    return prisma.apiKey.findFirst({
      where: { keyPrefix: prefix, revokedAt: null },
    });
  }

  touchApiKey(id: string) {
    return prisma.apiKey.update({ where: { id }, data: { lastUsedAt: clock.now() } });
  }

  revokeApiKey(organizationId: string, id: string) {
    return prisma.apiKey.updateMany({
      where: { id, organizationId, revokedAt: null },
      data: { revokedAt: clock.now() },
    });
  }

  listWebhooks(organizationId: string) {
    return prisma.webhook.findMany({ where: { organizationId }, orderBy: { createdAt: 'desc' } });
  }

  createWebhook(input: { organizationId: string; url: string; secret: string; events: string[] }) {
    return prisma.webhook.create({ data: input });
  }

  updateWebhook(organizationId: string, id: string, data: { url?: string; events?: string[]; enabled?: boolean }) {
    return prisma.webhook.updateMany({ where: { id, organizationId }, data });
  }

  deleteWebhook(organizationId: string, id: string) {
    return prisma.webhook.deleteMany({ where: { id, organizationId } });
  }

  findWebhooksForEvent(organizationId: string, event: string) {
    return prisma.webhook.findMany({
      where: { organizationId, enabled: true, events: { has: event } },
    });
  }
}

export const integrationsRepository = new IntegrationsRepository();

export function generateApiKeySecret() {
  const secret = `cor_live_${randomToken(24)}`;
  return { secret, prefix: secret.slice(0, 12), hash: sha256(secret) };
}

export function signWebhookPayload(secret: string, body: string) {
  return createHmac('sha256', secret).update(body).digest('hex');
}
