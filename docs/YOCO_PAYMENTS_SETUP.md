# Yoco payments — attendance support fee

TenderBriefing charges SMEs **R249.00** (`24900` cents, ZAR) via Yoco when they request Youth Agent attendance at a compulsory tender briefing. Youth Agents only see requests after payment is confirmed (`paymentStatus: paid`). Legacy requests may use `not_required`.

**Never print, commit, or paste secret keys into chat, docs, or git.**

---

## 1. Create a Yoco account

1. Sign up at [https://www.yoco.com/](https://www.yoco.com/).
2. Use **test keys** (`sk_test_…`) for staging and verification.
3. Switch to **live keys** (`sk_live_…`) only after test checkout + webhook are verified.

---

## 2. Secret key and webhook secret

| Credential | Where to get it |
|------------|-----------------|
| **Secret API key** | Yoco Dashboard → **Developers** → **API keys** |
| **Webhook signing secret** | Yoco Dashboard → **Developers** → **Webhooks** (when you create the endpoint) |

| Env var | Server only |
|---------|-------------|
| `YOCO_SECRET_KEY` | Checkout API |
| `YOCO_WEBHOOK_SECRET` | Verifies `POST /api/webhooks/yoco` |

Public display (safe on Cloud Run / client):

- `NEXT_PUBLIC_ATTENDANCE_FEE_CENTS=24900`
- `NEXT_PUBLIC_ATTENDANCE_FEE_LABEL=R249.00`

---

## 3. Webhook URL

Register in the Yoco portal:

```text
https://www.tenderbriefing.co.za/api/webhooks/yoco
```

Cloud Run direct URL (optional for pre-domain testing):

```text
https://tenderbriefing-xzgs5uw5ta-bq.a.run.app/api/webhooks/yoco
```

The handler matches `yocoCheckoutId` or `metadata.requestId`, updates `paymentStatus`, sets `paidAt`, and sends `payment_confirmed` / `payment_failed` notifications. If `YOCO_WEBHOOK_SECRET` is unset, signature verification is skipped with a logged warning; paid status still requires a verifiable checkout event where possible.

---

## 4. Google Secret Manager and Cloud Run

**Project:** `tenderbriefing-34679`  
**Region:** `africa-south1`  
**Service:** `tenderbriefing`  
**Cloud Run SA:** `9058655644-compute@developer.gserviceaccount.com`

| Secret name | Maps to |
|-------------|---------|
| `yoco-secret-key` | `YOCO_SECRET_KEY` |
| `yoco-webhook-secret` | `YOCO_WEBHOOK_SECRET` |

Prepared script (review before running; placeholders only):

```bash
bash scripts/yoco-secret-manager-setup.sh
```

Manual commands (do **not** commit real values):

```bash
gcloud secrets create yoco-secret-key \
  --project=tenderbriefing-34679 \
  --replication-policy=automatic

gcloud secrets create yoco-webhook-secret \
  --project=tenderbriefing-34679 \
  --replication-policy=automatic

printf '%s' 'PASTE_YOCO_SECRET_KEY_HERE' | gcloud secrets versions add yoco-secret-key \
  --project=tenderbriefing-34679 \
  --data-file=-

printf '%s' 'PASTE_YOCO_WEBHOOK_SECRET_HERE' | gcloud secrets versions add yoco-webhook-secret \
  --project=tenderbriefing-34679 \
  --data-file=-

gcloud secrets add-iam-policy-binding yoco-secret-key \
  --project=tenderbriefing-34679 \
  --member="serviceAccount:9058655644-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

gcloud secrets add-iam-policy-binding yoco-webhook-secret \
  --project=tenderbriefing-34679 \
  --member="serviceAccount:9058655644-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

gcloud run services update tenderbriefing \
  --region=africa-south1 \
  --project=tenderbriefing-34679 \
  --set-secrets=YOCO_SECRET_KEY=yoco-secret-key:latest,YOCO_WEBHOOK_SECRET=yoco-webhook-secret:latest \
  --update-env-vars=NEXT_PUBLIC_ATTENDANCE_FEE_CENTS=24900,NEXT_PUBLIC_ATTENDANCE_FEE_LABEL=R249.00
```

Verify (no secrets in output):

```bash
curl -sS https://www.tenderbriefing.co.za/api/integrations/health \
  | jq '.integrations[] | select(.id=="yoco") | {name,status,missing}'
```

---

## 5. Test payment flow (Yoco **test** keys)

1. Add test `YOCO_SECRET_KEY` and `YOCO_WEBHOOK_SECRET` to Secret Manager / Cloud Run.
2. Sign in as SME → compulsory tender → **Request Youth Agent**.
3. Redirect to Yoco hosted checkout; use Yoco test card details from their docs.
4. Success → `/sme/requests/payment-success?requestId=…`
5. Cancel/fail → `/sme/requests/payment-cancelled?requestId=…` (retry via **Pay R249.00 with Yoco**).
6. Confirm **Paid** on SME request detail; sign in as Youth Agent → request appears under `/jobs`.
7. Confirm webhook delivery in Yoco dashboard (200 from `/api/webhooks/yoco`).

---

## 6. Production payment flow (Yoco **live** keys)

1. Complete Yoco business verification.
2. Replace Secret Manager versions with **live** key and production webhook secret.
3. Update Yoco webhook URL to production domain (above).
4. Run one real R249 test with an internal SME account; confirm Firestore `paidAt` and agent visibility.
5. Monitor `/admin/operations` revenue metrics and unpaid queue.

---

## 7. Non-payment / pre-activation behavior

When `YOCO_SECRET_KEY` is **not** set:

| Behavior | Expected |
|----------|----------|
| Create attendance request | **Yes** — `paymentStatus: pending`, `paymentAmount: 24900` |
| API response | `success: true` + `payment.code: YOCO_NOT_CONFIGURED` (or retry endpoint `503` + same code) |
| SME UI | Request saved; toast explains payment not active; **retry** on My Requests |
| Youth Agents `/jobs` | Unpaid requests **hidden** |
| Agent accept API | Blocked with friendly JSON error |
| Admin `/admin/operations` | Sees all requests including unpaid; revenue may show **R0** |

Automated check:

```bash
npm run yoco:readiness
```

---

## 8. Firestore fields (`attendanceRequests`)

| Field | Example |
|-------|---------|
| `paymentStatus` | `pending`, `paid`, `failed`, `cancelled`, `refunded` |
| `paymentProvider` | `yoco` |
| `paymentAmount` | `24900` |
| `currency` | `ZAR` |
| `paymentReference` | `TB-REQ-{requestId}` |
| `yocoCheckoutId` | from Yoco |
| `yocoRedirectUrl` | hosted checkout URL |
| `paidAt` | ISO timestamp |
| `paymentFailureReason` | optional |

---

## 9. Smoke test (no live charge)

```bash
npm run smoke:production
```

Creates a request, asserts `paymentStatus: pending`, verifies agents cannot accept unpaid requests, then marks the **smoke test** request paid via Firebase Admin (`ops-smoke-sme@…` / `ops-smoke-agent@…` only). Does not call Yoco unless `YOCO_SECRET_KEY` is set in the environment running the script.

---

## 10. Rollback

If live payments must be disabled quickly:

1. **Remove or rotate** `YOCO_SECRET_KEY` on Cloud Run (unset secret mapping or deploy previous revision).
2. New requests remain **`pending`**; SMEs see retry/errors until keys are restored.
3. **Do not** delete paid requests; agents keep access to already-paid work.
4. Optional: set `paymentStatus: not_required` on specific legacy/test docs only via admin/Firestore (not for real SME traffic).
5. Redeploy previous Cloud Run revision if a code rollback is needed:

   ```bash
   gcloud run services update-traffic tenderbriefing \
     --to-revisions=PREVIOUS_REVISION=100 \
     --region=africa-south1 \
     --project=tenderbriefing-34679
   ```

6. Disable webhook in Yoco portal to stop retries while troubleshooting.

---

## 11. Deploy

```bash
gcloud builds submit --config cloudbuild.yaml \
  --project=tenderbriefing-34679 \
  --region=africa-south1
```
