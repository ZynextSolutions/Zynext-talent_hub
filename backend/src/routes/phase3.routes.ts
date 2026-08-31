import { Router } from 'express';
import { validate } from '../middleware/validate';
import { tenant } from './_tenant';
import { uuidParam } from '../validators/schemas';
import { z } from 'zod';
import {
  auditLogsController,
  biController,
  complianceController,
  docsController,
  integrationsController,
  skillsController,
  xapiController,
} from '../controllers/phase3.controller';
import { authenticateApiKey } from '../middleware/api-key-auth';
import { requirePermission } from '../middleware/require-permission';
import { audit } from '../middleware/audit';
import { reportTypeParamSchema } from '../validators/reports.schema';

export const skillsRouter = Router();
skillsRouter.get('/', ...tenant('skills:read'), skillsController.list);
skillsRouter.get('/roles', ...tenant('skills:read'), skillsController.listRoles);
skillsRouter.get('/roles/:id/skills', ...tenant('skills:read'), validate({ params: uuidParam }), skillsController.getRoleSkills);
skillsRouter.put('/roles/:id/skills', ...tenant('skills:write'), validate({ params: uuidParam, body: z.object({ skills: z.array(z.object({ skillId: z.string().uuid(), requiredLevel: z.number().int().min(1).max(5).optional() })) }) }), skillsController.setRoleSkills);
skillsRouter.post('/', ...tenant('skills:write'), validate({ body: z.object({ name: z.string().min(1), description: z.string().optional(), code: z.string().optional(), category: z.string().optional() }) }), skillsController.create);
skillsRouter.patch('/:id', ...tenant('skills:write'), validate({ params: uuidParam, body: z.object({ name: z.string().optional(), description: z.string().optional(), code: z.string().optional(), category: z.string().optional() }) }), skillsController.update);
skillsRouter.delete('/:id', ...tenant('skills:write'), validate({ params: uuidParam }), skillsController.remove);

export const auditLogsRouter = Router();
auditLogsRouter.get('/', ...tenant('audit:read'), auditLogsController.list);

export const complianceRouter = Router();
complianceRouter.get('/packages', ...tenant('compliance:export'), complianceController.listPackages);
complianceRouter.get('/export', ...tenant('compliance:export'), complianceController.exportPackage);

export const integrationsRouter = Router();
integrationsRouter.get('/api-keys', ...tenant('api-key:write'), integrationsController.listKeys);
integrationsRouter.post('/api-keys', ...tenant('api-key:write'), audit('API_KEY_CREATED', 'ApiKey'), validate({ body: z.object({ name: z.string().min(1), scopes: z.array(z.string()).min(1) }) }), integrationsController.createKey);
integrationsRouter.delete('/api-keys/:id', ...tenant('api-key:write'), audit('API_KEY_REVOKED', 'ApiKey'), validate({ params: uuidParam }), integrationsController.revokeKey);
integrationsRouter.get('/webhooks', ...tenant('webhook:write'), integrationsController.listWebhooks);
integrationsRouter.post('/webhooks', ...tenant('webhook:write'), audit('WEBHOOK_CREATED', 'Webhook'), validate({ body: z.object({ url: z.string().url(), events: z.array(z.string()).min(1) }) }), integrationsController.createWebhook);
integrationsRouter.patch('/webhooks/:id', ...tenant('webhook:write'), audit('WEBHOOK_UPDATED', 'Webhook'), validate({ params: uuidParam, body: z.object({ url: z.string().url().optional(), events: z.array(z.string()).optional(), enabled: z.boolean().optional() }) }), integrationsController.updateWebhook);
integrationsRouter.delete('/webhooks/:id', ...tenant('webhook:write'), audit('WEBHOOK_DELETED', 'Webhook'), validate({ params: uuidParam }), integrationsController.deleteWebhook);

export const biRouter = Router();
biRouter.get('/reports/:type', authenticateApiKey, requirePermission('reports:read'), validate({ ...reportTypeParamSchema }), biController.report);

export const docsRouter = Router();
docsRouter.get('/openapi.json', docsController.openapi);

export const xapiRouter = Router();
xapiRouter.get('/statements', ...tenant('xapi:read'), xapiController.list);
xapiRouter.get('/stats', ...tenant('xapi:read'), xapiController.stats);
