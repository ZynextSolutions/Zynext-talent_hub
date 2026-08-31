import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { signScormTicket, verifyScormTicket } from './scorm-ticket';
import { AppError } from '../errors/app-error';

const secret = 'test-scorm-ticket-secret-min-32-chars!!';

describe('SCORM player ticket', () => {
  it('roundtrips an enrollment ticket', () => {
    const token = signScormTicket(
      { sub: 'user-1', organizationId: 'org-1', enrollmentId: 'enr-1' },
      secret,
      120,
    );
    const payload = verifyScormTicket(token, secret, { enrollmentId: 'enr-1' });
    assert.equal(payload.sub, 'user-1');
    assert.equal(payload.enrollmentId, 'enr-1');
  });

  it('rejects a ticket bound to a different enrollment', () => {
    const token = signScormTicket(
      { sub: 'user-1', organizationId: 'org-1', enrollmentId: 'enr-1' },
      secret,
      120,
    );
    assert.throws(
      () => verifyScormTicket(token, secret, { enrollmentId: 'enr-2' }),
      (err: unknown) => err instanceof AppError,
    );
  });

  it('rejects a tampered ticket', () => {
    const token = signScormTicket(
      { sub: 'user-1', organizationId: 'org-1', enrollmentId: 'enr-1' },
      secret,
      120,
    );
    assert.throws(
      () => verifyScormTicket(`${token}x`, secret, { enrollmentId: 'enr-1' }),
      (err: unknown) => err instanceof AppError,
    );
  });
});
