export type CertExpiryThreshold = {
  /** Inclusive upper bound on daysLeft (e.g. 90). */
  upper: number;
  /** Exclusive lower bound on daysLeft (e.g. 30 → matches 31..90). Use -Infinity for expired. */
  lower: number;
  kind: string;
  notificationKind: 'CERT_EXPIRING' | 'CERT_EXPIRED';
  /** Display / email label for remaining days when still valid. */
  labelDays: number;
};

/**
 * Windows (not exact-day equality) so a missed cron day still delivers the notice.
 * Claims should be once per kind per certificate (not once per calendar day).
 */
export const CERT_EXPIRY_THRESHOLDS: CertExpiryThreshold[] = [
  { upper: 90, lower: 30, kind: 'cert_expiring_90', notificationKind: 'CERT_EXPIRING', labelDays: 90 },
  { upper: 30, lower: 7, kind: 'cert_expiring_30', notificationKind: 'CERT_EXPIRING', labelDays: 30 },
  { upper: 7, lower: -1, kind: 'cert_expiring_7', notificationKind: 'CERT_EXPIRING', labelDays: 7 },
  { upper: -1, lower: Number.NEGATIVE_INFINITY, kind: 'cert_expired', notificationKind: 'CERT_EXPIRED', labelDays: 0 },
];

export function matchesCertExpiryThreshold(daysLeft: number, threshold: CertExpiryThreshold): boolean {
  return daysLeft <= threshold.upper && daysLeft > threshold.lower;
}

/** Pick at most one matching threshold (narrowest / most urgent first by list order). */
export function selectCertExpiryThreshold(
  daysLeft: number,
  thresholds: CertExpiryThreshold[] = CERT_EXPIRY_THRESHOLDS,
): CertExpiryThreshold | null {
  for (const threshold of thresholds) {
    if (matchesCertExpiryThreshold(daysLeft, threshold)) return threshold;
  }
  return null;
}
