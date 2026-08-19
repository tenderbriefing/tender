# TenderBriefing — Production Scale Closure

**Date:** 2026-08-19  
**Exercise:** Move from PASS WITH CONDITIONS toward READY FOR SCALE.  
**Executive verdict: PASS WITH CONDITIONS**

Authenticated operator smoke remains **BLOCKED**. READY FOR SCALE is not issued.

## 1. Executive Verdict

**PASS WITH CONDITIONS**

Public catalogue pagination, filters, anonymous denial of founder/admin intelligence, PayFast fail-closed architecture, and the PR #40 catalogue hotfix remain healthy on production SHA `7d7eecc`. This branch adds a bounded `getAttendanceRequestById` lookup, parallel catalogue meta loading, hot-path timings, and alerting documentation. It does **not** prove authenticated Command Center / Operational Intelligence / Founder Intelligence / Founder UI under production load, which is required for READY FOR SCALE.

## 2. Starting SHA

`7d7eecc3575c88099f9e6dc58c8c32442743cd72` (`origin/master`, includes PR #39 + PR #40)

## 3. Final SHA

`195592416e938f33674f7eefcb07e5f70760a20c` (`fix/production-scale-closure`). Not merged to production at report time.

## 4. Branch

`fix/production-scale-closure`

## 5. PR

[#41](https://github.com/tenderbriefing/tender/pull/41)

## 6. Merge SHA

Not merged. Production remains `7d7eecc`.

## 7. CI status

Local (this workstation):

| Gate | Result |
|------|--------|
| typecheck | PASS |
| lint | PASS (pre-existing `ConnectorMatching.tsx` exhaustive-deps warning) |
| unit + integration (`npm test`) | **221 passed / 34 files** |
| firestore-rules / google-auth / route-retirement / config / secrets-scan | PASS |
| npm-audit-gate | PASS (2 allowlisted `websocket-driver` criticals) |
| production build | PASS |
| Firestore emulator | **BLOCKED locally** — no Java runtime (`java -version` fails). CI job `firestore_rules_emulator` is the authority. |
| Playwright | **BLOCKED locally** — Chromium download/install incomplete. CI job `e2e_public` is the authority. |

GitHub Actions on the PR is the production CI record.

## 8. Production revision

**NOT RETRIEVED.** `gcloud run services describe tenderbriefing --region=africa-south1` returned `PERMISSION_DENIED` for `run.services.get` as `smartprocure.ai@gmail.com`.

Minimal role: `roles/run.viewer` (includes `run.services.get`, `run.revisions.list`).

## 9. Production image

Last known deployed tag (PR #40 deploy, not re-verified via Cloud Run API):

`africa-south1-docker.pkg.dev/tenderbriefing-34679/tenderbriefing/tenderbriefing:da1fbf86-2e08-4c44-8e2e-ca0384f1faa0`

## 10. Image digest

**NOT RETRIEVED** (`run.revisions.list` / Artifact Registry denied).

## 11. Traffic allocation

**NOT RETRIEVED.** Last certified intent: 100% on the PR #40 revision.

## 12. Cloud Run configuration

As last certified (not re-read; describe denied). Do not raise memory.

| Field | Value |
|-------|--------|
| Region | africa-south1 |
| Memory | 1 GiB |
| CPU | 1 |
| Timeout | 300s |
| Min instances | 0 |
| Max instances | 3 |

## 13. Firestore indexes

Repo `firestore.indexes.json` still declares:

- `tenderBriefings`: `briefingCompulsory` ASC + `lastSyncedAt` DESC
- `tenderBriefings`: `briefingCompulsory` ASC + `province` ASC + `lastSyncedAt` DESC

Previously reported READY in production (`CICAgNjpgYIK`, `CICAgNiroIEK`). `getAttendanceRequestById` is a single-document get — **no new index**.

## 14. Command Center authenticated results

**BLOCKED — authenticated production smoke cannot execute because approved smoke credentials are unavailable.**

`SMOKE_TEST_PASSWORD` is unset in the process environment, absent from GitHub Actions secrets (`gh secret list` has Firebase web config + `FIREBASE_SERVICE_ACCOUNT` only), and absent from `.env.local`. Hardcoded fallbacks in legacy QA scripts were **not used**.

Anonymous: `GET /api/admin/command-center` → **401** (2026-08-19, ~1.25s). No 5xx.

## 15. Operational Intelligence authenticated results

**BLOCKED** (same credential gap).

Anonymous: `GET /api/operational/intelligence` → **401** (~681ms). No 5xx.

## 16. Founder Intelligence authenticated results

**BLOCKED** (same credential gap). Founder allowlist was not exercised.

Anonymous: `GET /api/founder/user-intelligence` → **401** (~1.13s). No 5xx.

## 17. Founder UI results

**BLOCKED.** `/founder` HTML shell was requested without a production smoke session. Do not treat shell 200 as authenticated certification.

## 18. Catalogue functional results

Live production (`https://www.tenderbriefing.co.za`, SHA `7d7eecc`, **before** this branch is deployed):

| Check | Result |
|-------|--------|
| Health `/api/health/firestore` | 200, 1.41s |
| Page 1 `limit=40` | 200, 38 unique ids (visibility-filtered), `total=449`, `hasMore=true`, `pageSize=40` |
| Page 2 | 200, 36 items, **0 id overlap** with page 1 |
| Gauteng filter | 200, 35 items, provinces=`Gauteng` only |
| `/api/bookings` | not a live booking API (retired/blocked) |

## 19. Catalogue performance before/after

**Before (production, this measurement):**

| Request | Latency |
|---------|---------|
| stats/summary | 2.01s |
| catalogue page 1 | 4.76–5.49s |
| catalogue page 2 | 6.22s |
| Gauteng | 4.36s |

Prior certification: page 1 ~5.29s, page 2 ~6.45s, Gauteng ~5.38s, stats cold ~3.65s / warm ~0.52–0.59s.

**After:** not in production yet. Code change on this branch:

- page query + catalogue meta (totals/sync) run in parallel
- 20s in-process meta cache so later pages skip duplicate count/sync
- `hotPathLog` now includes `authMs`, `pageMs`, `filterMs`, meta `hit`/`miss`

Warm target &lt;1s and cold &lt;2s are **not claimed**. `min-instances=0` plus Hosting rewrite + Firestore remain the likely floor; raising min instances or memory was not done.

## 20. getRequestById result

**FIXED on this branch (not yet production).**

`agentAssignmentService.getRequestById` and `attendancePaymentService.getRequestById` now call `storage.getAttendanceRequestById`. Firestore implementation is `collection().doc(id).get()`. JSON adapter reads by id. Missing method fails closed (`null`), not a collection scan. Regression tests in `tests/unit/getAttendanceRequestById.test.ts` and `tests/unit/hotPathSafeguard.test.ts`.

## 21. Cloud Run memory/OOM/restart evidence

**NOT OBSERVED / IAM BLOCKED.** Need `roles/run.viewer` + `roles/logging.viewer` to inspect restarts, OOM (`Memory limit of 1024 MiB exceeded`), 503/504.

No memory increase performed.

## 22. Production 5xx evidence

This session’s public probes: no 5xx on health, stats, catalogue, or anonymous intelligence denials. Log-based 5xx rate **not retrieved**.

## 23. Alerting status

**INFRASTRUCTURE DOCUMENTED; POLICIES NOT PROVISIONED.**

`docs/operations/MONITORING.md` lists 5xx, 503/504, OOM/restart, catalogue latency, PayFast ITN reject, automation failure, sync failure, transactional email skip, intelligence 5xx. `scripts/apply-production-alerts.sh` fails closed without `monitoring.alertPolicies.create`.

This identity cannot list policies (`gcloud monitoring policies list` not granted).

Operator action: create a notification channel (email to ops), grant `roles/monitoring.alertPolicyEditor`, set `MONITORING_NOTIFICATION_CHANNEL`, apply policies.

## 24. Resend credential status

**OPERATIONAL; LEAST-PRIVILEGE ROTATION NOT PERFORMED.**

Production mapping remains `RESEND_API_KEY=TENDERBRIEFING_API:latest` (full-access). GSM list denied. Rotation requires Resend dashboard sending-only key + Secret Manager version + Cloud Run remount + controlled send + then revoke. Documented in `docs/operations/ENVIRONMENT_VARIABLES.md`. Email was not broken to satisfy this item.

## 25. WhatsApp status

**FAIL-CLOSED.** Twilio secrets still not mounted. Not enabled for certification.

## 26. SME / PayFast regression result

Unit/integration payment tests **PASS** (ITN, R249 amount, reconciliation, checkout email guard, lifecycle).

Live commercial path: **REQUIRES AUTHORISED LIVE TRANSACTION**. No R249 charge was placed. PayFast ITN remains payment truth. Fee unchanged (R249 / 24,900 cents).

`/sme/book-agent` public shell probed; guests are expected to hit sign-in for the booking funnel (Playwright covers this in CI).

## 27. Youth Agent regression result

Workspace/domain unit tests **PASS**. Authenticated `/jobs` production session **BLOCKED** (no smoke password). Page shell only, not an authorised jobs API test.

## 28. Transactional email regression

Unit tests for Resend idempotency and missing-key skip **PASS**. Live production send **NOT EXECUTED** (would require working key plus a controlled recipient; rotation not in progress).

## 29. Test totals

Local `npm test`: **221 passed**, 0 failed, 34 files.

CI / emulator / Playwright: see §7.

## 30. Remaining technical debt

1. Store `SMOKE_TEST_PASSWORD` in GitHub Actions secrets (and optionally GSM) so authenticated production smoke can run.
2. Grant read-only Cloud Run / Logging / Monitoring to the cert operator (not Owner).
3. Provision the documented alert policies and a notification channel.
4. Rotate Resend to a sending-only key after a controlled email smoke.
5. Catalogue warm latency still ~5–6.5s in production; instrument after deploy before further optimisation.
6. Visibility filtering can yield fewer than 40 rows per page (expected; not a scan).
7. Local Java + Playwright Chromium missing on this workstation.

## 31. Rollback SHA / image

| Item | Value |
|------|--------|
| Rollback git SHA | `7d7eecc3575c88099f9e6dc58c8c32442743cd72` |
| Rollback image tag | `africa-south1-docker.pkg.dev/tenderbriefing-34679/tenderbriefing/tenderbriefing:da1fbf86-2e08-4c44-8e2e-ca0384f1faa0` |
| Method | Actions → Deploy TenderBriefing `workflow_dispatch` on that SHA |
| Do not | raise memory to “fix” latency |

## 32. Final recommendation

Keep production on `7d7eecc` until this PR’s GitHub CI is green, then merge and deploy **only** if that CI is green. After deploy, re-measure public catalogue (watch for PR #39 module-resolution 500s) and **stop** at PASS WITH CONDITIONS until `SMOKE_TEST_PASSWORD` is available from an approved secret source and authenticated Command Center / Operational Intelligence / Founder Intelligence (10+ polls each) plus Founder UI are proven.

Do not label READY FOR SCALE.
