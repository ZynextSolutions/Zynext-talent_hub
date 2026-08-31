import type { Request, Response } from 'express';
import { prisma } from '../repositories/prisma';
import { sendOk } from '../lib/http';
import { AppError } from '../errors/app-error';
import { asyncHandler } from '../lib/controller';

export const healthController = {
  live: (req: Request, res: Response) => {
    sendOk(res, req.requestId, { status: 'ok', uptimeSeconds: Math.floor(process.uptime()) });
  },

  ready: asyncHandler(async (req, res) => {
    const timeout = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('timeout')), 2000);
    });
    try {
      await Promise.race([prisma.$queryRaw`SELECT 1`, timeout]);
      sendOk(res, req.requestId, { status: 'ready', database: 'up' });
    } catch {
      throw AppError.from('SERVICE_UNAVAILABLE', 'Database is unavailable.');
    }
  }),
};
