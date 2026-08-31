import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { env } from '../config/env';
import { AppError } from '../errors/app-error';
import { mapPrismaError } from '../errors/prisma-map';
import { fail } from '../lib/envelope';

function appErrorStatus(err: AppError): number {
  if (typeof err.status === 'number') return err.status;
  if (typeof err.statusCode === 'number') return err.statusCode;
  return 500;
}

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const requestId = req.requestId ?? 'unknown';

  if (err instanceof AppError) {
    res.status(appErrorStatus(err)).json(fail(err.code, err.message, requestId, err.details));
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json(
      fail(
        'VALIDATION_ERROR',
        'Request validation failed.',
        requestId,
        err.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
      ),
    );
    return;
  }

  const prismaMapped = mapPrismaError(err);
  if (prismaMapped) {
    res
      .status(prismaMapped.status)
      .json(fail(prismaMapped.code, prismaMapped.message, requestId, prismaMapped.details));
    return;
  }

  if (err instanceof SyntaxError && 'body' in err) {
    res.status(400).json(fail('INVALID_JSON', 'Malformed JSON body.', requestId));
    return;
  }

  const maybe = err as { status?: number; type?: string; message?: string };
  if (maybe.status === 413 || maybe.type === 'entity.too.large') {
    res.status(413).json(fail('PAYLOAD_TOO_LARGE', 'Request body is too large.', requestId));
    return;
  }

  // eslint-disable-next-line no-console
  console.error(
    JSON.stringify({
      level: 'error',
      requestId,
      err: env.NODE_ENV === 'development' ? { message: maybe.message, stack: (err as Error).stack } : { message: 'hidden' },
    }),
  );

  const payload = fail('INTERNAL_ERROR', 'An unexpected error occurred.', requestId);
  if (env.NODE_ENV === 'development' && err instanceof Error) {
    (payload.error as { stack?: string }).stack = err.stack;
  }
  res.status(500).json(payload);
};
