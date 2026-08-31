import type { NextFunction, Request, Response } from 'express';
import { env } from '../config/env';

/** Allow the Next.js app (different origin/port) to embed SCORM player HTML in iframes. */
export function allowEmbedFraming(_req: Request, res: Response, next: NextFunction): void {
  if (env.isDev) {
    res.setHeader('Content-Security-Policy', 'frame-ancestors *');
  } else {
    const ancestors = ["'self'", env.publicWebUrl, ...env.corsOrigins].filter(Boolean);
    res.setHeader('Content-Security-Policy', `frame-ancestors ${[...new Set(ancestors)].join(' ')}`);
  }
  res.removeHeader('X-Frame-Options');
  next();
}
