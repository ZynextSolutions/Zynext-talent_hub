#!/bin/sh
# Railway cron entrypoint — calls all platform job endpoints on the private API.
# Continues after individual failures so one bad job does not skip the rest.
set -u

: "${JOB_SECRET:?JOB_SECRET is required}"
: "${API_HOST:?API_HOST is required}"
: "${API_PORT:?API_PORT is required}"
: "${ORGANIZATION_ID:?ORGANIZATION_ID is required}"

BASE="http://${API_HOST}:${API_PORT}/api/v1/jobs"
fail=0

for path in reminders recertify scheduled-reports cert-expiry analytics-snapshots; do
  echo "[cron] POST ${path}"
  if curl -fsS -X POST \
    "${BASE}/${path}?organizationId=${ORGANIZATION_ID}" \
    -H "X-Job-Secret: ${JOB_SECRET}"; then
    echo
    echo "[cron] ${path} ok"
  else
    echo
    echo "[cron] ${path} FAILED" >&2
    fail=1
  fi
done

echo "[cron] done"
exit "${fail}"
