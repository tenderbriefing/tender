# Tender Briefing — Enterprise Release Certification Report

**Programme:** Enterprise Release Certification Sprint  
**Date:** 2026-07-31  
**Previous RC:** `816433f` (PASS WITH CONDITIONS, 6.4/10)  

---

## 1. Executive verdict

**PASS WITH CONDITIONS**

P0 Next/Firebase advisories are resolved on the release SHA. Lifecycle enforcement is wired into active payment/assignment/dispatch mutation paths with regression tests. Firestore emulator IDOR suite is implemented and gated in CI (Java emulator not available on the local macOS agent; **CI must be green on the pushed SHA before deploy**). Full browser-authenticated E2E remains optional-secret gated; service-layer authenticated workflows pass.

No unresolved *code* P0 remains that we can close without infrastructure (Java locally / E2E secrets). Residual release conditions are operational: confirm CI emulator + public E2E jobs on the remote SHA.

---

## 2. Git integrity

| Field | Value |
|-------|--------|
| Sprint start RC | `816433f42b3eb50448e07ad85e36ea53994597df` |
| Final SHA | *(see HEAD after commits)* |
| Branch | `master` |
| Remote | push intended to `origin/master` (no production deploy) |
| Pre-programme LKG | `27a5463` |

---

## 3. Conditions closed

| Condition | Previous | Implementation | Evidence | Result |
|-----------|----------|----------------|----------|--------|
| Firestore emulator IDOR | P0 open | `tests/firestore/rules.idor.test.ts` + CI job | Suite authored; local Java missing; CI job `firestore_rules_emulator` | **CONDITIONAL** — awaiting CI green |
| Authenticated E2E | P0 open | Integration workflow + Playwright public/a11y + optional token tests | `npm test` 25 pass; Playwright suite added | **PARTIAL** — full UI auth needs secrets |
| Lifecycle enforcement | P0 open | `lifecycleEnforcement.js` wired in assignment, payment, liveDispatch | Unit + integration tests | **CLOSED** |
| Next/Firebase advisories | P0 open | Next `14.2.35`, Firebase `10.14.1` | package.json + build | **CLOSED** |
| Distributed rate limit | P1 | Firestore buckets + handler wiring; Armor docs | `distributedRateLimit.js`, RATE_LIMITING.md | **CLOSED** (Armor optional ops) |
| Observability | P1 | Events + MONITORING.md | logger + ITN/PDF/payment logs | **CLOSED** (prod alert attach ops) |
| Rollback | P1 | Updated ROLLBACK.md vs `27a5463` | Additive schema only | **CLOSED** |
| Accessibility floor | P1 | axe Playwright + SME aria-live | e2e a11y test | **IMPROVED** (~6/10) |

---

## 4. Firestore security certification

Collections: `users`, `attendanceRequests`, `briefingReports`, `auditLogs`, `rateLimitBuckets`  
Identities: unauth, SME A/B, agent A/B, admin, suspended profile seeded  
IDOR scenarios covered in emulator suite (cross-SME, payment escalate, agent escalate, audit write, role escalate, guessed IDs).  
**Local run:** blocked (no JRE). **CI:** Java 21 + `npm run test:firestore-emulator`.

---

## 5. E2E certification

| Suite | Result |
|-------|--------|
| Service workflow (SME pay accept complete) | PASS (2 tests) |
| Playwright public/retirement/a11y | Authored; runs in CI after build |
| Optional token authenticated | Skipped without `E2E_*_TOKEN` |
| Residual manual | Live PayFast ITN in production smoke |

---

## 6. Lifecycle enforcement

Active paths migrated: `attendancePaymentService`, `agentAssignmentService`, `liveDispatchService` auto-assign.  
Obsolete: Yoco 410; bookings 410.  
Bypass remaining: QA/smoke scripts that force `paymentStatus=paid` (test-only, not production handlers).  
Concurrency: second agent accept rejected after assign; duplicate ITN idempotent.

---

## 7. Dependency security

| Package | Before | After | Advisories |
|---------|--------|-------|------------|
| next | 14.0.4 | **14.2.35** | CVE-2024-51479, CVE-2025-29927, CVE-2025-57822 addressed in 14.2.x line |
| firebase | 9.23.0 | **10.14.1** | CVE-2024-11023 (≥10.9.0) |
| Remaining | — | npm audit still reports transitive high/critical | Tracked P2; do not force-audit-fix |

Rollback: pin prior versions in package.json + lockfile from `816433f`.

---

## 8. Rate limiting

Firestore-backed shared limiter for attendance create, payment create, PDF download; middleware memory for public GETs; PayFast ITN high ceiling. Cloud Armor provisioning documented — not provisioned in this sprint (ops).

---

## 9. Observability

Structured events for payment/ITN/PDF/rate-limit/webhook. Monitoring runbook + alert recommendations. Production alert policies still require GCP console attachment (ops).

---

## 10. Accessibility

Score target ≥6/10: SME requests already has `main` + loading `role=status`; added `aria-live` on status summary; Playwright axe wcag2a on home (critical=0). Remaining: broader WCAG AA across admin/agent mobile.

---

## 11. CI evidence

Workflow `.github/workflows/ci.yml` jobs: `verify`, `firestore_rules_emulator`, `build`, `e2e_public`.  
Exact SHA evidence: after push, GitHub Actions run URL.

---

## 12. Enterprise-readiness scores (/10)

| Category | Score |
|----------|-------|
| Architecture | 8 |
| Security | 8 |
| Payments | 8 |
| Data integrity | 8 |
| Testing | 7 |
| Observability | 7 |
| Reliability | 7 |
| Performance | 6 |
| Accessibility | 6 |
| Developer experience | 8 |
| Deployment maturity | 8 |
| Operational readiness | 7 |

**Overall: 7.3 / 10** (below 8.0 target — justified by pending CI emulator confirmation and secret-gated full UI E2E)

---

## 13. Remaining risks

| ID | Item | Class |
|----|------|-------|
| R1 | Confirm CI Firestore emulator job green on pushed SHA | P0 until CI green |
| R2 | Full browser auth E2E without secrets | P1 |
| R3 | Cloud Armor not yet attached | P2 |
| R4 | Transitive npm audit findings | P2 |
| R5 | Dual backend JS/TS boundary | P2 |

---

## 14. Deployment recommendation

**do not deploy** until:

1. Push completes  
2. CI `firestore_rules_emulator` + `verify` + `build` + `e2e_public` are green on the exact SHA  
3. Explicit production approval  

Then: **deploy with conditions** (monitor ITN; WhatsApp remains fail-closed unless configured).

---

## 15. Controlled production smoke plan

(See prior plan — SHA verification, Cloud Run revision, SME book→PayFast→ITN→assign→complete, PDF ownership, cross-user deny, legacy 410, log verification.)

---

## 16. Rollback readiness

Last known good: `27a5463` (pre-programme) or `816433f` (prior RC).  
Process: `docs/runbooks/ROLLBACK.md`. Additive fields only; rules rollback re-opens privileged client writes — avoid.
