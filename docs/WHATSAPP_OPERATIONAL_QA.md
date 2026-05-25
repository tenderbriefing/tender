# WhatsApp operational QA (Phase 5A)

Run on a machine with network access and Twilio sandbox joined on your phone.

## Prerequisites

1. Twilio sandbox joined (send join code to `whatsapp:+14155238886` from your phone).
2. Secret Manager secrets exist and Cloud Run has accessor IAM (see `docs/TWILIO_WHATSAPP_SETUP.md`).
3. Local `.env.local` **optional** for CLI tests — use GSM values only on your machine; never commit.

## 1. Integration health

```bash
curl -sS https://www.tenderbriefing.co.za/api/integrations/health \
  | jq '.integrations[] | select(.id=="twilio-whatsapp")'
```

**Expected:** `"status": "configured"`, `from` masked (e.g. `whatsapp:+14155238886***`).

## 2. Runtime secrets (no values printed)

```bash
gcloud run services describe tenderbriefing \
  --region=africa-south1 \
  --project=tenderbriefing-34679 \
  --format="yaml(spec.template.spec.containers[0].env)" | grep TWILIO
```

**Expected:** `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM` each with `valueFrom.secretKeyRef`.

```bash
for s in TWILIO_ACCOUNT_SID TWILIO_AUTH_TOKEN TWILIO_WHATSAPP_FROM; do
  gcloud secrets versions list "$s" --project=tenderbriefing-34679 --limit=1
done
```

**Expected:** version `1` state `enabled`.

## 3. Firestore `notifications` (WhatsApp channel)

```bash
STORAGE_ADAPTER=firestore FIREBASE_PROJECT_ID=tenderbriefing-34679 \
GOOGLE_APPLICATION_CREDENTIALS=./service-account.json \
npm run qa:whatsapp
```

Or Firebase Console → `notifications` → filter `channel == whatsapp`.

**Fields:** `type`, `recipientRole`, `recipientId`, `channel: whatsapp`, `message`, `status`, `createdAt`, `sentAt`, `error`, `metadata`.

## 4. Admin test API

Sign in as **admin** in the app, open `/admin/integrations`, use **Send test WhatsApp** with your E.164 number.

Or:

```bash
# After obtaining a Firebase ID token for an admin user (do not log the token)
curl -sS -X POST https://www.tenderbriefing.co.za/api/notifications/test-whatsapp \
  -H "Authorization: Bearer YOUR_ID_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"phone":"+27XXXXXXXXX","message":"TenderBriefing QA test"}'
```

**Expected:** `success: true`, Firestore log `status: sent`.

## 5. CLI test

```bash
TEST_WHATSAPP_TO=+27XXXXXXXXX npm run test:whatsapp
```

Replace with your sandbox-joined mobile number only.

## 6. Admin metrics

```bash
# As admin Bearer token
curl -sS https://www.tenderbriefing.co.za/api/admin/whatsapp-metrics \
  -H "Authorization: Bearer YOUR_ID_TOKEN" | jq '.data | {configured,sent,failed,pending,lastSentAt}'
```

## 7. End-to-end workflow

| Step | WhatsApp template | Requires |
|------|-------------------|----------|
| SME creates attendance request | `sme_attendance_submitted` | SME `phoneNumber` on `users`/`smes` |
| Payment confirmed | `agent_payment_confirmed` | Paid request + agent phone |
| Agent accepts | `sme_agent_assigned`, `agent_request_accepted` | Assigned agent |
| Report uploaded | `sme_report_uploaded`, `admin_report_uploaded` | SME + admin phones |

**Note:** Unpaid requests (`paymentStatus: pending`) do not notify agents via WhatsApp until paid.

## 8. Duplicate prevention & rate limit

- Same `idempotencyKey` within 10 minutes → duplicate skipped.
- More than 3 messages/minute per recipient → rate limit error logged as `failed`.

## 9. Full smoke

```bash
npm run smoke:production
```

Checks `twilio-whatsapp` appears in `/api/integrations/health` (no secret leak).

## Operational readiness checklist

| Check | Pass criteria |
|-------|----------------|
| Twilio configured on production | Health `configured` |
| Secrets mounted on Cloud Run | Three TWILIO env refs |
| Logging pipeline | `notifications` docs with `channel: whatsapp` |
| Live send | Test message `status: sent` |
| User phones | SMEs/agents have `phoneNumber` in Firestore |
| Workflow | Paid request → agent notify → accept → report |
