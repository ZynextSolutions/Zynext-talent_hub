import { Prisma } from '@prisma/client';
import { AppError } from './app-error';

export function mapPrismaError(err: unknown): AppError | null {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      const target = Array.isArray(err.meta?.target) ? (err.meta.target as string[]).join(',') : '';
      if (target.includes('slug')) {
        return AppError.from('ORGANIZATION_SLUG_TAKEN');
      }
      if (target.includes('email')) {
        return AppError.from('AUTH_EMAIL_TAKEN');
      }
      return AppError.from('CONFLICT_UNIQUE');
    }
    if (err.code === 'P2025') {
      return AppError.from('NOT_FOUND');
    }
    if (err.code === 'P2003') {
      return AppError.from('CONFLICT_FK');
    }
    if (err.code === 'P2034') {
      return AppError.from('TX_WRITE_CONFLICT');
    }
  }
  return null;
}

export function isPrismaUniqueViolation(err: unknown, field?: string): boolean {
  if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== 'P2002') return false;
  if (!field) return true;
  const target = Array.isArray(err.meta?.target)
    ? (err.meta.target as string[]).join(',')
    : String(err.meta?.target ?? '');
  return target.includes(field);
}

export function isPrismaWriteConflict(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2034';
}
