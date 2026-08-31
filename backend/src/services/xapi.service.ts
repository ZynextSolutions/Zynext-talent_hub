import { xapiRepository } from '../repositories/xapi.repository';
import { paginationMeta, parsePagination, toSkipTake } from '../lib/pagination';

class XapiService {
  record(input: {
    organizationId: string;
    userId?: string;
    verb: string;
    activityId?: string;
    objectType?: string;
    objectId?: string;
    objectName?: string;
    result?: Record<string, unknown>;
  }) {
    const statement = {
      actor: input.userId ? { account: { name: input.userId } } : { name: 'system' },
      verb: { id: `http://adlnet.gov/expapi/verbs/${input.verb}`, display: { 'en-US': input.verb } },
      object: {
        id: input.activityId ?? `urn:cor-lms:${input.objectType ?? 'activity'}/${input.objectId ?? 'unknown'}`,
        definition: { name: { 'en-US': input.objectName ?? input.verb } },
      },
      ...(input.result ? { result: input.result } : {}),
      timestamp: new Date().toISOString(),
    };
    return xapiRepository.create({
      organizationId: input.organizationId,
      userId: input.userId,
      verb: input.verb,
      activityId: input.activityId ?? statement.object.id,
      statement,
    });
  }

  async list(
    organizationId: string,
    query: { page?: number; pageSize?: number; verb?: string; from?: Date; to?: Date },
  ) {
    const pg = parsePagination(query.page, query.pageSize);
    const { skip, take } = toSkipTake(pg);
    const { items, total } = await xapiRepository.list(organizationId, {
      skip,
      take,
      verb: query.verb,
      from: query.from,
      to: query.to,
    });
    return {
      items: items.map((row) => ({
        id: row.id,
        verb: row.verb,
        activityId: row.activityId,
        userId: row.userId,
        createdAt: row.createdAt.toISOString(),
      })),
      pagination: paginationMeta(pg.page, pg.pageSize, total),
    };
  }

  async stats(organizationId: string, from: Date, to: Date) {
    const rows = await xapiRepository.stats(organizationId, from, to);
    const total = rows.reduce((s, r) => s + r._count._all, 0);
    return {
      total,
      verbs: rows.map((r) => ({ verb: r.verb, count: r._count._all })),
    };
  }
}

export const xapiService = new XapiService();
