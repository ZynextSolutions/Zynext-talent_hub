import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  assertFiltersInScope,
  assertOrgLevelAllowed,
  assertUserAnalyticsAccess,
  parseAnalyticsRange,
} from './analytics-query';
import { AppError } from '../errors/app-error';

describe('parseAnalyticsRange', () => {
  it('parses valid from/to', () => {
    const { from, to } = parseAnalyticsRange({ from: '2026-01-01', to: '2026-01-31' });
    assert.equal(from.toISOString(), '2026-01-01T00:00:00.000Z');
    assert.equal(to.toISOString(), '2026-01-31T23:59:59.999Z');
  });

  it('rejects invalid date format', () => {
    assert.throws(
      () => parseAnalyticsRange({ from: '01/31/2026', to: '2026-01-31' }),
      (err: unknown) => err instanceof AppError,
    );
  });

  it('rejects from after to', () => {
    assert.throws(
      () => parseAnalyticsRange({ from: '2026-02-01', to: '2026-01-01' }),
      (err: unknown) => err instanceof AppError,
    );
  });

  it('rejects spans over 366 days', () => {
    assert.throws(
      () => parseAnalyticsRange({ from: '2024-01-01', to: '2026-01-01' }),
      (err: unknown) => err instanceof AppError,
    );
  });
});

describe('assertOrgLevelAllowed', () => {
  it('blocks self scope', () => {
    assert.throws(
      () => assertOrgLevelAllowed({ kind: 'self', userId: 'u1' }, 'DEPARTMENT'),
      (err: unknown) => err instanceof AppError,
    );
  });

  it('blocks department scope from division level', () => {
    assert.throws(
      () => assertOrgLevelAllowed({ kind: 'department', departmentId: 'd1' }, 'DIVISION'),
      (err: unknown) => err instanceof AppError,
    );
  });

  it('allows department scope at department level', () => {
    assert.doesNotThrow(() =>
      assertOrgLevelAllowed({ kind: 'department', departmentId: 'd1' }, 'DEPARTMENT'),
    );
  });
});

describe('assertFiltersInScope', () => {
  it('blocks department filter outside manager scope', () => {
    assert.throws(
      () =>
        assertFiltersInScope({ kind: 'department', departmentId: 'd1' }, { departmentId: 'd2' }),
      (err: unknown) => err instanceof AppError,
    );
  });

  it('blocks org-unit filters for self scope', () => {
    assert.throws(
      () => assertFiltersInScope({ kind: 'self', userId: 'u1' }, { teamId: 't1' }),
      (err: unknown) => err instanceof AppError,
    );
  });
});

describe('assertUserAnalyticsAccess', () => {
  it('blocks self-scoped access to other users', () => {
    assert.throws(
      () => assertUserAnalyticsAccess({ kind: 'self', userId: 'u1' }, 'u2', 'd1'),
      (err: unknown) => err instanceof AppError,
    );
  });

  it('blocks department-scoped access outside department', () => {
    assert.throws(
      () => assertUserAnalyticsAccess({ kind: 'department', departmentId: 'd1' }, 'u2', 'd2'),
      (err: unknown) => err instanceof AppError,
    );
  });
});
