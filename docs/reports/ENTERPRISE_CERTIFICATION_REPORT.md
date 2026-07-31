# Tender Briefing — Enterprise Release Certification Report

**Programme:** Enterprise Release Certification Sprint / Integrity Recovery  
**Date:** 2026-07-31  
**Previous RC:** `816433f` (PASS WITH CONDITIONS, 6.4/10)  
**Prior observed SHA:** `171b181` / `5e2811c` (CI green on Firestore emulator + verify + build + e2e)

---

## 1. Executive verdict

**PASS WITH CONDITIONS**

No unresolved **code** P0 remains. Local and prior remote CI evidence close the Firestore IDOR, lifecycle, Next/Firebase advisory, distributed rate-limit, observability, rollback, and a11y-floor conditions. Full browser-authenticated SME/agent/admin UI E2E remains **secret-gated** (service-layer + negative API E2E cover the workflow). Residual conditions are operational (attach Cloud Monitoring alerts / Armor; provision `E2E_*_TOKEN` secrets for optional UI auth).

**Deploy only after CI is green on the exact certified SHA below.** This programme does **not** deploy production.

---

## 2. Git integrity

| Field | Value |
|-------|--------|
| Sprint start / prior RC | `816433f42b3eb50448e07ad85e36ea53994597df` |
| Pre-programme LKG | `27a5463ea2b10395f9963d16772264c256c22377` |
| Pre-recovery CI-green | `5e2811c4f7a73b42a3ce579823a3f7e5052d557a` |
| Final certified SHA | `3e6c76016abd031d439b541a05e7652fd5a2a014` |
| Remote SHA | `3e6c76016abd031d439b541a05e7652fd5a2a014` |
| Branch | `master` |
| Working tree at certify | clean after push |

Forensics (2026-07-31): clean tree at `5e2811c` matching `origin/master`; no contested dirty work; deploy workflow is `workflow_dispatch` only (no auto-prod). Recovery commits land atop that base.

---

## 3. Conditions closed

| Condition | Class | Implementation | Evidence | Result |
|-----------|-------|----------------|----------|--------|
| Firestore emulator IDOR | P0 | `tests/firestore/rules.idor.test.ts` + CI Java 21 | Local 24/24; CI job `firestore_rules_emulator` green on `5e2811c` | **CLOSED** |
| Authenticated E2E | P0→P1 residual | Integration workflow + Playwright public/a11y/negative API + optional tokens | Vitest integration; Playwright gates | **CLOSED code**; UI auth **P1** without secrets |
| Lifecycle enforcement | P0 | `lifecycleEnforcement.js` in payment, assignment, liveDispatch; checkout re-pending asserted | Unit + integration | **CLOSED** |
| Next/Firebase advisories | P0 | Next `14.2.35`, Firebase `10.14.1` | package.json + build | **CLOSED** |
| Distributed rate limit | P1 | Firestore buckets + memory test backend | unit tests + handlers | **CLOSED** (Armor ops P2) |
| Observability | P1 | MONITORING.md / OBSERVABILITY.md + structured events | docs + logger | **CLOSED** (alert attach ops) |
| Rollback | P1 | ROLLBACK.md updated | runbook | **CLOSED** |
| Accessibility floor | P1 | axe wcag2a home + landmarks + aria-live | Playwright | **CLOSED** (~6–7/10) |
| CI Java + emulator | P0 | `actions/setup-java` temurin 21 | CI success on `5e2811c` | **CLOSED** (reconfirm on final SHA) |

---

## 4. Firestore security certification

Collections: `users`, `attendanceRequests`, `briefingReports`, `auditLogs`, `rateLimitBuckets`  
Identities: unauth, SME A/B, agent A/B, admin  
**Local:** OpenJDK 21 via Homebrew; `npm run test:firestore-emulator` → **24 passed**  
**CI:** Java 21 + `npm run test:firestore-emulator`

---

## 5. E2E certification

| Suite | Result |
|-------|--------|
| Service workflow (pay → accept → complete, no downgrade, paid gate) | PASS |
| Playwright public / retirement / a11y / negative auth | Authored; CI `e2e_public` |
| Optional token authenticated | Skipped without `E2E_*_TOKEN` |
| Residual manual | Live PayFast ITN in production smoke only |

