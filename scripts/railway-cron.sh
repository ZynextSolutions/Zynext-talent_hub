#!/bin/sh
# Railway cron entrypoint — calls all platform job endpoints on the private API.
set -eu

: "${JOB_SECRET:?JOB_SECRET is required}"
: "${API_HOST:?API_HOST is required}"
: "${API_PORT:?API_PORT is required}"
: "${ORGANIZATION_ID:?ORGANIZATION_ID is required}"

BASE="http://${API_HOST}:${API_PORT}/api/v1/jobs"

for path in reminders recertify scheduled-reports cert-expiry analytics-snapshots; do
  echo "[cron] POST ${path}"
  curl -fsS -X POST \
    "${BASE}/${path}?organizationId=${ORGANIZATION_ID}" \
    -H "X-Job-Secret: ${JOB_SECRET}"
  echo
done

echo "[cron] done"
