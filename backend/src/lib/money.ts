export const TRAINING_CURRENCIES = ['USD', 'MMK'] as const;
export type TrainingCurrency = (typeof TRAINING_CURRENCIES)[number];

/** ISO 4217 minor-unit exponent (USD cents = 2, MMK uses whole kyats = 0). */
export const CURRENCY_MINOR_UNITS: Record<TrainingCurrency, number> = {
  USD: 2,
  MMK: 0,
};

export function parseTrainingCurrency(value: unknown, fallback: TrainingCurrency = 'MMK'): TrainingCurrency {
  return value === 'USD' || value === 'MMK' ? value : fallback;
}

export function majorToMinor(amount: number, currency: TrainingCurrency): number {
  const factor = 10 ** CURRENCY_MINOR_UNITS[currency];
  return Math.round(amount * factor);
}

export function minorToMajor(minor: number, currency: TrainingCurrency): number {
  const factor = 10 ** CURRENCY_MINOR_UNITS[currency];
  return minor / factor;
}

export function formatMoney(minor: number, currency: TrainingCurrency, locale = 'en-US'): string {
  const major = minorToMajor(minor, currency);
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: CURRENCY_MINOR_UNITS[currency],
    maximumFractionDigits: CURRENCY_MINOR_UNITS[currency],
  }).format(major);
}

export function resolveDefaultTrainingCostMinor(settings: Record<string, unknown>): number {
  if (typeof settings.defaultTrainingCostMinor === 'number') return settings.defaultTrainingCostMinor;
  if (typeof settings.defaultTrainingCostCents === 'number') return settings.defaultTrainingCostCents;
  return 0;
}
