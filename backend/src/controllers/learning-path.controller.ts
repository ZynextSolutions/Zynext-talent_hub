import { sendOk } from '../lib/http';
import { asyncHandler, tenantOrgId, validated, validatedParams, validatedQuery } from '../lib/controller';
import { learningPathService } from '../services/learning-path.service';
import { AppError } from '../errors/app-error';

export const learningPathController = {
  list: asyncHandler(async (req, res) => {
    if (!req.auth) throw AppError.from('AUTH_MISSING_TOKEN');
    const query = validatedQuery<{ status?: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED' }>(req);
    sendOk(res, req.requestId, await learningPathService.list(tenantOrgId(req), req.auth, query.status));
  }),
  create: asyncHandler(async (req, res) => {
    sendOk(res, req.requestId, await learningPathService.create(tenantOrgId(req), validated(req)), 201);
  }),
  get: asyncHandler(async (req, res) => {
    if (!req.auth) throw AppError.from('AUTH_MISSING_TOKEN');
    const { id } = validatedParams<{ id: string }>(req);
    sendOk(res, req.requestId, await learningPathService.get(tenantOrgId(req), id, req.auth));
  }),
  patch: asyncHandler(async (req, res) => {
    const { id } = validatedParams<{ id: string }>(req);
    sendOk(res, req.requestId, await learningPathService.update(tenantOrgId(req), id, validated(req)));
  }),
  remove: asyncHandler(async (req, res) => {
    const { id } = validatedParams<{ id: string }>(req);
    sendOk(res, req.requestId, await learningPathService.remove(tenantOrgId(req), id));
  }),
  setCourses: asyncHandler(async (req, res) => {
    if (!req.auth) throw AppError.from('AUTH_MISSING_TOKEN');
    const { id } = validatedParams<{ id: string }>(req);
    const body = validated<{ courses: Array<{ courseId: string; orderIndex: number; required?: boolean }> }>(req);
    sendOk(res, req.requestId, await learningPathService.setCourses(tenantOrgId(req), id, body.courses, req.auth));
  }),
  publish: asyncHandler(async (req, res) => {
    const { id } = validatedParams<{ id: string }>(req);
    sendOk(res, req.requestId, await learningPathService.publish(tenantOrgId(req), id));
  }),
  enroll: asyncHandler(async (req, res) => {
    if (!req.auth) throw AppError.from('AUTH_MISSING_TOKEN');
    const { id } = validatedParams<{ id: string }>(req);
    const body = validated<{ userId: string }>(req);
    const isSelf = body.userId === req.auth.sub;
    if (!isSelf && !req.auth.permissions.includes('enrollment:write')) {
      throw AppError.from('RBAC_FORBIDDEN');
    }
    sendOk(res, req.requestId, await learningPathService.enroll(tenantOrgId(req), id, body.userId), 201);
  }),
  listEnrollments: asyncHandler(async (req, res) => {
    const { id } = validatedParams<{ id: string }>(req);
    sendOk(res, req.requestId, await learningPathService.listEnrollments(tenantOrgId(req), id));
  }),
  listAssignments: asyncHandler(async (req, res) => {
    const { id } = validatedParams<{ id: string }>(req);
    sendOk(res, req.requestId, await learningPathService.listAssignments(tenantOrgId(req), id));
  }),
  assign: asyncHandler(async (req, res) => {
    if (!req.auth) throw AppError.from('AUTH_MISSING_TOKEN');
    const { id } = validatedParams<{ id: string }>(req);
    const body = validated<{ targetType: string; targetId: string }>(req);
    sendOk(
      res,
      req.requestId,
      await learningPathService.assign({
        organizationId: tenantOrgId(req),
        pathId: id,
        targetType: body.targetType as 'ORGANIZATION' | 'DIVISION' | 'DEPARTMENT' | 'TEAM' | 'USER',
        targetId: body.targetId,
        actor: req.auth,
        scope: req.scope,
      }),
      201,
    );
  }),
  myEnrollments: asyncHandler(async (req, res) => {
    if (!req.auth) throw AppError.from('AUTH_MISSING_TOKEN');
    sendOk(res, req.requestId, await learningPathService.listMyEnrollments(tenantOrgId(req), req.auth.sub));
  }),
  learnerProgress: asyncHandler(async (req, res) => {
    if (!req.auth) throw AppError.from('AUTH_MISSING_TOKEN');
    const { id } = validatedParams<{ id: string }>(req);
    sendOk(
      res,
      req.requestId,
      await learningPathService.getLearnerProgress(tenantOrgId(req), id, req.auth.sub, req.auth),
    );
  }),
};
