import { sendOk } from '../lib/http';
import { asyncHandler, tenantOrgId, validated, validatedParams, validatedQuery } from '../lib/controller';
import { skillService } from '../services/skill.service';
import { xapiService } from '../services/xapi.service';
import { compliancePackageService } from '../services/compliance-package.service';
import { integrationsService } from '../services/integrations.service';
import { auditService } from '../services/audit.service';
import { reportsService } from '../services/reports.service';
import { parseAnalyticsRange } from '../lib/analytics-query';
import { parsePagination, paginationMeta, toSkipTake } from '../lib/pagination';
import { AppError } from '../errors/app-error';
import type { ReportType } from '../validators/reports.schema';

export const skillsController = {
  list: asyncHandler(async (req, res) => {
    sendOk(res, req.requestId, await skillService.list(tenantOrgId(req)));
  }),
  create: asyncHandler(async (req, res) => {
    sendOk(res, req.requestId, await skillService.create(tenantOrgId(req), validated(req)), 201);
  }),
  update: asyncHandler(async (req, res) => {
    const { id } = validatedParams<{ id: string }>(req);
    sendOk(res, req.requestId, await skillService.update(tenantOrgId(req), id, validated(req)));
  }),
  remove: asyncHandler(async (req, res) => {
    const { id } = validatedParams<{ id: string }>(req);
    sendOk(res, req.requestId, await skillService.remove(tenantOrgId(req), id));
  }),
  setCourseSkills: asyncHandler(async (req, res) => {
    const { id } = validatedParams<{ id: string }>(req);
    const body = validated<{ skills: Array<{ skillId: string; level?: number }> }>(req);
    sendOk(res, req.requestId, await skillService.setCourseSkills(tenantOrgId(req), id, body.skills ?? []));
  }),
  getCourseSkills: asyncHandler(async (req, res) => {
    const { id } = validatedParams<{ id: string }>(req);
    sendOk(res, req.requestId, await skillService.listCourseSkills(id));
  }),
  analytics: asyncHandler(async (req, res) => {
    const dept = req.scope?.kind === 'department' ? req.scope.departmentId : undefined;
    sendOk(res, req.requestId, await skillService.analytics(tenantOrgId(req), dept));
  }),
  listRoles: asyncHandler(async (req, res) => {
    sendOk(res, req.requestId, await skillService.listRoles(tenantOrgId(req)));
  }),
  getRoleSkills: asyncHandler(async (req, res) => {
    const { id } = validatedParams<{ id: string }>(req);
    sendOk(res, req.requestId, await skillService.listRoleSkills(tenantOrgId(req), id));
  }),
  setRoleSkills: asyncHandler(async (req, res) => {
    const { id } = validatedParams<{ id: string }>(req);
    const body = validated<{ skills: Array<{ skillId: string; requiredLevel?: number }> }>(req);
    sendOk(res, req.requestId, await skillService.setRoleSkills(tenantOrgId(req), id, body.skills ?? []));
  }),
};

export const xapiController = {
  list: asyncHandler(async (req, res) => {
    const query = validatedQuery<{ page?: number; pageSize?: number; verb?: string; from?: string; to?: string }>(req);
    let from: Date | undefined;
    let to: Date | undefined;
    if (query.from || query.to) {
      const range = parseAnalyticsRange({ from: query.from, to: query.to });
      from = range.from;
      to = range.to;
    }
    const result = await xapiService.list(tenantOrgId(req), { ...query, from, to });
    sendOk(res, req.requestId, result.items, 200, result.pagination);
  }),
  stats: asyncHandler(async (req, res) => {
    const query = validatedQuery<{ from?: string; to?: string }>(req);
    const range = parseAnalyticsRange(query);
    sendOk(res, req.requestId, await xapiService.stats(tenantOrgId(req), range.from, range.to));
  }),
};

