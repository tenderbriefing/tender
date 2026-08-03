# Procurement Intelligence Phase 1 — Pilot Certification

> **Superseded runtime (2026-08-03):** Authenticated pilot is live on SHA `3c177dd` / revision `tenderbriefing-00095-g97` with GSM allow-list (**2** UIDs), both global flags **false**. See `docs/reports/PROCUREMENT_INTELLIGENCE_PILOT_RESULTS.md` and `docs/reports/PRODUCTION_BASELINE_PI_PILOT_3C177DD.md`.

**Certified (evidence collected):** 2026-08-03T07:40:39Z (post-deploy verification)  
**Deploy completed:** 2026-08-02T18:18:39Z  
**Verdict:** **PASS WITH CONDITIONS**

---

## 1. Executive verdict

**PASS WITH CONDITIONS**

Production runs merge SHA `91a7871` with Procurement Intelligence Phase 1 code present and **globally disabled**. Empty `PROCUREMENT_INTELLIGENCE_PILOT_UIDS` → approved pilot UID count = **0** → authenticated pilot validation **BLOCKED** (by design). No redeploy performed; live revision matched required SHA provenance.

## 2. Certified starting SHA

`6e6597264faf4cfcd25c09060d93bc5e406c008b` (`enterprise-v1.0.0`) — pre-PI production baseline.

## 3. Deployed SHA

