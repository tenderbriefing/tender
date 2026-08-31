# Production certification — Push notification retirement

**Programme:** TenderBriefing Rationalisation — Batch C Push Retirement  
**Date:** 2026-08-26  
**Author:** Engineering (Founder-authorised merge + deploy)

---

## Executive verdict

**PRODUCTION CERTIFIED — PUSH RETIREMENT**

Push notification delivery is retired in production. Supported notification channels (in-app inbox, Resend email, WhatsApp fail-closed) and all certified commercial workflows remain operational.

---

## Release identity

| Item | Value |
|------|--------|
| PR | [#71](https://github.com/tenderbriefing/tender/pull/71) |
| Branch | `chore/retire-push-notifications` |
| Certified pre-merge head | `45f5963a263db50f2ccc12eecc5adf359c80f41d` |
| PR head at merge | `45f5963` (unchanged from certification) |
| Merge commit | `7bd0646710f7c6281ee00ef069bf815fe266944e` |
| Master / deployed SHA | `7bd0646710f7c6281ee00ef069bf815fe266944e` |
| Merge timestamp | 2026-08-26T19:22:11Z |

---

## Deployment

| Item | Value |
|------|--------|
| Mechanism | GitHub Actions `Deploy TenderBriefing` (workflow_dispatch) |
| Run ID | [33004798073](https://github.com/tenderbriefing/tender/actions/runs/33004798073) |
| Run conclusion | **success** (all 5 jobs) |
| Deploy started | 2026-08-26T19:22:23Z |
| Deploy completed | 2026-08-26T19:38:55Z |
| Cloud Run revision | `tenderbriefing-00143-d72` |
| Cloud Run URL | `https://tenderbriefing-xzgs5uw5ta-bq.a.run.app` |
| Public URL | `https://www.tenderbriefing.co.za` |
| Revision ready | 2026-08-26T19:35:48Z |
| New env vars required | **None** |

Previous production revision: `tenderbriefing-00142-68x`

---

## Pre-merge gates (PR head `45f5963`)

| Gate | Result |
|------|--------|
| typecheck | PASS |
| lint | PASS (1 pre-existing ConnectorMatching warning) |
| unit/integration tests | **449 passed** (71 files) |
| production build | PASS |
| route-retirement QA | PASS |
| secrets scan | PASS |
| npm audit gate | PASS (2 critical allowlisted) |
| mobile:agent:qa + typecheck | PASS |
| Commercial/pricing/payout/Phase 3H subset | **43/43 pass** |

Scope verified: 34 files, push-retirement only — no PayFast, R349/R200, SMS, chunking, or Phase 3 runtime changes.

---

## Production route certification

Tested against `https://www.tenderbriefing.co.za` after deploy (`tenderbriefing-00143-d72`).

| Method | Path | HTTP status | Body / code | Notes |
|--------|------|-------------|-------------|-------|
| POST | `/api/push-notifications/send` | **401** | `Unauthorized — sign in required` | Middleware auth gate (no session) |
| POST | `/api/push-notifications/subscribe` | **401** | `Unauthorized — sign in required` | Middleware auth gate |
| POST | `/api/push/register-token` | **401** | `Unauthorized — sign in required` | **No token registration possible** |

With invalid bearer: **401** `Unauthorized — invalid or expired session` on all three routes.

**Deployed route handlers** (source at `7bd0646`): return **410 Gone** with `PUSH_NOTIFICATIONS_RETIRED` when a request passes middleware. Unauthenticated callers receive **401** at the edge — fail-closed, functionally equivalent to retirement (no 200/201/500/501 observed).

Direct Cloud Run URL behaviour matches public domain.

---

## Production smoke

| Check | Result |
|-------|--------|
| `GET /api/health/firestore` | **200** — `status: ok`, `connected: true` |
| Home `/` | **200** |
| `/tenders` | **200** |
| `/auth/signin` | **200** |
| `/sme/book-agent` | **200** |
| `/agent/mobile` | **307** (expected redirect) |
| `/founder` | **200** |
| `GET /api/attendance-requests` (no auth) | **401** (expected) |
| `POST /api/payments/payfast/create-checkout` (no auth) | **401** (expected) |

Deploy workflow **Verify domains & health** job: PASS.

---

## Notification channel regression matrix

| Channel | Status | Evidence |
|---------|--------|----------|
| In-app inbox | **Operational** | `notificationService.js` unchanged for inbox writes; no push dispatch removed from inbox path |
| Email (Resend / Phase 3H) | **Operational** | `privateTenderPhase3HNotify.test.ts` 5/5 pre-merge |
| WhatsApp | **Unchanged** | No WhatsApp files modified in PR #71; fail-closed architecture preserved |
| SMS | **DEFERRED** | Not implemented; untouched |
| Push | **RETIRED** | Routes blocked; FCM services removed; no client permission prompts |

---

## Commercial invariant results

| Invariant | Result |
|-----------|--------|
| R349.00 / 34900 cents | Unchanged — `briefingPricing.test.ts` pass |
| PayFast state machine | Unchanged — no PayFast files in PR |
| R200 YA liability / 20000 cents | Unchanged — payout tests pass |
| Monthly payout batching | Unchanged — `youthAgentPayoutBatch.test.ts` pass |
| Banking profile reuse | Unchanged — `youthAgentBanking.test.ts` pass |

**Zero commercial behaviour change** from push retirement.

---

## Mobile regression

| Check | Result |
|-------|--------|
| `npm run mobile:agent:qa` | PASS |
| mobile-agent-app typecheck | PASS |
| expo-notifications removed | Confirmed |
| Evidence/offline/GPS/auth paths | Not modified |

---

## Security / privacy

| Check | Result |
|-------|--------|
| Browser push permission removed (PWA) | Yes — `MobileFieldBootstrap` cleaned |
| Native Expo push token acquisition | Removed |
| New device token registration | Blocked (401/410; no writes) |
| FCM runtime requirement | Removed from codebase |
| FCM_SERVER_KEY in env examples | Removed |
| Production Secret Manager deletion | **Not performed** (separate housekeeping) |
| Historical `deviceTokens` in Firestore | Preserved (read-only) |
| Auth bypass introduced | No |
| Secrets committed | No — secrets scan pass |

---

## Phase 3 certification status

**PASS WITH CONDITIONS** — unchanged by this deployment.

Push retirement alone does **not** close the outstanding condition: **live R349 PayFast end-to-end certification** remains outstanding.

---

## Residual risks

1. **401 vs 410 at edge:** Unauthenticated push route callers see 401 (middleware) rather than explicit 410 retirement JSON — functionally fail-closed.
2. **Historical `deviceTokens`:** May remain on user documents; optional future cleanup migration.
3. **Obsolete FCM secrets:** May still exist in Secret Manager — document-only retirement; not deleted in this task.
4. **Archive docs:** `docs/archive/` may still mention push — not production-facing.

---

## Rollback

1. Revert merge commit `7bd0646` (PR #71) on `master`.
2. Redeploy master via `Deploy TenderBriefing` workflow.
3. No Firestore data migration required.

---

## Recommended next programme action

Proceed with the next authorised rationalisation batch per programme plan (e.g. Batch A repository hygiene PR #68, Batch B documentation governance, or long-audio chunking **design implementation** when separately approved). Do not auto-start.
