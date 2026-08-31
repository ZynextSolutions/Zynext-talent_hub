import { ERROR_HTTP, ERROR_MESSAGES, type ErrorCode } from './codes';

export interface ErrorDetail {
  path: string;
  message: string;
}

export class AppError extends Error {
  readonly code: ErrorCode | string;
  readonly status: number;
  readonly details?: unknown;

  constructor(code: ErrorCode | string, status: number, message: string, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = status;
    this.details = details;
  }

  get statusCode(): number {
    return this.status;
  }

  static from(code: ErrorCode | string, message?: string, details?: unknown): AppError {
    if (code in ERROR_HTTP) {
      const typed = code as ErrorCode;
      return new AppError(typed, ERROR_HTTP[typed], message ?? ERROR_MESSAGES[typed], details);
    }
    return new AppError(code, 500, message ?? String(code), details);
  }
}

export function notFound(message = 'Resource not found'): AppError {
  return AppError.from('NOT_FOUND', message);
}

export function forbidden(message = 'Forbidden'): AppError {
  return AppError.from('RBAC_FORBIDDEN', message);
}

export function unauthorized(message = 'Unauthorized'): AppError {
  return AppError.from('AUTH_INVALID_CREDENTIALS', message);
}

export function badRequest(message: string, code: ErrorCode = 'VALIDATION_ERROR'): AppError {
  return AppError.from(code, message);
}

export function conflict(message: string, code: ErrorCode = 'CONFLICT_UNIQUE'): AppError {
  return AppError.from(code, message);
}
