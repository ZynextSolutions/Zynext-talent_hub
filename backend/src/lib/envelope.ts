import type { PaginationMeta } from '../types/pagination';
import type { ErrorCode } from '../errors/codes';
import type { ErrorDetail } from '../errors/app-error';

export interface SuccessEnvelope<T> {
  success: true;
  data: T;
  meta: {
    requestId: string;
    pagination?: PaginationMeta;
  };
}

export interface ErrorEnvelope {
  success: false;
  error: {
    code: ErrorCode | string;
    message: string;
    details?: ErrorDetail[];
  };
  meta: { requestId: string };
}

export function success<T>(
  data: T,
  requestId: string,
  pagination?: PaginationMeta,
): SuccessEnvelope<T> {
  return {
    success: true,
    data,
    meta: pagination ? { requestId, pagination } : { requestId },
  };
}

export function fail(
  code: ErrorCode | string,
  message: string,
  requestId: string,
  details?: unknown,
): ErrorEnvelope {
  const normalized = Array.isArray(details)
    ? (details as ErrorDetail[])
    : details === undefined
      ? undefined
      : [{ path: 'error', message: String(details) }];
  return {
    success: false,
    error: { code, message, details: normalized },
    meta: { requestId },
  };
}

export function paginationMeta(page: number, pageSize: number, total: number): PaginationMeta {
  return {
    page,
    pageSize,
    total,
    totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
  };
}
