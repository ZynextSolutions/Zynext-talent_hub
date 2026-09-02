import type { LessonKind } from '@prisma/client';

export const VIDEO_WATCH_RATIO = 0.9;
export const READING_DWELL_MS_PROD = 10_000;
export const SCORM_MIN_SESSION_SECONDS = 120;

const EXTERNAL_VIDEO_HOSTS = new Set([
  'youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtube-nocookie.com',
  'youtu.be',
  'vimeo.com',
  'player.vimeo.com',
]);

export function isExternalVideoUrl(url: string | null | undefined): boolean {
  if (!url?.trim()) return false;
  const trimmed = url.trim();
  if (trimmed.startsWith('/uploads/') || trimmed.includes('/media/uploads/')) return false;
  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname.replace(/^www\./, '').toLowerCase();
    return EXTERNAL_VIDEO_HOSTS.has(host);
  } catch {
    return false;
  }
}

/** SCORM 1.2 CMI session time: HHHH:MM:SS.SS */
export function parseScormSessionTime(value: string | null | undefined): number {
  if (!value?.trim()) return 0;
  const match = value.trim().match(/^(\d{2,4}):(\d{2}):(\d{2})(?:\.(\d{1,2}))?$/);
  if (!match) return 0;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = Number(match[3]);
  const frac = match[4] ? Number(`0.${match[4]}`) : 0;
  if (![hours, minutes, seconds].every((n) => Number.isFinite(n))) return 0;
  return hours * 3600 + minutes * 60 + seconds + frac;
}

export function scormMinSessionSeconds(durationSeconds: number | null | undefined): number {
  if (durationSeconds && durationSeconds > 0) {
    return Math.min(SCORM_MIN_SESSION_SECONDS, Math.max(1, Math.floor(durationSeconds * 0.5)));
  }
  return SCORM_MIN_SESSION_SECONDS;
}

export function readingDwellMs(isProd: boolean): number {
  return isProd ? READING_DWELL_MS_PROD : 0;
}

export type LessonCompletionInput = {
  kind: LessonKind;
  videoUrl?: string | null;
  durationSeconds?: number | null;
  watchedSeconds: number;
  openedAt: Date | null;
  now: Date;
  isProd: boolean;
};

export type LessonCompletionResult =
  | { ok: true }
  | { ok: false; reason: string };

export function learnerMayCompleteLesson(input: LessonCompletionInput): LessonCompletionResult {
  const { kind } = input;
  if (kind === 'ILT' || kind === 'VILT') {
    return { ok: false, reason: 'Instructor attendance is required to complete this lesson.' };
  }
  if (kind === 'SCORM') {
    return { ok: false, reason: 'SCORM lessons complete through the package, not this action.' };
  }
  if (kind === 'QUIZ') {
    return { ok: false, reason: 'Complete the quiz assessment to finish this lesson.' };
  }

  if (kind === 'VIDEO') {
    const duration = input.durationSeconds;
    if (!duration || duration <= 0) {
      return { ok: false, reason: 'This video lesson has no duration configured.' };
    }
    const needed = Math.ceil(duration * VIDEO_WATCH_RATIO);
    if (isExternalVideoUrl(input.videoUrl)) {
      if (!input.openedAt) {
        return { ok: false, reason: 'Open the video before marking it complete.' };
      }
      const elapsed = Math.floor((input.now.getTime() - input.openedAt.getTime()) / 1000);
      if (elapsed < needed) {
        return {
          ok: false,
          reason: `Watch at least ${needed} seconds of this video before completing.`,
        };
      }
      return { ok: true };
    }
    if (input.watchedSeconds < needed) {
      return {
        ok: false,
        reason: `Watch at least ${needed} seconds of this video before completing.`,
      };
    }
    return { ok: true };
  }

  if (kind === 'READING' || kind === 'DOCUMENT' || kind === 'DISCUSSION') {
    if (!input.openedAt) {
      return { ok: false, reason: 'Open the lesson before marking it complete.' };
    }
    const dwell = readingDwellMs(input.isProd);
    if (input.now.getTime() - input.openedAt.getTime() < dwell) {
      return { ok: false, reason: 'Spend a little more time on this lesson before completing.' };
    }
    return { ok: true };
  }

  return { ok: false, reason: 'This lesson cannot be marked complete this way.' };
}

export function assertVideoLessonsHaveDuration(
  lessons: Array<{ kind: LessonKind; durationSeconds: number | null }>,
): string | null {
  const missing = lessons.filter(
    (lesson) => lesson.kind === 'VIDEO' && (!lesson.durationSeconds || lesson.durationSeconds <= 0),
  );
  if (!missing.length) return null;
  return 'Set a duration on every VIDEO lesson before publishing.';
}

export function assertQuizLessonsHaveAssessment(
  lessons: Array<{
    kind: LessonKind;
    moduleQuiz?: { id: string } | null;
    quizAssessmentId?: string | null;
  }>,
): string | null {
  const missing = lessons.filter((lesson) => {
    if (lesson.kind !== 'QUIZ') return false;
    return !(lesson.quizAssessmentId || lesson.moduleQuiz?.id);
  });
  if (!missing.length) return null;
  return 'Link a module quiz assessment to every QUIZ lesson before publishing.';
}
