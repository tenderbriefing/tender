# Founder Outreach

Founder-only tool to upload a cleaned `.xlsx` list and send one of two approved invitation templates via the existing Resend infrastructure.

## Route

- UI: `/founder/outreach` (Founder shell → Outreach)
- APIs under `/api/founder/outreach/*` (Founder auth + feature flag)
- Public unsubscribe: `/api/outreach/unsubscribe?token=…`

## Supported campaigns

| Audience | Campaign type | Template | Subject |
|----------|---------------|----------|---------|
| SME Invitation | `sme_invitation` | `sme-invitation-v1` | Compulsory briefings, without the travel |
| Youth Agent Invitation | `youth_agent_invitation` | `youth-agent-invitation-v1` | Invitation to become Youth Agents |

Historical SME campaigns remain unchanged (`type: sme_invitation`, `templateVersion: sme-invitation-v1`).

## Feature flag (fail-closed)

- `FOUNDER_SME_OUTREACH_ENABLED` — server enforcement for **both** campaign types (absent/false = disabled)
- `NEXT_PUBLIC_FOUNDER_SME_OUTREACH_ENABLED` — UI visibility only (also fail-closed)

No separate Youth Agent flag in v1 — one Founder Outreach gate controls SME and Youth Agent audiences. Disabling outreach does **not** disable transactional Resend email.

Production default in `cloudbuild.yaml`: both flags `false` until Founder enables.

## Excel contract

### SME Invitation

Required columns (header whitespace/case tolerant):

| Column | Canonical field |
|--------|-----------------|
| Name | `name` |
| Company Name | `companyName` |
| Email | `email` |

### Youth Agent Invitation

| Column | Required |
|--------|----------|
| Name | Yes |
| Email | Yes |
| Company Name | No (optional; parser accepts Name + Email only) |

Shared limits:

- `.xlsx` only
- Max upload: 5 MiB
- Max workbook rows: 2500
- Max sendable recipients: **2000** (reject over limit; never truncate)
- Blank rows ignored
- In-file duplicate emails (case-insensitive) kept once
- Suppressed emails skipped before send

## Templates

### SME — `sme-invitation-v1`

- CTA: **VIEW TENDER BRIEFINGS** → `/tenders`
- Personalisation: first name from Name only
- Tagline: You run the business. We attend the briefing.

### Youth Agent — `youth-agent-invitation-v1`

- CTA: **JOIN AS A YOUTH AGENT** → `/auth/signup?type=youth-agent` (canonical Youth Agent registration)
- Personalisation: first name from Name only (e.g. Calvin Makhubela → Hi Calvin,)
- Tagline: Show up. Learn. Earn R200.
- R200 copy is fixed; not editable in outreach

Both templates: HTML + plain text; EmailShell + logo; unsubscribe footer + List-Unsubscribe headers.

## Resend

- Reuses `RESEND_API_KEY` / `RESEND_FROM_EMAIL` (`hello@tenderbriefing.co.za`)
- Transport: `lib/services/founderOutreachEmail.ts` channel `FOUNDER_OUTREACH`
- Separate from `transactionalEmailService` (welcome / booking / ops)
- Marketing suppression **never** blocks transactional sends

## Data model (Admin SDK only)

- `founderOutreachCampaigns/{campaignId}` — includes `type` and `templateVersion`
- `founderOutreachCampaigns/{campaignId}/deliveries/{deliveryId}`
- `emailSuppressions/{normalisedEmail}`

Client Firestore access is denied in `firestore.rules`.

## Sending

- Founder selects audience, uploads list, validates, confirms count + authorised list
- Concurrency: 3; process in ticks (≤400/request); worker continues batches
- Idempotent claim: `campaignId` + normalised email; already-`sent` never resent
- Retry only `provider_rate_limit` / `provider_server_error` (max 3)

## Suppression / unsubscribe

- Global to Founder Outreach — unsubscribe applies to both SME and Youth Agent campaigns
- Signed HMAC token (`FOUNDER_OUTREACH_UNSUB_SECRET` → fallback `SYNC_SECRET`)
- Idempotent upsert into `emailSuppressions`
- Resend webhooks deferred (capture API send result + message id in v1)

## Rollback

1. Set `FOUNDER_SME_OUTREACH_ENABLED=false` (and public mirror if used)
2. Redeploy if env change requires it

Campaign history remains for audit. Transactional email stays up.

## Scope lock

No CRM, sequencing, SMS/WhatsApp, freeform copy editing, multi-templates beyond the two approved types, AI copy, or changes to booking/payments/AI minutes/registration flows.

See also: `docs/FOUNDER_SME_OUTREACH.md` (legacy filename; this document supersedes for multi-audience outreach).
