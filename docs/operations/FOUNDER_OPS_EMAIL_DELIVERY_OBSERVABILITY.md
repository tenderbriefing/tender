# Founder operational email delivery observability

Tracks Resend lifecycle for Founder ops notifications (SME/YA registration, payment, briefing) without affecting business transaction authority.

## Production endpoint

`POST https://www.tenderbriefing.co.za/api/webhooks/resend`

Middleware-public; handler requires cryptographic verification via `RESEND_WEBHOOK_SECRET`.

## Resend dashboard configuration (manual)

1. Resend → Webhooks → Add endpoint.
2. Endpoint URL: `https://www.tenderbriefing.co.za/api/webhooks/resend`
3. Subscribe to events:
   - `email.sent`
   - `email.delivered`
   - `email.delivery_delayed`
   - `email.bounced`
   - `email.complained`
   - `email.failed`
4. Copy the signing secret (`whsec_…`).
5. Store in Google Secret Manager (suggested secret id: `resend-webhook-secret`).
6. Mount on Cloud Run as env `RESEND_WEBHOOK_SECRET` (add to `cloudbuild.yaml` `--set-secrets` once the GSM secret exists).
7. Do **not** commit the secret value.

## Signature verification

Uses Resend SDK `resend.webhooks.verify` (Standard Webhooks / Svix headers):

- `svix-id`
- `svix-timestamp`
- `svix-signature`

Raw request body must be verified before JSON trust.

## Data model

| Collection | Purpose | Retention |
|---|---|---|
| `notifications/founder-ops-idem-*` | Canonical Founder ops ledger + delivery fields | Permanent audit |
| `founderOpsEmailByProviderId/{email_id}` | Correlation index | Permanent (small) |
| `resendWebhookEvents/{svix-id}` | Webhook idempotency | `expireAt` +30d (configure Firestore TTL) |
| `resendWebhookPending/{email_id}` | Webhook-before-ledger race buffer | `expireAt` +30d (configure Firestore TTL) |

### Ledger delivery fields

- `emailProvider`, `providerMessageId`
- `deliveryStatus`: accepted → sent → delayed → delivered / bounced / complained / failed
- `emailAcceptedAt`, `emailSentAt`, `emailDeliveredAt`, `emailBouncedAt`, `emailComplainedAt`, `emailFailedAt`, `emailDelayedAt`
- `deliveryStatusUpdatedAt`, `subject`, `recipient`, `eventType`, `founderOpsDelivery`

## Founder UI

Overview → **Founder email delivery** panel (24h health + recent rows).

API: `GET /api/founder/email-delivery` (Founder auth only).

## Firestore TTL (recommended)

Create TTL policies on:

- `resendWebhookEvents.expireAt`
- `resendWebhookPending.expireAt`

Do not TTL-delete canonical `notifications` ledger docs.

## Fail-soft

Observability failures never roll back registration, payment, or briefing confirmation.
