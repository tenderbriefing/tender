# TenderBriefing — Audit Remediation & Production Certification

**Programme:** Autonomous Audit Remediation & Production Certification Sprint  
**Date:** 2026-08-08  
**Author role:** Principal Architect / Staff Security / SRE / QA / Release Manager  
**Branch:** `fix/audit-remediation-certification` (+ follow-up `fix/apex-forwarded-host-redirect`)  
**Base tip:** `07ae694` (REGISTRY tip after `admin-cc-a7b0d58`)  
**Pre-remediation production:** `tenderbriefing-00106-gh8` / `admin-cc-a7b0d58` (verified live via gcloud)  
**Post-remediation production:** `tenderbriefing-00108-vqr` / `audit-remed-bd16ca4`

---

## 1. Executive verdict

**PASS WITH CONDITIONS**

Highest-value audit findings are remediated and deployed. YAW / PI / Google Auth remain **disabled**. Meta WhatsApp remains fail-closed. PayFast remains the sole live payment provider. `enterprise-v1.0.0` tag preserved.

Conditions (non-blocking):

1. Scheduler still uses `x-sync-secret` headers — OIDC design documented; cutover deferred.
2. Authenticated E2E still optional until `E2E_SME_TOKEN` is added to GitHub Actions secrets.
3. Confirm PayFast dashboard merchant profile email matches `info@tenderbriefing.co.za` (configured for same-account omit guard).
4. Critical `websocket-driver` advisories remain allowlisted pending Firebase major upgrade (review-by 2026-09-30).

---

## 2. Baseline reconciliation

| Claim | Verified |
|-------|----------|
| Audit tip `07ae694` | Yes — clean `master` / `origin/master` at sprint start |
| Pre REGISTRY `admin-cc-a7b0d58` → `tenderbriefing-00106-gh8` | Yes — matched live Cloud Run |
| Pre image digest | `sha256:0d6aac8bca0ed2683149f54a5490845b4f387063a58610b2b538e193a2ccda6e` |
| YAW / PI / Google Auth | Off / false / false (unchanged) |
| Automation budget | Live `240000` / margin `20000` / timeout `300` |
| `enterprise-v1.0.0` | Untouched |

Phase 0 quality suite: typecheck, lint, 169 unit tests, route-retirement / config / secrets / firestore-rules / google-auth QA — **PASS**.

---

## 3. Remediations by phase

| Phase | Finding | Action | Status |
|-------|---------|--------|--------|
| 1 | Fake profile save | `PATCH /api/auth/update-profile` + AuthProvider refresh | **Closed** |
| 2 | Legacy booking/matching/Yoco | 410 stubs; services → `_legacy/` | **Closed** |
| 3 | RFQ mailbox overclaim | Truthful paste-only copy (admin + SME) | **Closed** |
| 4 | Automation Promise.race / stale cert | AbortSignal cooperative cancel + cert **DEPLOYED** | **Closed** |
| 5 | `PAYFAST_MERCHANT_EMAIL` | Cloud Run env + readiness flag | **Closed** |
| 6 | Soft 404 tenders | Layout `notFound()` + `not-found.tsx` | **Closed** (smoke 404) |
| 7 | Apex SEO | Middleware 308 via `x-fh-requested-host` | **Closed** (smoke 308) |
| 8 | Scheduler secret headers | OIDC design doc; no unsafe flip | **Deferred** (designed) |
| 9 | Scrape status zeros | Real catalog stats / 503 if unavailable | **Closed** |
| 10 | Agent verification placeholders | Explicit pending + `submitVerification` | **Closed** |
| 11 | Env docs matrix | Full Cloud Run / example reconciliation | **Closed** |
| 12 | CI `npm audit \|\| true` | `npm-audit-gate.js` + allowlist | **Closed** |
| 13 | E2E skip | Secret posture + docs; no committed secrets | **Improved** |
| 14 | Observability | Attendance + automation `logEvent` | **Closed** |
| 15 | Obsolete docs | Archived under `docs/archive/` | **Closed** |

