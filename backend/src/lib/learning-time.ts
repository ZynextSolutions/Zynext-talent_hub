type ProgressTimeRow = {
  watchedSeconds: number;
  positionSeconds: number;
  completed: boolean;
  lesson: { durationSeconds: number | null };
};

/** Prefer accumulated watch time; fall back to playback position or lesson duration. */
export function progressLearningSeconds(row: ProgressTimeRow): number {
  if (row.watchedSeconds > 0) return row.watchedSeconds;
  if (row.completed && row.lesson.durationSeconds) return row.lesson.durationSeconds;
  return row.positionSeconds;
}

/** Cap per-update delta to reduce seek/spoof inflation. */
export function accumulateWatchedSeconds(existingWatched: number, prevPosition: number, nextPosition: number): number {
  const delta = Math.max(0, nextPosition - prevPosition);
  const capped = Math.min(delta, 120);
  return existingWatched + capped;
}

export function roundHours(seconds: number): number {
  return Math.round((seconds / 3600) * 10) / 10;
}
