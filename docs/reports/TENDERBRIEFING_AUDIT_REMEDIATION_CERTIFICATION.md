# TenderBriefing — Audit Remediation & Production Certification

**Programme:** Autonomous Audit Remediation & Production Certification Sprint  
**Date:** 2026-08-08  
**Author role:** Principal Architect / Staff Security / SRE / QA / Release Manager  
**Branch:** `fix/audit-remediation-certification`  
**Base tip:** `07ae694` (REGISTRY tip after `admin-cc-a7b0d58`)  
**Pre-remediation production:** `tenderbriefing-00106-gh8` / `admin-cc-a7b0d58` (verified live via gcloud)

---

## 1. Executive verdict

**PASS WITH CONDITIONS**

Highest-value audit findings (fake profile save, legacy booking/matching/Yoco on prod path, RFQ mailbox overclaim, soft 404, scrape zeros, CI audit soft-fail, env doc drift, automation cert staleness) are remediated. YAW / PI / Google Auth remain **disabled**. Meta WhatsApp remains fail-closed. PayFast remains the sole live payment provider.

Conditions (non-blocking for this release):

1. Scheduler still uses `x-sync-secret` headers — OIDC design documented; cutover deferred (see §8 residual).
2. Authenticated E2E still optional until `E2E_SME_TOKEN` is added to GitHub Actions secrets.
3. `PAYFAST_MERCHANT_EMAIL` set to `info@tenderbriefing.co.za` (founder/business email). Confirm against PayFast dashboard merchant profile if checkout omit behaviour surprises ops.
4. Critical `websocket-driver` advisories remain allowlisted pending Firebase major upgrade.

---

## 2. Baseline reconciliation

| Claim | Verified |
|-------|----------|
| Audit tip `07ae694` | Yes — clean `master` / `origin/master` at sprint start |
| REGISTRY current `admin-cc-a7b0d58` → `tenderbriefing-00106-gh8` | Yes — matches live Cloud Run `latestReadyRevisionName` |
| Image digest (pre) | `sha256:0d6aac8bca0ed2683149f54a5490845b4f387063a58610b2b538e193a2ccda6e` |
| YAW | Env absent → fail-closed |
| PI flags | `false` / `false` on Cloud Run |
| Google Auth | `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=false` |
| PayFast | `PAYFAST_MODE=live` + merchant secrets mounted |
| Automation budget | `240000` / margin `20000` / timeout `300` live |
| `enterprise-v1.0.0` tag | Preserved (untouched) |

Phase 0 quality suite (pre-change): typecheck, lint (pre-existing matching warning), 169 unit tests, route-retirement / config / secrets / firestore-rules / google-auth QA — **PASS**.

---

## 3. Remediations by phase

| Phase | Finding | Action | Status |
|-------|---------|--------|--------|
| 1 | Fake profile save | `PATCH /api/auth/update-profile` + AuthProvider refresh | **Closed** |
| 2 | Legacy booking/matching/Yoco | 410 stubs; services → `_legacy/` | **Closed** |
| 3 | RFQ mailbox overclaim | Truthful paste-only copy (admin + SME) | **Closed** (no invented mailbox) |
| 4 | Automation Promise.race / stale cert | AbortSignal cooperative cancel + cert **DEPLOYED** | **Closed** |
| 5 | `PAYFAST_MERCHANT_EMAIL` | Cloud Run env + readiness flag + warn if unset | **Closed** |
| 6 | Soft 404 tenders | Layout `notFound()` + `not-found.tsx` | **Closed** |
| 7 | Apex SEO | Live verified 200→middleware **308** www + docs | **Closed** (edge DNS still recommended) |
| 8 | Scheduler secret headers | OIDC design doc; no unsafe flip | **Deferred** (designed) |
| 9 | Scrape status zeros | Real catalog stats / 503 if unavailable | **Closed** |
| 10 | Agent verification placeholders | Explicit pending copy + `submitVerification` on onboarding | **Closed** |
| 11 | Env docs matrix | Full Cloud Run / example reconciliation | **Closed** |
| 12 | CI `npm audit \|\| true` | `npm-audit-gate.js` + allowlist | **Closed** |
| 13 | E2E skip | Secret posture test + docs; no committed secrets | **Improved** |
| 14 | Observability | Attendance + automation `logEvent` | **Closed** |
| 15 | Obsolete docs | Archived under `docs/archive/` | **Closed** |

