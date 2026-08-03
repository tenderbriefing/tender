# Procurement Intelligence Phase 1 — Authenticated Pilot Certification

**Certified:** 2026-08-03T13:16:44Z (UTC) / 2026-08-03T15:16:44+02:00 (SAST)  
**Verdict:** **PASS WITH CONDITIONS**

Consolidated 49-section report for authenticated pilot activation while **both global flags remain false**.

---

## 1. Executive verdict

**PASS WITH CONDITIONS** — Authenticated pilot is live. Exact UIDs on GSM allow-list access PI; non-listed users denied; both `PROCUREMENT_INTELLIGENCE_ENABLED` and `NEXT_PUBLIC_PROCUREMENT_INTELLIGENCE_ENABLED` are **false**. Tenant isolation and revoke/restore verified. Residuals: no full production Playwright UI matrix; structural fact harness (not PDF OCR adjudication).

## 2. Semantics implemented

| Control | Meaning |
|---------|---------|
| `PROCUREMENT_INTELLIGENCE_ENABLED=false` | Not globally enabled |
| `NEXT_PUBLIC_…=false` | Advisory UI mirror off; pilots discover panel via API **200** |
| Non-empty `PROCUREMENT_INTELLIGENCE_PILOT_UIDS` | Exact UIDs may access (pilot path) even when flags false |
| Empty / non-matching list + flags false | Deny-all (503 if empty+disabled; 403 if list non-empty but UID not listed) |

Code: `lib/procurement/intelligence/featureFlag.ts` (`canAccessProcurementIntelligence`). Prior design required ENABLED=true before pilot check — **impossible** for this mandate; fixed in PR #10.

## 3. Pre-activation baseline (Phase 1)

