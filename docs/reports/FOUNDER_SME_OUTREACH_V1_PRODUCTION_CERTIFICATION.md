# Founder SME Outreach V1 — Production Certification

Date: 2026-08-28 (UTC+2)  
Certifier: automated release + controlled production smoke

## Release identity

| Item | Value |
|------|-------|
| PR | [#84](https://github.com/tenderbriefing/tender/pull/84) |
| Certified PR head | `2638ca29dfc1cc4ce888a9bdee426d9bf88b0d42` |
| Merge commit | `4d1bfcbf9266fb27193804993301a116ed8f258f` |
| Final master (post-smoke fixes) | `b56998405846a32d59d4d0c2576c614b1ba52aa9` |

Post-merge fixes on master (same release train):

1. `ac21ac3` — enable outreach flags for controlled smoke
2. `b569984` — public unsubscribe middleware policy + prod smoke script

## Deployments

| Step | GitHub Actions run | Cloud Run revision | Traffic | Outreach flags |
|------|-------------------|-------------------|---------|----------------|
| Fail-closed deploy | [33128443493](https://github.com/tenderbriefing/tender/actions/runs/33128443493) | `tenderbriefing-00152-fq9` | 100% | `false` / `false` |
| Enable for smoke | [33129501704](https://github.com/tenderbriefing/tender/actions/runs/33129501704) | `tenderbriefing-00153-jjd` | 100% | `true` / `true` |
| Unsubscribe fix | [33130379400](https://github.com/tenderbriefing/tender/actions/runs/33130379400) | `tenderbriefing-00154-d7g` | 100% | `true` / `true` |

**Current production revision:** `tenderbriefing-00154-d7g` @ `b569984`

## Resend configuration (no secret values)

- `RESEND_API_KEY` → Secret Manager `TENDERBRIEFING_API:latest` (enabled)
- `RESEND_FROM_EMAIL` → `hello@tenderbriefing.co.za`
- Sender presentation → `TenderBriefing <hello@tenderbriefing.co.za>`
- Transactional service unchanged (`transactionalEmailService.js`)

## Fail-closed regression (flags false)

- Homepage, `/tenders`, `/founder`, `/auth/signin` → HTTP 200
- Founder + outreach API with auth → HTTP 403 `flag_disabled`
- Anonymous outreach API → HTTP 401

## Controlled authorised smoke (1 recipient)

- **Recipient count:** 1 (Founder-controlled authorised test inbox only; not SME database)
- **Upload:** `.xlsx` Name / Company Name / Email
- **Validate counts:** total=1, valid=1, invalid=0, duplicate=0, suppressed=0, sendable=1
- **Resend acceptance:** yes (`sentCount=1`, `failedCount=0`, status `completed`)
- **Message ID captured:** yes (redacted `9aa1…7995`)
- **Subject (validated in preview, pre-subject-update PR):** `A compulsory tender briefing shouldn’t slow your business down`
- **CTA:** `VIEW TENDER BRIEFINGS` → `https://www.tenderbriefing.co.za/tenders` (HTTP 200)
- **Idempotent re-send:** repeat confirm → `sentThisTick=0`, `processedThisTick=0`

## Unsubscribe & suppression

- Middleware fix required: `/api/outreach/unsubscribe` must be public (added in `b569984`)
- Signed token unsubscribe → HTTP 200 (GET + POST idempotent)
- `emailSuppressions` document created (`reason: unsubscribe`)
- Second campaign to same address → HTTP 400 `campaign_create_failed` / no sendable recipients (Resend not called)

## Security smoke

| Actor | `/api/founder/outreach/campaigns` |
|-------|-----------------------------------|
| Anonymous | 401 |
| SME (`ops-smoke-sme@…`) | 403 |
| Youth Agent (`ops-smoke-agent@…`) | 403 |
| Founder allow-list | 200 (when flag enabled) |

## Transactional isolation

- Unit tests: `transactionalEmailService` does not reference outreach suppression
- `founderOutreachEmail` does not import suppression module (caller checks before send)
- Outreach suppression does not alter transactional welcome/ops paths

## Campaign history

- Founder history API lists campaigns with file name, counts, status
- First smoke campaign: `completed`, sent 1/1

## Local gates (master @ post-fix)

| Gate | Result |
|------|--------|
| Typecheck | PASS |
| Lint | PASS (pre-existing ConnectorMatching warning) |
| Tests | 76 files / 521+ passed (includes 17 outreach + apiRoutePolicy) |
| Build | PASS |
| Secrets scan | PASS |

## Rollback

Set `FOUNDER_SME_OUTREACH_ENABLED=false` and `NEXT_PUBLIC_FOUNDER_SME_OUTREACH_ENABLED=false`, redeploy. Transactional Resend remains enabled.

## Verdict

**PRODUCTION CERTIFIED — FOUNDER SME OUTREACH V1**

Founder may use controlled campaigns (`upload → preview → confirm → send`). Do not bulk-send the SME database without explicit Founder confirmation per campaign.
