import { sendOk } from '../lib/http';
import { asyncHandler, tenantOrgId, validated, validatedParams } from '../lib/controller';
import { assignmentService } from '../services/assignment.service';
import { AppError } from '../errors/app-error';

export const assignmentController = {
  list: asyncHandler(async (req, res) => {
    const { id } = validatedParams<{ id: string }>(req);
    sendOk(res, req.requestId, await assignmentService.list(tenantOrgId(req), id));
  }),
  assign: asyncHandler(async (req, res) => {
    if (!req.auth) throw AppError.from('AUTH_MISSING_TOKEN');
    const { id } = validatedParams<{ id: string }>(req);
    const body = validated<{ targetType: import('../domain/assignment-targets').AssignmentTargetType; targetId: string }>(req);
    const result = await assignmentService.assign({
      organizationId: tenantOrgId(req),
      courseId: id,
      targetType: body.targetType,
      targetId: body.targetId,
      actor: req.auth,
      scope: req.scope,
      idempotencyKey: req.get('idempotency-key') ?? undefined,
    });
    sendOk(res, req.requestId, result.data, result.replay ? 200 : result.data.created ? 201 : 200);
  }),
  unassign: asyncHandler(async (req, res) => {
    const { id, assignmentId } = validatedParams<{ id: string; assignmentId: string }>(req);
    sendOk(res, req.requestId, await assignmentService.unassign(tenantOrgId(req), id, assignmentId));
  }),
};
