# Yoco payments — attendance support fee

TenderBriefing charges SMEs **R249.00** (`24900` cents, ZAR) via Yoco when they request Youth Agent attendance at a compulsory tender briefing. Youth Agents only see requests after payment is confirmed.

---

## 1. Create a Yoco account

1. Sign up at [https://www.yoco.com/](https://www.yoco.com/).
2. Complete business verification for live payments (test mode works immediately with test keys).

---

## 2. API keys

1. Open **Yoco Dashboard** → **Developers** → **API keys**.
2. Copy the **secret key** (starts with `sk_test_` or `sk_live_`).
3. Create or copy a **webhook signing secret** for your webhook endpoint.

Never commit keys. Use `.env.local` locally and Google Secret Manager in production.

---

## 3. Environment variables

| Variable | Where | Description |
|----------|--------|-------------|
| `YOCO_SECRET_KEY` | Server only | Yoco secret API key |
| `YOCO_WEBHOOK_SECRET` | Server only | Verifies `POST /api/webhooks/yoco` |
| `NEXT_PUBLIC_ATTENDANCE_FEE_CENTS` | Client | `24900` (R249.00 in cents) |
| `NEXT_PUBLIC_ATTENDANCE_FEE_LABEL` | Client | Display label, e.g. `R249.00` |

Copy from `env.example` / `.env.local.example`.

---

## 4. Webhook URL

In the Yoco portal, register:

```text
https://www.tenderbriefing.co.za/api/webhooks/yoco
```

For Cloud Run testing before custom domain:

```text
https://tenderbriefing-xzgs5uw5ta-bq.a.run.app/api/webhooks/yoco
```

Events should include checkout/payment completion. The app updates `attendanceRequests` by `yocoCheckoutId` or `metadata.requestId`.

---

## 5. Google Secret Manager (production)

Project: `tenderbriefing-34679`

| Secret name | Env var |
|-------------|---------|
| `yoco-secret-key` | `YOCO_SECRET_KEY` |
| `yoco-webhook-secret` | `YOCO_WEBHOOK_SECRET` |

Create secrets in [Secret Manager](https://console.cloud.google.com/security/secret-manager?project=tenderbriefing-34679), then map them in Cloud Run (see `cloudbuild.yaml` / service YAML).

Public fee labels can stay as plain env vars on Cloud Run:

- `NEXT_PUBLIC_ATTENDANCE_FEE_CENTS=24900`
- `NEXT_PUBLIC_ATTENDANCE_FEE_LABEL=R249.00`

---

## 6. Deploy

```bash
gcloud builds submit --config cloudbuild.yaml \
  --project=tenderbriefing-34679 \
  --region=africa-south1
```

After deploy, confirm `GET /api/integrations/health` shows Yoco as configured (no secret values returned).

---

## 7. Test payment flow

1. Sign in as an SME.
2. Open a compulsory briefing tender → **Request Youth Agent**.
3. Submit the form — you should be redirected to Yoco checkout (test card in Yoco docs).
4. On success: `/sme/requests/payment-success?requestId=...`
5. On cancel: `/sme/requests/payment-cancelled?requestId=...` (retry payment available).
6. Confirm the request shows **Paid** under **My Attendance Requests**.
7. Sign in as a Youth Agent — the request should appear in opportunities only after paid.

**Without Yoco keys:** checkout returns `503` / `YOCO_NOT_CONFIGURED`; the request is still created as `paymentStatus: pending` and is not visible to agents.

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
| `paidAt` | ISO timestamp when paid |
| `paymentFailureReason` | optional error text |

Legacy requests may use `paymentStatus: not_required` (still visible to agents).

---

## 9. Smoke test (no live charge)

`npm run smoke:production` creates a request, asserts `paymentStatus: pending`, verifies agents cannot accept unpaid requests, then marks the request paid via Firebase Admin (test-only) before completing the agent workflow. Live Yoco is not called unless `YOCO_SECRET_KEY` is set.
