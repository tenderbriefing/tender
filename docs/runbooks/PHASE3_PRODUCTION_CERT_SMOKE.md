# Phase 3 production certification smoke

Canonical harness: `scripts/pr64-phase3-production-cert-smoke.js`

Used for Private Tender Briefing Operations (PR #64) Wave 1–4 production certification. Does **not** change Phase 3 certification status; records evidence for operator-run checks.

## Prerequisites

- `.env.local` with Firebase Admin credentials (`GOOGLE_APPLICATION_CREDENTIALS` or `FIREBASE_SERVICE_ACCOUNT_JSON`)
- `NEXT_PUBLIC_FIREBASE_API_KEY` (or `FIREBASE_WEB_API_KEY`)
- `SMOKE_TEST_PASSWORD` for ops smoke users
- Production base URL (default `https://www.tenderbriefing.co.za`)

## Modes

Set `PHASE3_CERT_MODE`:

| Mode | Purpose |
|------|---------|
| `baseline` | Flags-off posture |
| `wave1`–`wave4` | Incremental Phase 3 rollout checks |
| `full` | Full suite |

## Payment safety

- Default: `STOP_BEFORE_PAY=true` (no live card charge)
- Live R349 PayFast only when **both** `ALLOW_LIVE_R349_PAYMENT=true` and `STOP_BEFORE_PAY=false`

## Examples

```bash
# Wave 4 (post-hotfix regression)
PHASE3_CERT_MODE=wave4 node scripts/pr64-phase3-production-cert-smoke.js

# npm script wrapper
npm run smoke:phase3-production -- --  # env vars as above
```

Financial invariants asserted in-script: R349 (`34900`), YA R200 (`20000`), gross R149 (`14900`), pricing version `2026-08-v349`.

See `docs/reports/PRIVATE_TENDER_PHASE3_PRODUCTION_CERTIFICATION.md` for certification verdict (do not edit retroactively).
