import type { CompletionMode } from '@prisma/client';
import { AppError } from '../errors/app-error';

export function assertValidCompletionSettings(
  mode: CompletionMode,
  completionPercent: number | null | undefined,
): void {
  if (mode === 'PERCENTAGE' && (completionPercent == null || completionPercent < 1 || completionPercent > 100)) {
    throw AppError.from('VALIDATION_ERROR', 'Set a completion percentage between 1 and 100.');
  }
}
