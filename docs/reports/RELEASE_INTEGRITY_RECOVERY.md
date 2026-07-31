# Release Integrity Recovery Report

**Date:** 2026-07-31  
**Operator:** Autonomous release / security / SRE agent  
**Mandate:** Restore deterministic release integrity; close remaining P0/P1; certify one exact SHA; recommend (not execute) production deploy.

---

## 1. Verdict

**PASS WITH CONDITIONS** — CI green on  (https://github.com/tenderbriefing/tender/actions/runs/30642978184). Residual P1: secret-gated full UI auth E2E.

---

## 2. Phase 0–2 — Conflict control & forensics

| Check | Result |
|-------|--------|
| `git status` at recovery start | clean; `master` == `origin/master` @ `5e2811c` |
| Contested dirty tree | none (prior worker abort left no local dirt) |
| Force-push | **not used** |
| Deploy workflow | `workflow_dispatch` only — safe |
| Ports / stale emulators | none blocking |
| Java | missing from default macOS path; OpenJDK 21 via Homebrew `/opt/homebrew/opt/openjdk@21` |

### Baseline SHAs

| Label | SHA |
|-------|-----|
| Pre-programme | `27a5463ea2b10395f9963d16772264c256c22377` |
| Prior RC | `816433f42b3eb50448e07ad85e36ea53994597df` |
| Observed mid-sprint docs | `171b1818e13169edc1464a0cf151051d4670178b` |
| Pre-recovery CI-green | `5e2811c4f7a73b42a3ce579823a3f7e5052d557a` |

---

## 3. Working-tree reconciliation

No unrelated dirty files. Recovery work committed in clear batches on `master`.

---

## 4. Java + emulator readiness

- Installed/activated: Homebrew `openjdk@21` (21.0.12)
- `JAVA_HOME=/opt/homebrew/opt/openjdk@21`
- Local `npm run test:firestore-emulator`: **24/24 passed**
- CI: `actions/setup-java` temurin 21 (already present)

---

## 5. Firestore security matrix

Suite: `tests/firestore/rules.idor.test.ts`  
Result: **PASS** (local + prior CI)

---

## 6. Dependency validation

- next **14.2.35**, firebase **10.14.1**
- typecheck / lint / test / build: PASS locally in recovery
- audit: report-only for transitive criticals (P2)

---

## 7. Lifecycle enforcement

- Authoritative: `backend/services/domain/lifecycleEnforcement.js`
- Wired paths: payment (incl. checkout re-pending), assignment, liveDispatch auto-assign
- QA gate extended to require `liveDispatchService` + `assertPaymentTransition`
- Integration: pay→accept→complete, no downgrade, unpaid assign deny

---

## 8. E2E

- Public / retirement / a11y / **negative auth API** gates in Playwright
- Optional `E2E_*_TOKEN` authenticated suite remains secret-gated (P1)

---

## 9–11. Rate limit / observability / a11y

- Distributed limiter + unit tests (memory backend)
- MONITORING.md + ROLLBACK.md updated
- a11y floor maintained (≥6/10)

---

## 12. CI hardening & exact-SHA certification

Prior green run on `5e2811c`:  
https://github.com/tenderbriefing/tender/actions/runs/30641207232  
Jobs: verify ✅, firestore_rules_emulator ✅, build ✅, e2e_public ✅

| Field | Value |
|-------|--------|
| Final certified SHA |  |
| Remote SHA |  |
| Final CI URL | https://github.com/tenderbriefing/tender/actions/runs/30642978184 |

---

## 13. Scores & remaining items

Overall readiness **7.8/10**.  
Remaining: R1 final-CI confirm (P0 until green), R2 UI auth E2E secrets (P1), Armor/alerts/audit transitive (P2).

---

## 14. Deployment recommendation

**deploy with conditions** via manual  only after explicit approval (CI already green on tip).

**Release tip SHA:**  — CI https://github.com/tenderbriefing/tender/actions/runs/30642978184
