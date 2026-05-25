# WhatsApp operational QA (Phase 5A)

Run on a machine with network access to production. **Production API mode is recommended** — it does not require local Twilio secrets.

## QA modes

| Mode | Env | Twilio on laptop | What it tests |
|------|-----|------------------|---------------|
| **production-api** (default) | `WHATSAPP_QA_MODE=production-api` | Not required | Production Cloud Run secrets via admin test API |
| **local-direct** (optional) | `WHATSAPP_QA_MODE=local-direct` | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM` | Direct send from local env |

## Prerequisites

1. **Twilio sandbox joined** — send the join code to `whatsapp:+14155238886` from your test phone before any live send.
2. Secret Manager secrets exist and Cloud Run mounts them (see `docs/TWILIO_WHATSAPP_SETUP.md`).
3. **Admin Firebase account** for production API mode (`QA_ADMIN_EMAIL` / `QA_ADMIN_PASSWORD`).
4. **Optional:** `GOOGLE_APPLICATION_CREDENTIALS` for Firestore log verification after the API send. Without it, the script still passes if the test API reports `status: sent`.

## Recommended: production API mode

Uses `https://www.tenderbriefing.co.za/api/notifications/test-whatsapp` with production Twilio credentials from Secret Manager. No local `TWILIO_*` variables needed.

```bash
TEST_WHATSAPP_TO=+27XXXXXXXXX \
QA_ADMIN_EMAIL=your-admin@example.com \
QA_ADMIN_PASSWORD='your-password' \
npm run qa:whatsapp:production
```

Equivalent (default mode is already production-api):

```bash
TEST_WHATSAPP_TO=+27XXXXXXXXX \
QA_ADMIN_EMAIL=your-admin@example.com \
QA_ADMIN_PASSWORD='your-password' \
npm run qa:whatsapp
```

### Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `TEST_WHATSAPP_TO` | Yes | E.164 sandbox-joined number (e.g. `+27720708467`) |
| `QA_ADMIN_EMAIL` | Yes (production-api) | Admin user email |
| `QA_ADMIN_PASSWORD` | Yes (production-api) | Admin password (never logged) |
| `WHATSAPP_QA_MODE` | No | `production-api` (default) or `local-direct` |
| `QA_BASE_URL` | No | Override base URL (default: production site) |

### What the script checks

1. `GET /api/integrations/health` — `twilio-whatsapp` = `configured`
2. Firebase admin sign-in (token not printed)
3. `POST /api/notifications/test-whatsapp` with body:

   ```json
   {
     "to": "whatsapp:+27...",
     "message": "TenderBriefing WhatsApp QA test message"
   }
   ```

4. `GET /api/admin/whatsapp-metrics` (admin Bearer)
5. Firestore `notifications` with `channel: whatsapp`, `status: sent` (if Admin credentials available)

Output JSON includes: `mode`, `productionHealth`, `adminAuth`, `testEndpoint`, `firestoreVerification`, `operationalReadiness`.

## Optional: local direct mode

Only when you explicitly need to send from local Twilio env vars:

```bash
WHATSAPP_QA_MODE=local-direct \
TWILIO_ACCOUNT_SID=... \
TWILIO_AUTH_TOKEN=... \
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886 \
TEST_WHATSAPP_TO=+27XXXXXXXXX \
node scripts/whatsapp-operational-qa.js
```

Never commit `.env.local` or paste secrets into docs.

## Manual checks

### Integration health

```bash
curl -sS https://www.tenderbriefing.co.za/api/integrations/health \
  | jq '.integrations[] | select(.id=="twilio-whatsapp")'
```

**Expected:** `"status": "configured"`, `from` masked.

### Admin test API (curl)

Sign in as **admin** in the app, or obtain an ID token (do not log the token):

```bash
curl -sS -X POST https://www.tenderbriefing.co.za/api/notifications/test-whatsapp \
  -H "Authorization: Bearer YOUR_ID_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"to":"whatsapp:+27XXXXXXXXX","message":"TenderBriefing QA test"}'
```

**Expected:** `success: true`, `data.status: sent`, Firestore log `channel: whatsapp`.

### Firestore

Firebase Console → `notifications` → filter `channel == whatsapp`.

**Fields:** `type`, `recipientRole`, `recipientId`, `channel`, `message`, `status`, `createdAt`, `sentAt`, `error`, `metadata`.

## End-to-end workflow

| Step | Template | Requires |
|------|----------|----------|
| SME creates attendance request | `sme_attendance_submitted` | SME `phoneNumber` |
| Payment confirmed | `agent_payment_confirmed` | Paid request + agent phone |
| Agent accepts | `sme_agent_assigned`, `agent_request_accepted` | Assigned agent |
| Report uploaded | `sme_report_uploaded`, `admin_report_uploaded` | SME + admin phones |

Unpaid requests (`paymentStatus: pending`) do not notify agents via WhatsApp until paid.

## Duplicate prevention & rate limit

- Same `idempotencyKey` within 10 minutes → duplicate skipped.
- More than 3 messages/minute per recipient → rate limit error logged as `failed`.

## Full smoke

```bash
npm run smoke:production
```

## Operational readiness checklist

| Check | Pass criteria |
|-------|----------------|
| Twilio on production | Health `configured` |
| Secrets on Cloud Run | Three TWILIO env refs |
| Production QA script | `operationalReadiness: ready` |
| Live send | Test API `status: sent` |
| Logging | Firestore `channel: whatsapp`, `status: sent` |
| Sandbox | Test phone joined Twilio Sandbox |

## Deploy note

Changes to `scripts/whatsapp-operational-qa.js` and docs only **do not require deploy**. Changes to `app/api/notifications/test-whatsapp/route.ts` require deploy to take effect on production.
