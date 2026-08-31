import type { NextFunction, Request, Response } from 'express';
import { ZodError, type ZodTypeAny } from 'zod';
import { AppError } from '../errors/app-error';

interface SchemaSet {
  body?: ZodTypeAny;
  query?: ZodTypeAny;
  params?: ZodTypeAny;
}

export function validate(schema: SchemaSet) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      const body = schema.body ? schema.body.parse(req.body ?? {}) : req.body;
      const query = schema.query ? schema.query.parse(req.query ?? {}) : req.query;
      const params = schema.params ? schema.params.parse(req.params ?? {}) : req.params;
      req.validated = { body, query, params };
      if (schema.body) req.body = body;
      if (schema.query) req.query = query as Request['query'];
      if (schema.params) req.params = params as Request['params'];
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        next(
          AppError.from(
            'VALIDATION_ERROR',
            'Request validation failed.',
            err.issues.map((issue) => ({
              path: issue.path.join('.'),
              message: issue.message,
            })),
          ),
        );
        return;
      }
      next(err);
    }
  };
}
