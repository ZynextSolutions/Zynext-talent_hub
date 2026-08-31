import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  assertVideoLessonsHaveDuration,
  isExternalVideoUrl,
  learnerMayCompleteLesson,
  parseScormSessionTime,
  scormMinSessionSeconds,
} from './lesson-completion';

describe('parseScormSessionTime', () => {
  it('parses HHHH:MM:SS', () => {
    assert.equal(parseScormSessionTime('0000:02:00'), 120);
    assert.equal(parseScormSessionTime('0001:01:01'), 3661);
    assert.equal(parseScormSessionTime(''), 0);
    assert.equal(parseScormSessionTime('bogus'), 0);
  });
});

describe('scormMinSessionSeconds', () => {
  it('uses 120s when duration is missing', () => {
    assert.equal(scormMinSessionSeconds(null), 120);
  });

  it('caps at 120s and uses half duration when shorter', () => {
    assert.equal(scormMinSessionSeconds(100), 50);
    assert.equal(scormMinSessionSeconds(400), 120);
  });
});

describe('isExternalVideoUrl', () => {
  it('detects youtube and vimeo', () => {
    assert.equal(isExternalVideoUrl('https://www.youtube.com/watch?v=abc'), true);
    assert.equal(isExternalVideoUrl('https://youtu.be/abc'), true);
    assert.equal(isExternalVideoUrl('https://vimeo.com/123'), true);
    assert.equal(isExternalVideoUrl('/uploads/courses/x/intro.mp4'), false);
  });
});

describe('learnerMayCompleteLesson', () => {
  const now = new Date('2026-09-01T12:00:00.000Z');

  it('blocks ILT, SCORM, and QUIZ for learners', () => {
    assert.equal(
      learnerMayCompleteLesson({
        kind: 'ILT',
        watchedSeconds: 0,
        openedAt: now,
        now,
        isProd: false,
      }).ok,
      false,
    );
    assert.equal(
      learnerMayCompleteLesson({
        kind: 'SCORM',
        watchedSeconds: 0,
        openedAt: now,
        now,
        isProd: false,
      }).ok,
      false,
    );
    assert.equal(
      learnerMayCompleteLesson({
        kind: 'QUIZ',
        watchedSeconds: 0,
        openedAt: now,
        now,
        isProd: false,
      }).ok,
      false,
    );
  });

  it('requires 90% watch time for uploaded video', () => {
    const denied = learnerMayCompleteLesson({
      kind: 'VIDEO',
      videoUrl: '/uploads/x.mp4',
      durationSeconds: 100,
      watchedSeconds: 80,
      openedAt: now,
      now,
      isProd: false,
    });
    assert.equal(denied.ok, false);

    const allowed = learnerMayCompleteLesson({
      kind: 'VIDEO',
      videoUrl: '/uploads/x.mp4',
      durationSeconds: 100,
      watchedSeconds: 90,
      openedAt: now,
      now,
      isProd: false,
    });
    assert.equal(allowed.ok, true);
  });

  it('requires a visit before completing a reading lesson', () => {
    const cold = learnerMayCompleteLesson({
      kind: 'READING',
      watchedSeconds: 0,
      openedAt: null,
      now,
      isProd: false,
    });
    assert.equal(cold.ok, false);

    const visited = learnerMayCompleteLesson({
      kind: 'READING',
      watchedSeconds: 0,
      openedAt: now,
      now,
      isProd: false,
    });
    assert.equal(visited.ok, true);
  });

  it('enforces dwell in production for reading lessons', () => {
    const openedAt = new Date(now.getTime() - 5_000);
    const tooSoon = learnerMayCompleteLesson({
      kind: 'READING',
      watchedSeconds: 0,
      openedAt,
      now,
      isProd: true,
    });
    assert.equal(tooSoon.ok, false);
  });
});

describe('assertVideoLessonsHaveDuration', () => {
  it('rejects published video lessons without duration', () => {
    assert.equal(
      assertVideoLessonsHaveDuration([{ kind: 'VIDEO', durationSeconds: null }]),
      'Set a duration on every VIDEO lesson before publishing.',
    );
    assert.equal(assertVideoLessonsHaveDuration([{ kind: 'READING', durationSeconds: null }]), null);
  });
});
