import type { NextFunction, Request, Response } from 'express';
import { auditService } from '../services/audit.service';

export function audit(action: string, resourceType: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    res.on('finish', () => {
      if (res.statusCode >= 400 || !req.auth) return;
      void auditService.record({
        organizationId: req.tenant?.organizationId ?? req.auth.organizationId,
        actorType: req.auth.actorType,
        actorId: req.auth.sub,
        action,
        resourceType,
        resourceId: typeof req.params.id === 'string' ? req.params.id : undefined,
        ip: req.ip,
        userAgent: req.get('user-agent'),
        requestId: req.requestId,
      });
    });
    next();
  };
}
