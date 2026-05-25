# Twilio WhatsApp notifications

TenderBriefing sends operational WhatsApp messages via **Twilio** (not the legacy Meta WhatsApp integration).

## Environment variables

| Variable | Source |
|----------|--------|
| `TWILIO_ACCOUNT_SID` | Google Secret Manager → Cloud Run |
| `TWILIO_AUTH_TOKEN` | Google Secret Manager → Cloud Run |
| `TWILIO_WHATSAPP_FROM` | Secret Manager (sandbox: `whatsapp:+14155238886`) |

Never commit values. Use `.env.local` for local `npm run test:whatsapp` only.

## Cloud Run mapping

`cloudbuild.yaml` maps:

```text
TWILIO_ACCOUNT_SID=TWILIO_ACCOUNT_SID:latest
TWILIO_AUTH_TOKEN=TWILIO_AUTH_TOKEN:latest
TWILIO_WHATSAPP_FROM=TWILIO_WHATSAPP_FROM:latest
```

## Firestore log (`notifications` collection)

WhatsApp deliveries use `channel: "whatsapp"` with fields: `type`, `recipientRole`, `recipientId`, `message`, `status`, `createdAt`, `sentAt`, `error`, `metadata`.

Inbox notifications use `channel: "inbox"` and `userId`.

## Admin test

1. Sign in as admin → `/admin/integrations`
2. Use **Twilio WhatsApp** panel → enter E.164 number → **Send test WhatsApp**

API: `POST /api/notifications/test-whatsapp` (admin Bearer token)

## CLI test

```bash
TEST_WHATSAPP_TO=+27821234567 npm run test:whatsapp
```

## Sandbox

Join Twilio WhatsApp sandbox from the Twilio console, then send from `whatsapp:+14155238886`.

## Operations metrics

`/admin/operations` shows sent / failed / pending counts and latest delivery log.
