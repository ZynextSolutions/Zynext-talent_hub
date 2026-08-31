import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildAttemptReviewItems, isReviewableAttempt } from './assessment-review';

describe('assessment-review', () => {
  it('isReviewableAttempt accepts scored attempts', () => {
    assert.equal(isReviewableAttempt({ score: 80, gradingStatus: 'AUTO_GRADED' }), true);
  });

  it('isReviewableAttempt rejects open attempts', () => {
    assert.equal(isReviewableAttempt({ score: null, gradingStatus: 'AUTO_GRADED' }), false);
  });

  it('buildAttemptReviewItems hides answer keys when showAnswers is false', () => {
    const items = buildAttemptReviewItems(
      {
        questionSnapshot: [
          {
            id: 'q1',
            prompt: 'Pick A',
            type: 'MCQ',
            options: [
              { id: 'a', text: 'A' },
              { id: 'b', text: 'B' },
            ],
            correctOptionId: 'a',
          },
        ],
        answers: [{ questionId: 'q1', optionId: 'b' }],
      },
      false,
    );
    assert.equal(items.length, 1);
    assert.equal(items[0].correct, false);
    assert.equal(items[0].correctOptionId, undefined);
  });

  it('buildAttemptReviewItems includes answer keys when showAnswers is true', () => {
    const items = buildAttemptReviewItems(
      {
        questionSnapshot: [
          {
            id: 'q1',
            prompt: 'Pick A',
            type: 'MCQ',
            options: [
              { id: 'a', text: 'A' },
              { id: 'b', text: 'B' },
            ],
            correctOptionId: 'a',
          },
        ],
        answers: [{ questionId: 'q1', optionId: 'a' }],
      },
      true,
    );
    assert.equal(items[0].correct, true);
    assert.equal(items[0].correctOptionId, 'a');
  });
});