| Field | Value |
|-------|--------|
| SHA | `91a787103cef2f76372a47761ee65d944824199f` |
| Tag | `pi-phase1-91a7871` |
| Revision | `tenderbriefing-00090-tgb` @ 100% |
| Digest | `sha256:529cb09dedaf730cb1da0a81b0551d33929d23c0f12949d30d11eac3a1287e3b` |
| Flags | both **false** |
| Pilot count | **0** |
| Deploy | [30760212862](https://github.com/tenderbriefing/tender/actions/runs/30760212862) |
| Health | 200 ok/connected |
| Unauth PI | 401 |
| Baseline UTC/SAST | 2026-08-03T11:53:29Z / 13:53:29+0200 |

## 4. Certified starting SHA (enterprise rollback)

`6e6597264faf4cfcd25c09060d93bc5e406c008b` (`enterprise-v1.0.0`)

## 5. Final deployed code SHA

`a6d2b922e634efc64e8ebe1b5886f4b46006a087` (includes PR #10 pilot-with-flags-false + PR #11 progress read rules)

## 6. Intermediate pilot activation SHA

`3c177dd73595f3325672626603dbae4e06fd2063` (`pi-pilot-3c177dd`) — first authenticated pilot image digest `sha256:fd66ab379a202aec3f182a0479f3eae96b073c8bcef21d7f29532a079627b866`

## 7. Branch and tags

| Ref | SHA |
|-----|-----|
| `master` | `a6d2b92…` |
| Tag `pi-pilot-3c177dd` | `3c177dd…` |
| Tag `pi-pilot-rules-a6d2b92` | `a6d2b92…` |
| Tag `pi-phase1-91a7871` | `91a7871…` |
| Tag `enterprise-v1.0.0` | `6e65972…` (**preserve**) |

## 8. Pull requests

| PR | Purpose | CI |
|----|---------|-----|
| [#10](https://github.com/tenderbriefing/tender/pull/10) | Pilot allow-list independent of global flags; GSM binding; UI API probe | [30811591073](https://github.com/tenderbriefing/tender/actions/runs/30811591073) success |
| [#11](https://github.com/tenderbriefing/tender/pull/11) | Fix progress doc reads (`request.resource` write-only); IDOR tests | [30814049322](https://github.com/tenderbriefing/tender/actions/runs/30814049322) success |

## 9. Workflow run IDs (deploy)

| Run | Ref | Conclusion | Finished UTC |
|-----|-----|------------|--------------|
| [30812294505](https://github.com/tenderbriefing/tender/actions/runs/30812294505) | `pi-pilot-3c177dd` | success | ~2026-08-03T12:23Z |
| [30814718880](https://github.com/tenderbriefing/tender/actions/runs/30814718880) | `pi-pilot-rules-a6d2b92` | success | 2026-08-03T12:59:28Z |

Manual `workflow_dispatch` only — no auto-deploy.

## 10. Cloud Build IDs

| Build | Role |
|-------|------|
| `9625b2fd-aefc-474e-bdbc-007117841557` | Pilot code image (`3c177dd`) |
| `04107842-040e-4bc0-980f-fdd1bc2d4d04` | Rules+code image (`a6d2b92`) |

## 11. Current Cloud Run revision

**`tenderbriefing-00096-h4h`** @ **100%** traffic (`latestRevision: true`)

## 12. Image digest (current)

`sha256:853b9d5e003f60c7a6f02295a520b031132254032c43ebd4b19642c24e1954d5`

## 13. Traffic allocation

100% → `tenderbriefing-00096-h4h`

## 14. Feature flags (live)

| Variable | Value |
|----------|--------|
| `PROCUREMENT_INTELLIGENCE_ENABLED` | `false` |
| `NEXT_PUBLIC_PROCUREMENT_INTELLIGENCE_ENABLED` | `false` |

## 15. Pilot allow-list configuration

| Field | Value |
|-------|--------|
| Source | GSM secret `procurement-intelligence-pilot-uids` → Cloud Run env (secretKeyRef `:latest`) |
| Count | **2** |
| Masks | `DT64…ag53`, `dGkf…s9e2` |
| Survive redeploy | Yes (bound in `cloudbuild.yaml` `--set-secrets`) |

## 16. Identity discovery (Phase 2)

Preferred existing ops-smoke / tenderbriefing.co.za QA accounts — no ordinary customer subjects.

## 17. Pilot A (internal/admin)

| Field | Value |
|-------|--------|
| Email | ops-smoke-admin@tenderbriefing.co.za |
| UID mask | `DT64…ag53` |
| Type | admin |
| Synthetic | no |

## 18. Pilot B (SME)

| Field | Value |
|-------|--------|
| Email | ops-smoke-sme@tenderbriefing.co.za |
| UID mask | `dGkf…s9e2` |
| Type | sme |
| Synthetic | no |

## 19. Control C (SME non-pilot)

| Field | Value |
|-------|--------|
| Email | ops-smoke-sme-control@tenderbriefing.co.za |
| UID mask | `p0ox…z2P2` |
| Type | sme |
| Synthetic | **yes** (`cleanupTag=pi-phase1-pilot-synthetic`) |
| On allow-list | **no** |

## 20. Synthetic identity registry

Masked registry in gitignored `.qa-pi-pilot-identity-registry.json`. Passwords only in gitignored `.qa-*` files / never committed. GSM holds UID CSV only.

## 21. Secret Manager operations

- Created `procurement-intelligence-pilot-uids`
- IAM: `9058655644-compute@developer.gserviceaccount.com` → `secretAccessor`
- Versions: v1=pilots, v2=revoke placeholder `__PILOT_REVOKED__`, v3=restored pilots (latest)

## 22. Release gates (local + CI)

| Gate | Result |
|------|--------|
| typecheck / lint / vitest | PASS (35 unit/integration after flag tests) |
| secrets-scan / config QA | PASS |
| CI PR #10 | SUCCESS |
| CI PR #11 (incl. Firestore emulator IDOR) | SUCCESS |

## 23. Manual deploy posture

No percentage rollout. No auto-deploy. `workflow_dispatch` on exact tags only.

## 24. Health after final deploy

`GET /api/health/firestore` → **200** `{"status":"ok","connected":true}` (2026-08-03T13:16:44Z)

## 25. Unauthenticated acceptance

`GET /api/procurement/intelligence/{id}` without Bearer → **401**

## 26. Authenticated Pilot A acceptance

Admin on allow-list → **200**; eligibility + Opportunity Fit + checklist present; `definitiveEligible: false`

## 27. Authenticated Pilot B acceptance

SME on allow-list → **200** on bounded sample; machine-assisted; non-definitive eligibility classes; Opportunity Fit score present

## 28. Control C denial

Authenticated SME **not** on list → **403** `Pilot access required`

## 29. Forged / wrong-role denial

Youth-agent token → **401** (role not in SME/admin allow set for route)

## 30. Bounded tender sample

**8** tenders (within 5–10). Pilot B **8/8** HTTP 200 with structured intelligence. No unrestricted AI backfill.

Sample manifest (masked ids): `tb-155…` Eastern Cape; `tb-156…` Free State / Gauteng / Western Cape / Mpumalanga (×4 more) — titles recorded in `.qa-pi-acceptance-results.json` (gitignored).

## 31. Facts / eligibility / Opportunity Fit / docs gaps

| Check | Result |
|-------|--------|
| Structured facts / summary | Present |
| Eligibility classification | Enum (e.g. `likely_ineligible`) — non-definitive |
| Opportunity Fit | Numeric score + factors |
| Checklist | Length ≥ 1 (observed 5) |
| Missing tender | **404** |
| Missing profile fields | Surfaced in eligibility when applicable |

## 32. Checklist persistence

After rules fix: Pilot B **read own** + **write own** progress under `smeTenderIntelligence/{uid}/tenders/{tenderId}` via Firebase client SDK — **PASS**

## 33. UI visibility with public flag false

`SmeProcurementIntelligencePanel` probes API; shows on **200**; hides on 401/403/503 when `NEXT_PUBLIC_…=false`. No global public flag flip.

## 34. Tenant isolation live matrix

| Case | Result |
|------|--------|
| Pilot B API payload leaks Control UID | **No** |
| Control denied API while pilot allowed | **403** |
| Pilot B reads own progress | **PASS** |
| Pilot B reads Control progress | **DENIED** |
| Control reads Pilot progress | **DENIED** |
| Control reads own progress | **PASS** |

**HOLD threshold:** any cross-tenant exposure → HOLD. **None observed.**

## 35. Defect found and fixed (Phase 11)

Progress subcollection rules applied write-only `request.resource` guard to **reads**, failing closed for legitimate own reads. Fixed in PR #11; redeployed via [30814718880](https://github.com/tenderbriefing/tender/actions/runs/30814718880). Emulator IDOR tests added.

## 36. Revoke evidence (kill-switch)

| Step | Result |
|------|--------|
| GSM version with non-matching placeholder | Created (empty payload rejected by GSM) |
| `gcloud run services update --update-secrets=…:latest` | `tenderbriefing-00092-ndr` |
| Pilot B after revoke | **403** |
| Unauth | **401** |
| Flags | remained **false** |

## 37. Restore evidence

| Step | Result |
|------|--------|
| Restore 2-UID secret version | Created |
| Service update | `tenderbriefing-00093-twh` (later superseded by rules deploy → `00096-h4h`) |
| Pilot B | **200** |
| Control C | still **403** |

## 38. Observability / cost (bounded sample)

| Signal | Result |
|--------|--------|
| `intelligence_completed` logs | Present around acceptance window |
| Unrestricted backfill | **Not executed** |
| Global flags | false → non-pilots cannot invoke |
| Incremental AI cost | Phase 1 deterministic scoring; no required OpenAI call for sample |
| Pilot API latency (prior harness) | avg ~2.7s on sample (acceptable for cert; not SLO breach) |

## 39. Firestore rules & indexes status

Deployed successfully in final workflow Firebase job (`firestore.rules` + indexes). Progress read/write isolation covered by emulator tests in CI.

## 40. Hosting / proxy

Deploy jobs for Firebase Hosting + europe-west1 proxy **success** on final run.

## 41. Security posture summary

- Fail-closed empty list
- Server authz only (Bearer + Firestore userType)
- No client role trust
- UIDs never in git; masked in docs
- No invented real-person approval
- No ordinary customer pilots

## 42. Rollback baseline (preserve)

| Field | Value |
|-------|--------|
| Tag | `enterprise-v1.0.0` |
| SHA | `6e6597264faf4cfcd25c09060d93bc5e406c008b` |
| Revision | `tenderbriefing-00089-zv9` |
| Digest | `sha256:ad6eeb8c8afb86c9ae1aa61d1d3100cbb2c4e7cc190a862236828bceecf898b3` |

PI-only kill: placeholder GSM UID + service update (flags stay false). Full app: redeploy `enterprise-v1.0.0`.

## 43. Conditions / residuals

1. Full browser Playwright production UI / a11y matrix not re-executed (API + client SDK path certified).
2. Fact checks are structural — not issuer-document OCR adjudication.
3. GSM cannot store truly empty secret payloads — revoke uses non-matching placeholder.
4. Cloud Armor / monitoring attachment remains enterprise ops residual.
5. Synthetic Control C should be cleaned up after pilot window (`cleanupTag=pi-phase1-pilot-synthetic`).

## 44. Recommended next actions

1. Keep flags **false**; manage membership only via GSM secret.
2. After pilot window: empty/placeholder secret + update service, or remove synthetic Control C.
3. Optional: attach dashboards/alerts for `intelligence_completed` rate by UID hash.
4. Do **not** set global ENABLED=true without explicit product decision.

## 45. Document index

- This file
- `docs/reports/PROCUREMENT_INTELLIGENCE_PILOT_RESULTS.md`
- `docs/reports/PRODUCTION_BASELINE_PI_PILOT_A6D2B92.md`
- `docs/reports/PRODUCTION_BASELINE_PI_PILOT_3C177DD.md` (intermediate)
- `docs/releases/REGISTRY.md`
- `docs/runbooks/PROCUREMENT_INTELLIGENCE_FLAGS.md`
- `docs/runbooks/PROCUREMENT_INTELLIGENCE_PILOT.md`
- `docs/runbooks/ROLLBACK.md`
- `docs/architecture/PROCUREMENT_INTELLIGENCE_PHASE1.md`

## 46. Architecture summary

Listing fields → eligibility → Opportunity Fit → checklist → actions; API `GET /api/procurement/intelligence/[tenderId]`; panel API-probed.

## 47. Data model

Source truth: `tenderBriefings`. Progress: `smeTenderIntelligence/{smeId}/tenders/{tenderId}` (owner SME / admin).

## 48. Tests inventory (final tip)

| Suite | Notes |
|-------|-------|
| Unit PI flags | 7 tests incl. pilot-with-flags-false + parser edges |
| Firestore IDOR | Includes smeTenderIntelligence own/cross matrix |
| Release CI | PR #10 + #11 green before deploys |

## 49. Sign-off snapshot

| Item | Value |
|------|--------|
| Verdict | **PASS WITH CONDITIONS** |
| Code SHA | `a6d2b922e634efc64e8ebe1b5886f4b46006a087` |
| Tag | `pi-pilot-rules-a6d2b92` |
| Deploy | [30814718880](https://github.com/tenderbriefing/tender/actions/runs/30814718880) |
| Build | `04107842-040e-4bc0-980f-fdd1bc2d4d04` |
| Revision | `tenderbriefing-00096-h4h` @ 100% |
| Digest | `sha256:853b9d5e003f60c7a6f02295a520b031132254032c43ebd4b19642c24e1954d5` |
| Flags | false / false |
| Pilot count | 2 |
| Isolation | PASS (no cross-tenant exposure) |
| Revoke/restore | PASS |
| Certified UTC | 2026-08-03T13:16:44Z |
| Certified SAST | 2026-08-03T15:16:44+02:00 |
