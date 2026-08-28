# Founder SME Outreach (v1)

Founder-only tool to upload a cleaned SME `.xlsx` list and send one approved invitation via the existing Resend infrastructure.

## Route

- UI: `/founder/outreach` (Founder shell → Outreach)
- APIs under `/api/founder/outreach/*` (Founder auth + feature flag)
- Public unsubscribe: `/api/outreach/unsubscribe?token=…`

## Feature flag (fail-closed)

- `FOUNDER_SME_OUTREACH_ENABLED` — server enforcement (absent/false = disabled)
- `NEXT_PUBLIC_FOUNDER_SME_OUTREACH_ENABLED` — UI visibility only (also fail-closed)

Disabling outreach does **not** disable transactional Resend email.

Production default in `cloudbuild.yaml`: both flags `false` until Founder enables.

## Excel contract

Required columns (header whitespace/case tolerant):

| Column | Canonical field |
|--------|-----------------|
| Name | `name` |
| Company Name | `companyName` |
| Email | `email` |

- `.xlsx` only
- Max upload: 5 MiB
- Max workbook rows: 2500
- Max sendable recipients: **2000** (reject over limit; never truncate)
- Blank rows ignored
- In-file duplicate emails (case-insensitive) kept once
- Suppressed emails skipped before send

## Template

- Version: `sme-invitation-v1`
- Subject: `Compulsory briefings, without the travel`
- CTA: **VIEW TENDER BRIEFINGS** → `https://www.tenderbriefing.co.za/tenders`
- Personalisation: first name from Name only
- HTML + plain text; unsubscribe footer + List-Unsubscribe headers

## Resend

- Reuses `RESEND_API_KEY` / `RESEND_FROM_EMAIL` (`hello@tenderbriefing.co.za`)
- Transport: `lib/services/founderOutreachEmail.ts` channel `FOUNDER_OUTREACH`
- Separate from `transactionalEmailService` (welcome / booking / ops)
- Marketing suppression **never** blocks transactional sends

## Data model (Admin SDK only)

- `founderOutreachCampaigns/{campaignId}`
- `founderOutreachCampaigns/{campaignId}/deliveries/{deliveryId}`
- `emailSuppressions/{normalisedEmail}`

Client Firestore access is denied in `firestore.rules`.

## Sending

- Founder confirms count + authorised list
- Concurrency: 3; process in ticks (≤400/request); worker continues batches
- Idempotent claim: `campaignId` + normalised email; already-`sent` never resent
- Retry only `provider_rate_limit` / `provider_server_error` (max 3)

## Suppression / unsubscribe

- Signed HMAC token (`FOUNDER_OUTREACH_UNSUB_SECRET` → fallback `SYNC_SECRET`)
- Idempotent upsert into `emailSuppressions`
- Resend webhooks deferred (capture API send result + message id in v1)

## Rollback

1. Set `FOUNDER_SME_OUTREACH_ENABLED=false` (and public mirror if used)
2. Redeploy if env change requires it

Campaign history remains for audit. Transactional email stays up.

## Scope lock

No CRM, sequencing, SMS/WhatsApp, multi-templates, AI copy, or changes to booking/payments/AI minutes/registration.
