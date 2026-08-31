import type { Response } from 'express';
import { success } from './envelope';
import type { PaginationMeta } from '../types/pagination';

export function sendOk<T>(
  res: Response,
  requestId: string,
  data: T,
  status = 200,
  pagination?: PaginationMeta,
): void {
  const payload =
    pagination && Array.isArray(data)
      ? ({ items: data, ...pagination } as T)
      : data;
  res.status(status).json(success(payload, requestId, pagination));
}
