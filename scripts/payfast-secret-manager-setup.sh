#!/usr/bin/env bash
# Create / update PayFast secrets in GCP Secret Manager (project tenderbriefing-34679).
# Usage:
#   PAYFAST_MERCHANT_ID=... PAYFAST_MERCHANT_KEY=... PAYFAST_PASSPHRASE=... bash scripts/payfast-secret-manager-setup.sh
set -euo pipefail

PROJECT="${GCP_PROJECT:-tenderbriefing-34679}"
SA="${CLOUD_RUN_SA:-}"

need() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    echo "Missing env $name" >&2
    exit 1
  fi
}

need PAYFAST_MERCHANT_ID
need PAYFAST_MERCHANT_KEY
need PAYFAST_PASSPHRASE

ensure_secret() {
  local secret="$1"
  local value="$2"
  if ! gcloud secrets describe "$secret" --project="$PROJECT" >/dev/null 2>&1; then
    gcloud secrets create "$secret" --replication-policy=automatic --project="$PROJECT"
  fi
  printf '%s' "$value" | gcloud secrets versions add "$secret" --data-file=- --project="$PROJECT"
  echo "Updated secret: $secret"
}

ensure_secret payfast-merchant-id "$PAYFAST_MERCHANT_ID"
ensure_secret payfast-merchant-key "$PAYFAST_MERCHANT_KEY"
ensure_secret payfast-passphrase "$PAYFAST_PASSPHRASE"

if [[ -n "$SA" ]]; then
  for secret in payfast-merchant-id payfast-merchant-key payfast-passphrase; do
    gcloud secrets add-iam-policy-binding "$secret" \
      --member="serviceAccount:${SA}" \
      --role="roles/secretmanager.secretAccessor" \
      --project="$PROJECT" >/dev/null
  done
  echo "Granted secretAccessor to $SA"
fi

echo "Done. Redeploy Cloud Run so PAYFAST_* secrets are mounted (gcloud builds submit --config cloudbuild.yaml)."
