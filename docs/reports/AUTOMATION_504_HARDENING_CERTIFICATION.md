# Automation 504 hardening — 41-section release certification

**Prepared:** 2026-08-05  
**Updated:** 2026-08-08 (audit remediation — deploy status corrected)  
**Branch (original):** `fix/automation-run-time-budget`  
**Original tip SHA:** `b3fd56cd2c12df5ffc455a0231282d596e0aa9ac`  
**PR:** [#15](https://github.com/tenderbriefing/tender/pull/15)  
**CI (original):** [31039774034](https://github.com/tenderbriefing/tender/actions/runs/31039774034) success  
**Deployment:** **DEPLOYED** — automation budget env (`AUTOMATION_BUDGET_MS=240000`, safety margin, 300s timeout) is live on Cloud Run lineage since `notify-ux-7eab86a` / later (confirmed on `tenderbriefing-00106-gh8`).

## 1. Executive verdict

Hardening is **in production**. Residual: non-cooperative legacy job bodies may still drain CPU after slice timeout; AbortSignal cooperative cancel is wired for batched jobs (audit remediation). Lease `keepUntilExpiry` still applies after timed-out slices.

## 2. Incident

`POST /api/automation/run` reached the Cloud Run 300s request ceiling.

## 3. Baseline window

2026-08-03T18:30:00Z–2026-08-05T18:30:00Z.

## 4. Baseline evidence

Cloud Run request logs: **109×504**, **38×200**, **3×401**.

## 5. Trigger

Cloud Scheduler `tenderbriefing-workflow-automation-hourly`, hourly at minute 0,
timezone Africa/Johannesburg, `{"job":"all"}`.

## 6. Retry amplification

Scheduler attempt deadline 300s and retry count 2 produced overlapping work.

## 7. Root cause

Fourteen sequential jobs had no internal deadline, distributed lease, persisted
continuation, or bounded per-job batching.

## 8. Secondary cause

Daily briefs/watchlists repeated full tender and attendance scans per principal;
calendar used all-pairs comparisons; closing reminders re-read a collection
group per closing tender.

## 9. Cloud Run configuration

1Gi memory, 1 CPU, 300s timeout, 0–3 instances; timeout is already the deployed
ceiling and was not raised.

## 10. Chosen strategy

Bound work below the request ceiling, persist progress, suppress overlap, and
resume later. No new infrastructure.

## 11. Execution budget

Reusable `executionBudget.js`: 240s default, 20s explicit margin, validated env
overrides, injected clock.

## 12. Registry

`jobRegistry.js` is the only job-name/order source, with priority, minimum safe
start, retry, side-effect and batch metadata.

## 13. Validation

Unknown job names and invalid continuation types return `400`.

## 14. Lease

Atomic Firestore transaction on `automationLeases/scheduler`; memory/JSON
compatibility included.

## 15. Overlap

Unexpired lease returns HTTP 200 `skipped_overlap`; no duplicate sweep starts.

## 16. Expiry and takeover

Lease expiry equals request timeout; a later owner atomically takes over.

## 17. Release

Only the owning run can release a lease and persist continuations.

## 18. Run records

`automationRuns/{runId}` stores bounded operational summaries; JSON/memory cap
is 100 records.

## 19. Partial contract

HTTP 200 `partial` carries completed, deferred, timed-out jobs, bounded errors,
budget metadata, timings and continuation.

## 20. Cursor format

Opaque base64url JSON, version `v:1`; unknown/malformed versions restart safely.

## 21. Daily brief batching

Five SMEs and five agents per continuation batch.

## 22. Watchlist batching

Five SMEs per continuation batch.

## 23. Ingestion batching

Two enabled procurement sources per continuation; graph refresh only after final
source batch.

## 24. Calendar bounding

Two hundred requests per batch, tender cap, sorted 24-hour sliding comparison.

## 25. Closing reminder scan

Tracked tenders are indexed from one collection-group read.

## 26. Daily call counts

For 5 SMEs / 5 agents: before tenders `10`, requests `15`; after `1` / `1`.

## 27. Watchlist call counts

For 5 SMEs: before tenders `5`, requests `5`; after `1` / `1`.

## 28. Closing call counts

For `C` closing tenders: before `C` collection-group reads; after `1` if `C>0`,
else `0`.

## 29. Idempotency

Workflow events retain deterministic event/entity IDs. Daily reminders retain
deterministic SME/date identity through the existing notification layer.

## 30. API compatibility

Missing body/job still means `all`; existing secret headers remain accepted.

## 31. API metadata

Body and headers expose request ID, run ID, status and continuation; responses
are `no-store`.

## 32. Auth and secrets

Secret authorization is unchanged. Logs and persisted summaries exclude secret
headers, request bodies and recipient identifiers.

## 33. Telemetry

Structured JSON events report status, duration and aggregate counts only.

## 34. Founder visibility

Founder-authenticated server route reads runs/lease. Firestore clients cannot
read or write either collection.

## 35. Scheduler tooling

Idempotent dry-run-first configure script; secret is read from Secret Manager
only in explicit `--apply` mode and never printed. Not executed by this change.

## 36. Documentation

`docs/WORKFLOW_AUTOMATION.md` includes contracts, operations, diagrams, scan
counts, env configuration and scheduler procedure.

## 37. Unit and integration tests

Budget/config/clock, registry/cursor, lease/takeover/release, run retention,
orchestration partial/timeout/resume/error, route validation and scan accounting.

## 38. Firestore security tests

Emulator matrix denies unauthenticated, SME, agent and admin client access to
both automation control-plane collections.

## 39. Quality gates

Exact tip: `b3fd56cd2c12df5ffc455a0231282d596e0aa9ac`

CI run: [31039774034](https://github.com/tenderbriefing/tender/actions/runs/31039774034) — **success**

| Gate | Result |
|------|--------|
| Typecheck / lint / unit / integration / QA | success |
| Firestore emulator IDOR matrix | success |
| Production build | success |
| Playwright public/a11y gates | success |
| Local `npm test` | **99 passed / 15 files** |
| Local typecheck / lint / build / QA / workflow:qa | pass |

## 40. Deployment governance

`.github/workflows/deploy.yml` says “Production deploy is manual only — never
auto-deploy on push” and exposes only `workflow_dispatch`. Therefore this agent
does not deploy.

## 41. Release and residuals

**NOT DEPLOYED; production verification NOT PERFORMED.** A release manager must
merge, select the exact merged SHA/tag in `Deploy TenderBriefing`, verify the
revision/digest, then compare post-deploy 504s against the 109/48h baseline.
Underlying timed-out work cannot be cancelled in JavaScript after
`Promise.race`; deterministic keys plus lease retention until expiry prevent
duplicate external effects from Scheduler retries, but external clients should
gain abort signals in a later improvement.

Unrelated local dirty files (`.gitignore`, health/sync route CRLF noise,
procurement certification CRLF) were intentionally left unstaged.
