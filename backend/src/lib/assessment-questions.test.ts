import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildQuestionData,
  computeAttemptScore,
  gradeAnswer,
  normalizeText,
  questionToAttemptSnapshot,
  shuffle,
  snapshotToQuestionRow,
} from './assessment-questions';

describe('assessment-questions', () => {
  it('shuffle uses all items', () => {
    const input = [1, 2, 3, 4, 5];
    const out = shuffle(input);
    assert.equal(out.length, input.length);
    assert.deepEqual([...out].sort(), input);
  });

  it('questionToAttemptSnapshot shuffles option order', () => {
    const options = [
      { id: 'a', text: 'A' },
      { id: 'b', text: 'B' },
      { id: 'c', text: 'C' },
      { id: 'd', text: 'D' },
    ];
    const snapshots = Array.from({ length: 12 }, () =>
      questionToAttemptSnapshot({
        id: 'q1',
        question: 'Pick one',
        type: 'MCQ',
        options,
        correctOptionId: 'a',
        orderIndex: 0,
      }),
    );
    const firstOrders = snapshots.map((s) =>
      (s.options as Array<{ id: string }>).map((o) => o.id).join(','),
    );
    const unique = new Set(firstOrders);
    assert.ok(unique.size > 1, 'expected at least one different option order across draws');
    assert.ok(
      snapshots.every((s) => 'correctOptionId' in s && s.correctOptionId === 'a'),
      'correct option id must stay stable when shuffling',
    );
  });

  it('grades fill-blank with normalized answers', () => {
    const built = buildQuestionData({
      prompt: 'Capital',
      type: 'FILL_BLANK',
      blanks: [{ acceptableAnswers: ['Paris', 'paris'] }],
    });
    const snapshot = questionToAttemptSnapshot({
      id: 'q1',
      question: built.question,
      type: built.type,
      options: built.options,
      metadata: built.metadata,
      orderIndex: 0,
    });
    const row = snapshotToQuestionRow(snapshot);
    assert.equal(
      gradeAnswer(row, { blanks: [{ blankId: Object.keys(row.correctBlanks!)[0]!, text: ' PARIS ' }] }),
      true,
    );
  });

  it('grades matching pairs from snapshot', () => {
    const built = buildQuestionData({
      prompt: 'Match animals',
      type: 'MATCHING',
      pairs: [
        { left: 'Cat', right: 'Meow' },
        { left: 'Dog', right: 'Woof' },
      ],
    });
    const snapshot = questionToAttemptSnapshot({
      id: 'q1',
      question: built.question,
      type: built.type,
      options: built.options,
      metadata: built.metadata,
      orderIndex: 0,
    });
    const row = snapshotToQuestionRow(snapshot);
    const matches = Object.entries(row.correctMatches ?? {}).map(([leftId, rightId]) => ({
      leftId,
      rightId,
    }));
    assert.equal(gradeAnswer(row, { matches }), true);
    assert.equal(
      gradeAnswer(row, {
        matches: matches.map((m, i) => (i === 0 ? { ...m, rightId: 'wrong' } : m)),
      }),
      false,
    );
  });

  it('computeAttemptScore uses weighted points', () => {
    const result = computeAttemptScore(
      [
        { id: 'q1', type: 'MCQ', points: 2, correctOptionId: 'a' },
        { id: 'q2', type: 'MCQ', points: 1, correctOptionId: 'b' },
      ],
      [
        { questionId: 'q1', optionId: 'a' },
        { questionId: 'q2', optionId: 'x' },
      ],
    );
    assert.equal(result.score, 67);
    assert.equal(result.pendingReview, 0);
  });

  it('normalizeText lowercases and trims', () => {
    assert.equal(normalizeText('  Hello   World '), 'hello world');
  });
});
