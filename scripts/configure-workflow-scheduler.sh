#!/usr/bin/env bash
set -euo pipefail

# Idempotently create/update the hourly automation scheduler. Dry-run is the
# default; pass --apply explicitly after reviewing the target project.
MODE="${1:---dry-run}"
PROJECT_ID="${GCP_PROJECT_ID:-tenderbriefing-34679}"
LOCATION="${SCHEDULER_LOCATION:-europe-west1}"
JOB_NAME="${AUTOMATION_SCHEDULER_JOB:-tenderbriefing-workflow-automation-hourly}"
URI="${AUTOMATION_URI:-https://www.tenderbriefing.co.za/api/automation/run}"
SCHEDULE="${AUTOMATION_SCHEDULE:-0 * * * *}"
TIME_ZONE="${AUTOMATION_TIME_ZONE:-Africa/Johannesburg}"
SECRET_NAME="${AUTOMATION_SECRET_NAME:-tenderbriefing-sync-secret}"

if [[ "$MODE" != "--dry-run" && "$MODE" != "--apply" ]]; then
  echo "Usage: $0 [--dry-run|--apply]" >&2
  exit 2
fi

echo "project=$PROJECT_ID location=$LOCATION job=$JOB_NAME"
echo "uri=$URI schedule=$SCHEDULE timezone=$TIME_ZONE attemptDeadline=300s retryCount=2"
if [[ "$MODE" == "--dry-run" ]]; then
  echo "Dry run only. No scheduler or secret changes were made."
  exit 0
fi

SYNC_SECRET="$(gcloud secrets versions access latest \
  --secret="$SECRET_NAME" \
  --project="$PROJECT_ID")"
trap 'unset SYNC_SECRET' EXIT

COMMON_ARGS=(
  "--project=$PROJECT_ID"
  "--location=$LOCATION"
  "--schedule=$SCHEDULE"
  "--time-zone=$TIME_ZONE"
  "--uri=$URI"
  "--http-method=POST"
  "--headers=Content-Type=application/json,x-sync-secret=$SYNC_SECRET"
  '--message-body={"job":"all"}'
  "--attempt-deadline=300s"
  "--max-retry-attempts=2"
  "--min-backoff=30s"
  "--max-backoff=120s"
)

if gcloud scheduler jobs describe "$JOB_NAME" \
  --project="$PROJECT_ID" \
  --location="$LOCATION" >/dev/null 2>&1; then
  gcloud scheduler jobs update http "$JOB_NAME" "${COMMON_ARGS[@]}"
else
  gcloud scheduler jobs create http "$JOB_NAME" "${COMMON_ARGS[@]}"
fi

echo "Scheduler configuration applied. Header value was not printed."
