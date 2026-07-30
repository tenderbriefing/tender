#!/usr/bin/env bash
# Ensure Cloud Run can read the existing Resend API key from GCP Secret Manager.
# Does NOT create or overwrite secret values — secret `Resend_API` must already exist.
#
# Usage:
#   bash scripts/resend-secret-manager-setup.sh
#   CLOUD_RUN_SA=9058655644-compute@developer.gserviceaccount.com bash scripts/resend-secret-manager-setup.sh
set -euo pipefail

PROJECT="${GCP_PROJECT:-tenderbriefing-34679}"
SA="${CLOUD_RUN_SA:-9058655644-compute@developer.gserviceaccount.com}"
SECRET_NAME="Resend_API"

if ! gcloud secrets describe "$SECRET_NAME" --project="$PROJECT" >/dev/null 2>&1; then
  echo "Missing GSM secret '$SECRET_NAME' in project $PROJECT." >&2
  echo "Create it in Secret Manager (value = Resend API key), then re-run." >&2
  exit 1
fi

gcloud secrets add-iam-policy-binding "$SECRET_NAME" \
  --member="serviceAccount:${SA}" \
  --role="roles/secretmanager.secretAccessor" \
  --project="$PROJECT" >/dev/null

echo "Granted secretAccessor on $SECRET_NAME to $SA"
echo "cloudbuild.yaml maps RESEND_API_KEY=${SECRET_NAME}:latest"
echo "Redeploy Cloud Run: gcloud builds submit --config cloudbuild.yaml --project=$PROJECT --region=africa-south1"