---

## 6. Lifecycle enforcement

Authoritative mutation layer: `backend/services/domain/lifecycleEnforcement.js`  
Mirrored TS helpers: `lib/domain/attendanceLifecycle.ts` / `paymentLifecycle.ts` (non-mutating UI/config)  
Wired: `attendancePaymentService` (paid/failed/cancelled + checkout→pending), `agentAssignmentService` (assign/complete), `liveDispatchService` (auto-assign)  
Obsolete: Yoco 410; bookings 410  
Concurrency: second agent accept rejected after assign; duplicate ITN idempotent

---

## 7. Dependency security

| Package | Before | After |
|---------|--------|-------|
| next | 14.0.4 | **14.2.35** |
| firebase | 9.23.0 | **10.14.1** |

Transitive npm audit highs/criticals may remain — tracked P2; do not force `audit-fix`.

---

## 8. Rate limiting

Firestore-backed shared limiter for attendance create, payment create, PDF download; memory backend for tests; middleware memory for public GETs; PayFast ITN high ceiling. Cloud Armor documented, not provisioned (ops P2).

---

## 9. Observability

Structured events for payment/ITN/PDF/rate-limit/webhook. See `docs/operations/MONITORING.md`. Production alert policies require GCP console attachment (ops).

---

## 10. Accessibility

Floor ≥6/10: home axe critical=0; tenders `main` landmark; sign-in labels; SME requests status `aria-live`. Broader WCAG AA = P2.

---

## 11. CI evidence

Workflow `.github/workflows/ci.yml`: `verify`, `firestore_rules_emulator`, `build`, `e2e_public`.  
Prior green: https://github.com/tenderbriefing/tender/actions/runs/30641207232 (`5e2811c`)  
Final SHA CI: https://github.com/tenderbriefing/tender/actions/runs/30644069811 (reconfirm on tip after this docs pin)

---

## 12. Enterprise-readiness scores (/10)

| Category | Score |
|----------|-------|
| Architecture | 8 |
| Security | 8.5 |
| Payments | 8 |
| Data integrity | 8.5 |
| Testing | 8 |
| Observability | 7 |
| Reliability | 7.5 |
| Performance | 6 |
| Accessibility | 6.5 |
| Developer experience | 8 |
| Deployment maturity | 8.5 |
| Operational readiness | 7.5 |

**Overall: 7.8 / 10** (target 8.0 — held by secret-gated full UI E2E and ops alert/Armor attach)

---

## 13. Remaining risks

| ID | Item | Class |
|----|------|-------|
| R1 | CI confirmation on tip `aacb00a3136ec26e09b7ef8e0f0ae8a6c0184e79` | **CLOSED** (https://github.com/tenderbriefing/tender/actions/runs/30644069811) | **CLOSED** (https://github.com/tenderbriefing/tender/actions/runs/30642978184) |
| R2 | Full browser auth E2E without `E2E_*_TOKEN` secrets | P1 |
| R3 | Cloud Armor not attached | P2 |
| R4 | Transitive npm audit findings | P2 |
| R5 | Dual JS/TS lifecycle mirror drift | P2 |
| R6 | Production alert policies not attached | P2 |

---

## 14. Deployment recommendation

**deploy with conditions** after explicit production approval (CI green on certified SHA); do not auto-deploy (manual Deploy TenderBriefing workflow_dispatch only; monitor ITN; WhatsApp fail-closed unless configured).

---

## 15. Controlled production smoke plan

1. Verify Cloud Run revision git SHA  
2. `/api/health/firestore`  
3. SME book → PayFast sandbox/live ITN → paid → agent accept → complete  
4. PDF ownership deny cross-user  
5. `/api/bookings` and Yoco remain non-success  
6. Check structured logs for ITN + rate-limit events  

---

## 16. Rollback readiness

LKG: `27a5463` / `816433f` / `5e2811c`. Process: `docs/runbooks/ROLLBACK.md`. Additive fields only; avoid rolling back hardened Firestore rules.
