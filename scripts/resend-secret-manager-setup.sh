#!/usr/bin/env bash
# Ensure Cloud Run can read the Resend API key from GCP Secret Manager.
# Secret name: TENDERBRIEFING_API (maps to RESEND_API_KEY in cloudbuild.yaml).
#
# Usage:
#   bash scripts/resend-secret-manager-setup.sh
#   CLOUD_RUN_SA=9058655644-compute@developer.gserviceaccount.com bash scripts/resend-secret-manager-setup.sh
set -euo pipefail

PROJECT="${GCP_PROJECT:-tenderbriefing-34679}"
SA="${CLOUD_RUN_SA:-9058655644-compute@developer.gserviceaccount.com}"
SECRET_NAME="TENDERBRIEFING_API"

if ! gcloud secrets describe "$SECRET_NAME" --project="$PROJECT" >/dev/null 2>&1; then
  echo "Missing GSM secret '$SECRET_NAME' in project $PROJECT." >&2
  echo "Create it in Secret Manager (value = Resend API key), then re-run." >&2
  exit 1
fi

gcloud secrets add-iam-policy-binding "$SECRET_NAME" \
  --member="serviceAccount:${SA}" \
  --role="roles/secretmanager.secretAccessor" \
  --project="$PROJECT" >/dev/null

# Optional webhook signing secret (if used by future Resend webhook routes)
if gcloud secrets describe webhook --project="$PROJECT" >/dev/null 2>&1; then
  gcloud secrets add-iam-policy-binding webhook \
    --member="serviceAccount:${SA}" \
    --role="roles/secretmanager.secretAccessor" \
    --project="$PROJECT" >/dev/null || true
fi

echo "Granted secretAccessor on $SECRET_NAME to $SA"
echo "cloudbuild.yaml maps RESEND_API_KEY=${SECRET_NAME}:latest"
echo "Redeploy Cloud Run: gcloud builds submit --config cloudbuild.yaml --project=$PROJECT --region=africa-south1"
