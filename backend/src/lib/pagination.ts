import { PAGE_SIZE_DEFAULT, PAGE_SIZE_MAX } from '../config/constants';

export interface PageParams {
  page: number;
  pageSize: number;
  skip: number;
  take: number;
}

function normalize(page?: unknown, pageSize?: unknown): PageParams {
  const p = Math.max(1, Number(page) || 1);
  const size = Math.min(PAGE_SIZE_MAX, Math.max(1, Number(pageSize) || PAGE_SIZE_DEFAULT));
  return { page: p, pageSize: size, skip: (p - 1) * size, take: size };
}

export function parsePagination(
  pageOrQuery?: number | { page?: unknown; pageSize?: unknown },
  pageSize?: number,
): PageParams {
  if (pageOrQuery !== undefined && typeof pageOrQuery === 'object') {
    return normalize(pageOrQuery.page, pageOrQuery.pageSize);
  }
  return normalize(pageOrQuery, pageSize);
}

export function paginated<T>(items: T[], total: number, page: number, pageSize: number) {
  return {
    items,
    page,
    pageSize,
    total,
    totalPages: Math.ceil(total / pageSize) || 0,
  };
}

export function paginationMeta(page: number, pageSize: number, total: number) {
  return {
    page,
    pageSize,
    total,
    totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
  };
}

export function toSkipTake(
  query: { page: number; pageSize: number } | PageParams | number,
  pageSize?: number,
): { skip: number; take: number } {
  if (typeof query === 'number') {
    const size = pageSize ?? PAGE_SIZE_DEFAULT;
    return { skip: (query - 1) * size, take: size };
  }
  if ('skip' in query && 'take' in query) {
    return { skip: query.skip, take: query.take };
  }
  return { skip: (query.page - 1) * query.pageSize, take: query.pageSize };
}

export function parseSort(
  sort: string | undefined,
  allowed: string[],
  fallback: string | { field: string; direction: 'asc' | 'desc' } = 'createdAt:desc',
): { field: string; direction: 'asc' | 'desc' } {
  const fb =
    typeof fallback === 'string'
      ? {
          field: fallback.split(':')[0] ?? 'createdAt',
          direction: (fallback.split(':')[1] === 'asc' ? 'asc' : 'desc') as 'asc' | 'desc',
        }
      : fallback;
  if (!sort) return fb;
  const [field, direction] = sort.split(':');
  if (!field || !allowed.includes(field)) return fb;
  return { field, direction: direction === 'desc' ? 'desc' : 'asc' };
}