export const auditLogsController = {
  list: asyncHandler(async (req, res) => {
    const query = validatedQuery<{ page?: number; pageSize?: number; action?: string; from?: string; to?: string }>(req);
    const pg = parsePagination(query.page, query.pageSize);
    const { skip, take } = toSkipTake(pg);
    let from: Date | undefined;
    let to: Date | undefined;
    if (query.from || query.to) {
      const range = parseAnalyticsRange({ from: query.from, to: query.to });
      from = range.from;
      to = range.to;
    }
    const { items, total } = await auditService.list({
      organizationId: tenantOrgId(req),
      skip,
      take,
      action: query.action,
      from,
      to,
    });
    sendOk(
      res,
      req.requestId,
      items.map((r) => ({
        id: r.id,
        action: r.action,
        actorType: r.actorType,
        actorId: r.actorId,
        resourceType: r.resourceType,
        resourceId: r.resourceId,
        createdAt: r.createdAt.toISOString(),
      })),
      200,
      paginationMeta(pg.page, pg.pageSize, total),
    );
  }),
};

export const complianceController = {
  listPackages: asyncHandler(async (req, res) => {
    const rows = await compliancePackageService.list(tenantOrgId(req));
    sendOk(
      res,
      req.requestId,
      rows.map((r) => ({
        id: r.id,
        status: r.status,
        filePath: r.filePath,
        completedAt: r.completedAt?.toISOString() ?? null,
        createdAt: r.createdAt.toISOString(),
      })),
    );
  }),
  exportPackage: asyncHandler(async (req, res) => {
    if (!req.auth) throw AppError.from('AUTH_MISSING_TOKEN');
    const query = validatedQuery<{ from?: string; to?: string }>(req);
    const result = await compliancePackageService.createAndBuild(tenantOrgId(req), req.auth.sub, query);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="compliance-${Date.now()}.zip"`);
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const { uploadsRoot } = await import('../lib/uploads');
    const rel = result.filePath.replace(/^\/uploads\//, '');
    const abs = path.join(uploadsRoot(), rel);
    res.status(200).send(await fs.readFile(abs));
  }),
};

export const integrationsController = {
  listKeys: asyncHandler(async (req, res) => {
    sendOk(res, req.requestId, await integrationsService.listApiKeys(tenantOrgId(req)));
  }),
  createKey: asyncHandler(async (req, res) => {
    if (!req.auth) throw AppError.from('AUTH_MISSING_TOKEN');
    const body = validated<{ name: string; scopes: string[] }>(req);
    sendOk(res, req.requestId, await integrationsService.createApiKey(tenantOrgId(req), req.auth.sub, body), 201);
  }),
  revokeKey: asyncHandler(async (req, res) => {
    const { id } = validatedParams<{ id: string }>(req);
    sendOk(res, req.requestId, await integrationsService.revokeApiKey(tenantOrgId(req), id, req.auth?.sub));
  }),
  listWebhooks: asyncHandler(async (req, res) => {
    sendOk(res, req.requestId, await integrationsService.listWebhooks(tenantOrgId(req)));
  }),
  createWebhook: asyncHandler(async (req, res) => {
    const body = validated<{ url: string; events: string[] }>(req);
    sendOk(res, req.requestId, await integrationsService.createWebhook(tenantOrgId(req), body), 201);
  }),
  updateWebhook: asyncHandler(async (req, res) => {
    const { id } = validatedParams<{ id: string }>(req);
    sendOk(res, req.requestId, await integrationsService.updateWebhook(tenantOrgId(req), id, validated(req)));
  }),
  deleteWebhook: asyncHandler(async (req, res) => {
    const { id } = validatedParams<{ id: string }>(req);
    sendOk(res, req.requestId, await integrationsService.deleteWebhook(tenantOrgId(req), id));
  }),
};

export const biController = {
  report: asyncHandler(async (req, res) => {
    const { type } = validatedParams<{ type: ReportType }>(req);
    const query = validatedQuery<Record<string, string | undefined>>(req);
    const csv = await reportsService.exportCsv(tenantOrgId(req), type, req.scope, query);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${type}.csv"`);
    res.status(200).send(csv);
  }),
};

export const docsController = {
  openapi: asyncHandler(async (_req, res) => {
    const spec = await import('../docs/openapi.json');
    res.json(spec.default ?? spec);
  }),
};