`91a787103cef2f76372a47761ee65d944824199f` (merge of PR #9; contains `f94b51b` fail-closed pilot allow-list).

**SHA proof (not branch inference alone):**

| Evidence | Result |
|----------|--------|
| Deploy workflow `headSha` | `91a787103cef2f76372a47761ee65d944824199f` |
| Checkout in all deploy jobs | `HEAD is now at 91a7871` |
| Annotated tag `pi-phase1-91a7871` peeled | `91a787103cef2f76372a47761ee65d944824199f` |
| Cloud Build source tarball file hashes | Match workspace at `91a7871` for `featureFlag.ts`, intelligence route, `cloudbuild.yaml`, `package.json`, `firestore.rules` |
| Revision env `GIT_SHA` / `COMMIT` | **Not set** on Cloud Run (build does not inject commit env); provenance is workflow + source tarball + image tag = build ID |

## 4. Branch and tag

- Branch: `master` @ `91a7871`
- Tag: `pi-phase1-91a7871` (annotated; peeled → `91a7871`)
- PR: [#9](https://github.com/tenderbriefing/tender/pull/9) merged 2026-08-02T17:53:20Z
- Security fix tip in merge: `f94b51b25c62b0e0cf00f80f99acdad4a281369f`

## 5. Workflow run ID

| Run | Role | Conclusion | Updated UTC |
|-----|------|------------|-------------|
| [30759869282](https://github.com/tenderbriefing/tender/actions/runs/30759869282) | Post-merge CI | **success** | 2026-08-02T18:02:00Z |
| [30760212862](https://github.com/tenderbriefing/tender/actions/runs/30760212862) | Deploy TenderBriefing (`workflow_dispatch`) | **success** | 2026-08-02T18:18:39Z |

Deploy jobs (all success): Auth & Firestore rules QA; Firebase (rules, indexes, storage, hosting); Cloud Run africa-south1; Hosting proxy europe-west1; Verify domains & health.

## 6. Build ID

`44c4a235-fac9-4d1c-82b0-5513686161ef`  
Created 2026-08-02T18:06:19Z · finished 2026-08-02T18:15:59Z · duration 8M48S · STATUS SUCCESS  
Region: `africa-south1` · project `tenderbriefing-34679`

## 7. Revision or hosting release

- Cloud Run latestReady: **`tenderbriefing-00090-tgb`**
- Hosting: Firebase Hosting release complete for `tenderbriefing-34679` (URL https://tenderbriefing-34679.web.app)
- Hosting proxy: europe-west1 job success (2026-08-02T18:18:19Z)

## 8. Image digest

`sha256:529cb09dedaf730cb1da0a81b0551d33929d23c0f12949d30d11eac3a1287e3b`  

FQDN: `africa-south1-docker.pkg.dev/tenderbriefing-34679/tenderbriefing/tenderbriefing@sha256:529cb09dedaf730cb1da0a81b0551d33929d23c0f12949d30d11eac3a1287e3b`  

Tag: `44c4a235-fac9-4d1c-82b0-5513686161ef` (= Cloud Build ID)

## 9. Traffic allocation

**100%** → `tenderbriefing-00090-tgb` (`latestRevision: true`)

## 10. Firestore rules and indexes status

From deploy job logs (2026-08-02T18:05:22Z–18:05:36Z):

- ✔ `firestore.rules` compiled and **released** to `cloud.firestore`
- ✔ indexes from `firestore.indexes.json` **deployed successfully** for `(default)` database
- ✔ `storage.rules` released
- ✔ Hosting version finalized / release complete — **Deploy complete!**

## 11. Auth smoke results by scenario

| Scenario | Result | Evidence |
|----------|--------|----------|
| `/api/health/firestore` www | **PASS** 200 `{"status":"ok","connected":true}` | curl 2026-08-03T07:40:42Z |
| Health apex / web.app / Cloud Run | **PASS** 200 ok/connected | curl same window |
| Deploy verify domains | **PASS** health 200; www/apex/web.app 200 | job 91530833879 |
| PI API unauth | **PASS fail-closed** 401 middleware (`Unauthorized — sign in required`) before route; route would return 503 `feature_disabled` when enabled-check runs | curl + `middleware.ts` + route source |
| Tender detail HTML panel leakage | **PASS** no rendered Opportunity Fit / eligibility panel in SSR HTML; client gate baked `false&&false` | curl + chunk inspect |
| `/bookings` retirement | **PASS** 307 (server `redirect('/sme/requests')`) | curl + `app/bookings/page.tsx` |
| `/api/bookings` retirement | **PASS** 404 `This API is not available in production` | curl |
| `/auth/signin` | **PASS** 200 | curl |
| Admin PI page unauth HTML | 200 shell (client auth); admin PI API **401** | curl |
| Email/password / Google IdP / session E2E | **MANUAL / BLOCKED** (no smoke credentials; no invented pilot UIDs) | — |
| Authenticated PI pilot | **BLOCKED** — pilot UID count = 0 | Cloud Run env |
| Live PayFast | **NOT RUN** (non-destructive cert) | — |

## 12. Production runtime evidence

| Flag / env on `tenderbriefing-00090-tgb` | Value |
|------------------------------------------|-------|
| `PROCUREMENT_INTELLIGENCE_ENABLED` | `false` |
| `NEXT_PUBLIC_PROCUREMENT_INTELLIGENCE_ENABLED` | `false` |
| `PROCUREMENT_INTELLIGENCE_PILOT_UIDS` | empty (key present, no value) |
| Approved pilot UID count | **0** |

PI AI/enrichment cost with flags off: **~0** (no OpenAI required for Phase 1 scoring; API gated).

## 13. Rollback baseline

| Field | Value |
|-------|--------|
| Tag | `enterprise-v1.0.0` (**do not modify/delete**) |
| SHA | `6e6597264faf4cfcd25c09060d93bc5e406c008b` |
| Revision | `tenderbriefing-00089-zv9` |
| Image digest | `sha256:ad6eeb8c8afb86c9ae1aa61d1d3100cbb2c4e7cc190a862236828bceecf898b3` |
| Prior deploy | [30653868712](https://github.com/tenderbriefing/tender/actions/runs/30653868712) |
| Procedure | `docs/runbooks/ROLLBACK.md` + `docs/runbooks/PROCUREMENT_INTELLIGENCE_FLAGS.md` |

## 14. Conditions or manual residuals

1. **Authenticated pilot validation BLOCKED** until real Firebase Auth UIDs are added to `PROCUREMENT_INTELLIGENCE_PILOT_UIDS` (Cloud Run env / Secret Manager) and server flag enabled under controlled change.
2. No `GIT_SHA` env on revision — commit provenance via Actions checkout + source tarball hash match (documented above).
3. Residual P1: secret-gated full authenticated UI E2E (enterprise programme carry-forward).
4. Ops: Cloud Armor / monitoring alert attachment still operational residual from enterprise baseline.
5. Build source tarball historically included a runner creds filename under upload contents — treat as ops hygiene (ensure `.gcloudignore` / upload exclusions); do not commit secrets.

## 15. Certification document locations

- `docs/reports/PROCUREMENT_INTELLIGENCE_PHASE1_PILOT_CERTIFICATION.md` (this file)
- `docs/reports/ENTERPRISE_V1_EXECUTION_REPORT.md`
- `docs/releases/REGISTRY.md`
- `docs/runbooks/PROCUREMENT_INTELLIGENCE_FLAGS.md`
- `docs/runbooks/ROLLBACK.md`
- `docs/architecture/PROCUREMENT_INTELLIGENCE_PHASE1.md`
- `docs/adr/009-procurement-intelligence-phase1.md`

---

## Workstream 2 — Feature delivery (post-merge production)

### 1. Executive verdict

**PASS WITH CONDITIONS** — code merged and deployed disabled; pilot auth blocked.

### 2. Starting production baseline SHA

`6e6597264faf4cfcd25c09060d93bc5e406c008b`

### 3. Final feature SHA

`91a787103cef2f76372a47761ee65d944824199f` (merge); tip of feature before merge `f94b51b25c62b0e0cf00f80f99acdad4a281369f`

### 4. Branch

`feature/procurement-intelligence-phase-1` → merged to `master`

### 5. Ahead/behind status

`master` matches `origin/master` at `91a7871` at certification time (pre-docs commit).

### 6. Commits created (feature lineage into merge)

`2c42d8d` feat → `ca3e3d1` docs → `ac21827` docs → `f94b51b` fail-closed fix → `91a7871` merge PR #9

### 7. Files created (representative)

`lib/procurement/intelligence/*`, `app/api/procurement/intelligence/[tenderId]/route.ts`, `components/procurement/SmeProcurementIntelligencePanel.tsx`, `tests/unit/procurementIntelligence.test.ts`, ADR-009, architecture doc

### 8. Files modified (representative)

Tender detail page, `firestore.rules` (`smeTenderIntelligence`), `cloudbuild.yaml` (flags pinned false), `.env.local.example`

### 9. Architecture summary

Deterministic pipeline: listing facts → eligibility → Opportunity Fit → checklist → actions; API `GET /api/procurement/intelligence/[tenderId]`; SME panel gated by public+server flags.

### 10. Data model summary

Source: `tenderBriefings`. Optional progress: `smeTenderIntelligence/{smeId}/tenders/{tenderId}` (owner/admin rules).

### 11. Intelligence capabilities delivered

Structured summary, non-definitive eligibility classes, Opportunity Fit 0–100, compliance checklist, recommended actions (including book-agent). Schema `pi-phase1-1.0.0`.

### 12. Eligibility and scoring methodology

Rule-based; `definitiveEligible: false` always; rules version `opportunity-fit-1.0.0`; never award probability.

### 13. Security and tenant-isolation controls

Bearer SME/admin; pilot allow-list fail-closed when empty; middleware auth on non-public APIs; Firestore rules for progress docs; no invented UIDs used in cert.

### 14. Prompt-injection protections

Phase 1 uses structured listing fields + fixed rules (no document-driven LLM system override).

### 15. Feature-flag and pilot status

**Disabled globally.** Pilot UID list empty → count **0**. Enable path documented in `docs/runbooks/PROCUREMENT_INTELLIGENCE_FLAGS.md`.

### 16. Tests run and exact results

| Suite | Result | Source |
|-------|--------|--------|
| Unit + integration (vitest) | **31 passed** / 8 files | CI [30759869282](https://github.com/tenderbriefing/tender/actions/runs/30759869282) + local reconfirm 2026-08-03 |
| PI unit subset | **3 passed** | `tests/unit/procurementIntelligence.test.ts` |
| Firestore emulator IDOR | **24 passed** / 1 file | CI job Firestore emulator |
| Playwright public/a11y | **10 passed** | CI Playwright job |
| Typecheck / lint / production build | SUCCESS (CI jobs) | 30759869282 |

### 17. CI run and status

[30759869282](https://github.com/tenderbriefing/tender/actions/runs/30759869282) **success** on `91a7871`

### 18. Performance findings

No unrestricted backfill; Phase 1 scoring is in-process deterministic (no external AI call required).

### 19. AI usage and cost controls

Flags off → no PI API computation for clients; ~0 incremental AI cost.

### 20. Migration or backfill status

Additive only; no destructive migration; no tender backfill executed.

### 21. Deployment status

**Deployed** via [30760212862](https://github.com/tenderbriefing/tender/actions/runs/30760212862) to revision `tenderbriefing-00090-tgb` @ 100%, feature disabled.

### 22. Known residual risks

Pilot not exercised live; authenticated E2E secret-gated; ops monitoring/Armor residuals.

### 23. Rollback instructions

1. Kill switch: keep/set PI flags `false` (already false).  
2. Traffic rollback: redeploy tag `enterprise-v1.0.0` or route to `tenderbriefing-00089-zv9` per `docs/runbooks/ROLLBACK.md`.  
3. Do not delete `enterprise-v1.0.0`.

### 24. Recommended next action

Provision **real** approved SME Firebase Auth UIDs into Cloud Run / Secret Manager `PROCUREMENT_INTELLIGENCE_PILOT_UIDS`, enable server flag only for that allow-list, run bounded authenticated pilot validation — **do not** globally enable without explicit product decision.
