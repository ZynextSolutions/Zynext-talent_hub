import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { computeEnrollmentProgress, isEnrollmentComplete } from './completion';

const lessons = [
  { id: 'a', required: true },
  { id: 'b', required: true },
  { id: 'c', required: false },
  { id: 'd', required: false },
];

describe('computeEnrollmentProgress', () => {
  it('counts all lessons in ALL_LESSONS mode', () => {
    const completed = new Set(['a']);
    assert.equal(computeEnrollmentProgress('ALL_LESSONS', null, lessons, completed), 25);
  });

  it('uses only required lessons in REQUIRED_LESSONS mode', () => {
    const completedRequired = new Set(['a', 'b']);
    assert.equal(
      computeEnrollmentProgress('REQUIRED_LESSONS', null, lessons, completedRequired),
      100,
    );
    assert.equal(
      isEnrollmentComplete('REQUIRED_LESSONS', null, lessons, completedRequired),
      true,
    );

    const completedOneRequired = new Set(['a']);
    assert.equal(
      computeEnrollmentProgress('REQUIRED_LESSONS', null, lessons, completedOneRequired),
      50,
    );
  });

  it('honors percentage thresholds', () => {
    const completed = new Set(['a', 'b']);
    assert.equal(computeEnrollmentProgress('PERCENTAGE', 50, lessons, completed), 100);
    assert.equal(isEnrollmentComplete('PERCENTAGE', 50, lessons, completed), true);

    const partial = new Set(['a']);
    assert.equal(computeEnrollmentProgress('PERCENTAGE', 50, lessons, partial), 50);
    assert.equal(isEnrollmentComplete('PERCENTAGE', 50, lessons, partial), false);
  });

  it('returns zero when there are no lessons', () => {
    assert.equal(computeEnrollmentProgress('ALL_LESSONS', null, [], new Set()), 0);
  });
});
