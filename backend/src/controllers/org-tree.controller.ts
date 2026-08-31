import { sendOk } from '../lib/http';
import { asyncHandler, tenantOrgId, validated, validatedQuery } from '../lib/controller';
import { orgTreeService } from '../services/org-tree.service';
import { orgMoveService } from '../services/org-move.service';
import { AppError } from '../errors/app-error';

export const orgTreeController = {
  tree: asyncHandler(async (req, res) => {
    const query = validatedQuery<{ includeUsers: boolean }>(req);
    const data = await orgTreeService.getTree(tenantOrgId(req), query.includeUsers !== false, req.scope);
    sendOk(res, req.requestId, data);
  }),

  moveNode: asyncHandler(async (req, res) => {
    if (!req.auth) throw AppError.from('AUTH_MISSING_TOKEN');
    const body = validated<{
      nodeType: 'DEPARTMENT' | 'TEAM' | 'USER';
      nodeId: string;
      targetParentType: 'ORGANIZATION' | 'DIVISION' | 'DEPARTMENT' | 'TEAM';
      targetParentId?: string | null;
    }>(req);
    const data = await orgMoveService.moveNode({
      organizationId: tenantOrgId(req),
      ...body,
      ifMatch: req.get('if-match') ?? undefined,
      actorId: req.auth.sub,
    });
    sendOk(res, req.requestId, data);
  }),
};
