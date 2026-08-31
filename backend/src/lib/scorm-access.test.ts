import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { canAccessScormEnrollment } from './scorm-access';

const owner = { sub: 'user-1', role: 'EMPLOYEE', permissions: ['enrollment:read'] };
const otherEmployee = { sub: 'user-2', role: 'EMPLOYEE', permissions: ['enrollment:read'] };
const manager = { sub: 'mgr-1', role: 'MANAGER', permissions: ['enrollment:read'] };
const instructor = { sub: 'ins-1', role: 'INSTRUCTOR', permissions: ['course:write', 'enrollment:read'] };

describe('SCORM enrollment access', () => {
  it('allows the enrolled learner to read and write', () => {
    assert.equal(canAccessScormEnrollment('user-1', owner, 'read'), true);
    assert.equal(canAccessScormEnrollment('user-1', owner, 'write'), true);
  });

  it('blocks employees from reading or writing another learner CMI', () => {
    assert.equal(canAccessScormEnrollment('user-1', otherEmployee, 'read'), false);
    assert.equal(canAccessScormEnrollment('user-1', otherEmployee, 'write'), false);
  });

  it('allows managers and instructors to read another learner, not write', () => {
    assert.equal(canAccessScormEnrollment('user-1', manager, 'read'), true);
    assert.equal(canAccessScormEnrollment('user-1', manager, 'write'), false);
    assert.equal(canAccessScormEnrollment('user-1', instructor, 'read'), true);
    assert.equal(canAccessScormEnrollment('user-1', instructor, 'write'), false);
  });
});