---

## 4. Security posture

- Profile updates: Admin SDK + `stripPrivilegedFields`; privileged keys never accepted from client.
- Legacy APIs: 410 + production route policy blocks.
- PayFast same-account guard activated when merchant email configured.
- CI critical audit no longer soft-fails; exceptions require explicit allowlist + review-by.
- No secrets added to git, docs, or logs.
- Intentionally disabled features were **not** enabled.

---

## 5. Quality evidence (pre-PR)

| Gate | Result |
|------|--------|
| `npm run typecheck` | PASS |
| `npm run lint` | PASS (pre-existing ConnectorMatching hook warning) |
| `npm test` | 169 passed |
| `qa:route-retirement` | PASS (extended for matching/connector/legacy) |
| `qa:npm-audit` | PASS (2 critical allowlisted) |
| `qa:config` / `qa:secrets-scan` / `qa:firestore-rules` / `qa:google-auth` | PASS |
| `npm run build` | PASS |

---

## 6. Git / release integrity

| Field | Value |
|-------|--------|
| Branch | `fix/audit-remediation-certification` |
| Commits | `c6acdb5` → `24138c0` → `d56afff` → `c33cb67` → `fb6b4f7` |
| PR | _(filled after create)_ |
| CI | _(filled after green)_ |
| Merge SHA | _(filled after merge)_ |
| Deploy revision | _(filled after deploy)_ |
| Deploy digest | _(filled after deploy)_ |

---

## 7. Production smoke plan (post-deploy)

1. `GET /api/health/firestore` (or existing smoke) → 200  
2. Public `/tenders` → 200  
3. Missing tender id → **HTTP 404** (not soft 200)  
4. Apex host (if reached) → **308** to www  
5. Feature flags still off: YAW/PI/Google Auth  
6. PayFast create-checkout path healthy (no same-account self-test)  
7. Automation lease/budget env still present on new revision  

---

## 8. Residual conditions & backlog

1. **Scheduler OIDC cutover** — `docs/architecture/SCHEDULER_OIDC_MIGRATION.md`  
2. **E2E_SME_TOKEN** in Actions + optional `REQUIRE_E2E_AUTH` on master  
3. Confirm PayFast dashboard merchant email matches `info@tenderbriefing.co.za`  
4. Firebase major upgrade to clear `websocket-driver` allowlist by **2026-09-30**  
5. Afrihost/Firebase edge apex redirect (middleware is app-level backup)  
6. Full mailbox webhook epic (explicitly out of scope — copy fixed only)  
7. Real agent ID document upload / KYC (still pending by design)

---

## 9. Intentionally unchanged (by design)

| Item | Posture |
|------|---------|
| Youth Agent Workspace | Globally off |
| Procurement Intelligence | Flags false |
| Google Auth UI | Disabled |
| Meta WhatsApp webhook | Fail-closed |
| Push / SMS stubs | Explicit 501 / not implemented |
| `enterprise-v1.0.0` | Untouched rollback tag |

---

## 10. Overall readiness score

**8.4 / 10** — production-certifiable for remediation scope; residuals are documented ops follow-ups, not paid-path blockers.

---

## 11. Sign-off

Remediation sprint executed autonomously against the audit backlog. Deploy authorized after green CI. Update this section with PR URL, CI run, merge SHA, Cloud Run revision/digest, and smoke results after ship.