---

## 4. Security posture

- Profile updates: Admin SDK + `stripPrivilegedFields`.
- Legacy APIs: 410 + production route policy blocks.
- PayFast same-account omit guard active (`PAYFAST_MERCHANT_EMAIL` set).
- CI critical audit gated with explicit allowlist.
- No secrets in git/docs/logs.
- Intentionally disabled features not enabled.

---

## 5. Quality evidence

| Gate | Result |
|------|--------|
| Local typecheck / lint / unit (169) / QA scripts / build | PASS |
| PR #25 CI [31247095060](https://github.com/tenderbriefing/tender/actions/runs/31247095060) | PASS |
| PR #26 CI [31248144341](https://github.com/tenderbriefing/tender/actions/runs/31248144341) | PASS |
| Deploy #25 lineage [31247468569](https://github.com/tenderbriefing/tender/actions/runs/31247468569) | SUCCESS → `00107` |
| Deploy tip [31248485891](https://github.com/tenderbriefing/tender/actions/runs/31248485891) | SUCCESS → `00108` |

---

## 6. Git / release integrity

| Field | Value |
|-------|--------|
| Primary PR | https://github.com/tenderbriefing/tender/pull/25 |
| Follow-up PR | https://github.com/tenderbriefing/tender/pull/26 |
| Merge SHAs | `a24d313` (PR #25); `bd16ca4` (PR #26 tip) |
| Production revision | `tenderbriefing-00108-vqr` |
| Image digest | `sha256:6bce2b7a46cc6983fdf5aff7b867e4a624a887d27425c57e9510a05f8d35580a` |
| Cloud Build ID | `9da67852-118c-4e04-a5bc-28d865459f83` |
| REGISTRY tag | `audit-remed-bd16ca4` |

---

## 7. Production smoke (post-deploy)

| Check | Result |
|-------|--------|
| `GET /api/health/firestore` | **200** `{"status":"ok","connected":true}` |
| `GET /tenders` | **200** |
| Missing tender id | **404** |
| Apex `https://tenderbriefing.co.za/` | **308** → `https://www.tenderbriefing.co.za/…` |
| www home | **200** |
| Flags | YAW absent; PI false; Google Auth false; PayFast live + merchant email set |

Authenticated PayFast self-test intentionally **not** run (policy).

---

## 8. Residual conditions & backlog

1. **Scheduler OIDC cutover** — `docs/architecture/SCHEDULER_OIDC_MIGRATION.md`
2. **E2E_SME_TOKEN** in Actions (+ optional `REQUIRE_E2E_AUTH`)
3. Confirm PayFast dashboard merchant email == `info@tenderbriefing.co.za`
4. Firebase major upgrade to clear `websocket-driver` allowlist by **2026-09-30**
5. Optional Afrihost edge apex redirect (app middleware now works)
6. Mailbox webhook epic (explicitly deferred — copy fixed only)
7. Real agent ID document upload / KYC (pending by design)

---

## 9. Intentionally unchanged (by design)

| Item | Posture |
|------|---------|
| Youth Agent Workspace | Globally off |
| Procurement Intelligence | Flags false |
| Google Auth UI | Disabled |
| Meta WhatsApp webhook | Fail-closed |
| Push / SMS stubs | Explicit not implemented |
| `enterprise-v1.0.0` | Untouched rollback tag |

---

## 10. Overall readiness score

**8.6 / 10** — remediation scope production-certified; residuals are documented ops follow-ups, not paid-path blockers.

---

## 11. Sign-off

**Verdict: PASS WITH CONDITIONS**

Autonomous sprint completed: remediate → PR #25 → CI green → merge → deploy → apex host follow-up PR #26 → redeploy → smoke verified → REGISTRY updated. Residual conditions listed in §8.
