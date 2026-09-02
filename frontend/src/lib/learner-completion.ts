import type { Lesson, LessonProgress } from "@/types";

const VIDEO_WATCH_RATIO = 0.9;

/** Mirrors backend `READING_DWELL_MS_PROD` — enforced when `isProd` is true. */
export const READING_DWELL_MS_PROD = 10_000;

export function readingDwellMs(isProd: boolean): number {
  return isProd ? READING_DWELL_MS_PROD : 0;
}

/** Client mirror of backend prod detection for completion gates. */
export function isCompletionProdEnv(): boolean {
  return process.env.NODE_ENV === "production";
}

const EXTERNAL_VIDEO_HOSTS = new Set([
  "youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtube-nocookie.com",
  "youtu.be",
  "vimeo.com",
  "player.vimeo.com",
]);

export function isExternalVideoUrl(url: string | null | undefined): boolean {
  if (!url?.trim()) return false;
  const trimmed = url.trim();
  if (trimmed.startsWith("/uploads/") || trimmed.includes("/media/uploads/")) return false;
  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname.replace(/^www\./, "").toLowerCase();
    return EXTERNAL_VIDEO_HOSTS.has(host);
  } catch {
    return false;
  }
}

export type LearnerCompletionCheck = {
  ok: boolean;
  reason?: string;
};

/**
 * Mirrors backend learnerMayCompleteLesson for enabling the Complete button.
 * External embeds (YouTube/Vimeo) use wall-clock time since openedAt — they cannot report watchedSeconds.
 */
export function learnerCompletionCheck(
  lesson:
    | (Pick<Lesson, "kind" | "durationSeconds"> & { videoUrl?: string | null })
    | undefined,
  progress: Pick<LessonProgress, "watchedSeconds" | "openedAt" | "completed"> | undefined,
  nowMs: number = Date.now(),
  isProd: boolean = isCompletionProdEnv(),
): LearnerCompletionCheck {
  if (!lesson) return { ok: false, reason: "No lesson selected." };
  if (progress?.completed) return { ok: true };
  if (lesson.kind === "SCORM") {
    return { ok: false, reason: "Finish the SCORM package to complete this lesson." };
  }
  if (lesson.kind === "ILT" || lesson.kind === "VILT") {
    return { ok: false, reason: "Instructor attendance is required." };
  }
  if (lesson.kind === "QUIZ") {
    return { ok: false, reason: "Complete the quiz assessment to finish this lesson." };
  }

  if (lesson.kind === "VIDEO") {
    const duration = lesson.durationSeconds ?? 0;
    if (duration <= 0) {
      return { ok: false, reason: "This video has no duration set. Ask an admin to fix the lesson." };
    }
    const needed = Math.ceil(duration * VIDEO_WATCH_RATIO);
    if (isExternalVideoUrl(lesson.videoUrl)) {
      if (!progress?.openedAt) {
        return { ok: false, reason: "Open the video, then wait before completing." };
      }
      const openedMs = Date.parse(progress.openedAt);
      if (!Number.isFinite(openedMs)) {
        return { ok: false, reason: "Open the video, then wait before completing." };
      }
      const elapsed = Math.floor((nowMs - openedMs) / 1000);
      if (elapsed < needed) {
        const left = needed - elapsed;
        return {
          ok: false,
          reason: `Watch for about ${left}s more before completing (YouTube/Vimeo).`,
        };
      }
      return { ok: true };
    }
    const watched = progress?.watchedSeconds ?? 0;
    if (watched < needed) {
      const left = needed - watched;
      return {
        ok: false,
        reason: `Watch at least ${needed}s (${left}s left) before completing.`,
      };
    }
    return { ok: true };
  }

  if (lesson.kind === "READING" || lesson.kind === "DOCUMENT" || lesson.kind === "DISCUSSION") {
    if (!progress?.openedAt) {
      return { ok: false, reason: "Open the lesson before completing." };
    }
    const dwell = readingDwellMs(isProd);
    if (dwell > 0) {
      const openedMs = Date.parse(progress.openedAt);
      if (!Number.isFinite(openedMs)) {
        return { ok: false, reason: "Open the lesson before completing." };
      }
      const elapsed = nowMs - openedMs;
      if (elapsed < dwell) {
        const left = Math.ceil((dwell - elapsed) / 1000);
        return {
          ok: false,
          reason: `Spend about ${left}s more on this lesson before completing.`,
        };
      }
    }
    return { ok: true };
  }

  return { ok: false, reason: "This lesson cannot be marked complete this way." };
}

export function learnerCanMarkComplete(
  lesson:
    | (Pick<Lesson, "kind" | "durationSeconds"> & { videoUrl?: string | null })
    | undefined,
  progress: Pick<LessonProgress, "watchedSeconds" | "openedAt" | "completed"> | undefined,
  nowMs?: number,
  isProd?: boolean,
): boolean {
  return learnerCompletionCheck(lesson, progress, nowMs, isProd).ok;
}
