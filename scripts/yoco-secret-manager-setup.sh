#!/usr/bin/env bash
# TenderBriefing — Yoco Secret Manager setup (prepare only; paste secrets locally, never commit).
# Project: tenderbriefing-34679
# Usage: review commands, then run each step manually after replacing placeholders.

set -euo pipefail

PROJECT=tenderbriefing-34679
REGION=africa-south1
SERVICE=tenderbriefing
RUN_SA="serviceAccount:9058655644-compute@developer.gserviceaccount.com"

echo "=== 1. Create secrets (idempotent — ignore error if already exists) ==="
gcloud secrets create yoco-secret-key \
  --project="${PROJECT}" \
  --replication-policy=automatic || true

gcloud secrets create yoco-webhook-secret \
  --project="${PROJECT}" \
  --replication-policy=automatic || true

echo ""
echo "=== 2. Add secret versions (replace placeholders; do not log output) ==="
echo "# Run locally after copying keys from Yoco Dashboard:"
echo "printf '%s' 'PASTE_YOCO_SECRET_KEY_HERE' | gcloud secrets versions add yoco-secret-key \\"
echo "  --project=${PROJECT} \\"
echo "  --data-file=-"
echo ""
echo "printf '%s' 'PASTE_YOCO_WEBHOOK_SECRET_HERE' | gcloud secrets versions add yoco-webhook-secret \\"
echo "  --project=${PROJECT} \\"
echo "  --data-file=-"

echo ""
echo "=== 3. Grant Cloud Run service account access ==="
gcloud secrets add-iam-policy-binding yoco-secret-key \
  --project="${PROJECT}" \
  --member="${RUN_SA}" \
  --role="roles/secretmanager.secretAccessor"

gcloud secrets add-iam-policy-binding yoco-webhook-secret \
  --project="${PROJECT}" \
  --member="${RUN_SA}" \
  --role="roles/secretmanager.secretAccessor"

echo ""
echo "=== 4. Map secrets to Cloud Run (after versions exist) ==="
gcloud run services update "${SERVICE}" \
  --region="${REGION}" \
  --project="${PROJECT}" \
  --set-secrets=YOCO_SECRET_KEY=yoco-secret-key:latest,YOCO_WEBHOOK_SECRET=yoco-webhook-secret:latest \
  --update-env-vars=NEXT_PUBLIC_ATTENDANCE_FEE_CENTS=24900,NEXT_PUBLIC_ATTENDANCE_FEE_LABEL=R249.00

echo ""
echo "=== 5. Verify (no secret values printed) ==="
echo "curl -sS https://www.tenderbriefing.co.za/api/integrations/health | jq '.integrations[] | select(.id==\"yoco\") | {name,status,missing}'"
echo ""
echo "Webhook URL for Yoco portal:"
echo "https://www.tenderbriefing.co.za/api/webhooks/yoco"
