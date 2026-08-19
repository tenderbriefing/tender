# TenderBriefing — Founder Dashboard V2 Final Production Certification

**Date:** 2026-08-19T01:27:05Z  
**Exercise:** Final acceptance, controlled merge, production deploy, certification  
**PR:** https://github.com/tenderbriefing/tender/pull/42  
**Branch:** `feat/founder-dashboard-v2`  
**Verdict:** NOT READY

---

## 1. Executive Verdict

**NOT READY**

PR #42 is mergeable, CI is green, and local quality gates passed. Anonymous `GET /api/founder/dashboard` is denied with **401** on production. Founder allow-list and `verifyFounderUser` were not weakened.

Merge and production deploy were **not** executed. `SMOKE_TEST_PASSWORD` / an approved founder session is unavailable from environment, GitHub secrets, and Google Secret Manager (list denied). Authenticated Overview walkthrough, live PayFast/ITN reconciliation, non-founder 403, founder 200, and the 16 post-deploy production checks therefore did not run. Those are merge-gate requirements, not optional polish.

Production remains master SHA `7d7eecc3575c88099f9e6dc58c8c32442743cd72`. V2 is not live.

---

## 2. Starting SHA

`7d7eecc3575c88099f9e6dc58c8c32442743cd72` (`origin/master`, production baseline including PR #39 and #40)

---

## 3. PR #42 HEAD

`e50d9ddf85a788fb5387c0d4045cf63857c6ed8b`

Implementation commit: `072a00c242c1d72a344c14a19ad597a561b6ff57`  
Follow-up docs: `4bc17892ea96a0c16068091ee5c9115443448df7`, `e50d9ddf85a788fb5387c0d4045cf63857c6ed8b`

---

## 4. Merge SHA

**Not merged.**

PR state: OPEN, `mergeable: MERGEABLE`, `mergeStateStatus: CLEAN`. Repo merge convention is merge-commit (`Merge pull request #N`). Merge was withheld because founder authentication, live KPI/ITN reconciliation, and directory walkthroughs are blocked.

---

## 5. Final Production SHA

Unchanged: `7d7eecc3575c88099f9e6dc58c8c32442743cd72`

---

## 6. Production Revision / Image

**Not deployed.** Cloud Run `run.services.get` on `tenderbriefing` / `africa-south1` / `tenderbriefing-34679` is IAM-denied for this identity (`smartprocure.ai@gmail.com`). No new revision or image digest.

Rollback flags remain the intended path after a future deploy: `FOUNDER_DASHBOARD_V2=false` and `NEXT_PUBLIC_FOUNDER_DASHBOARD_V2=false`. `cloudbuild.yaml` still deploys `--memory=1Gi` (unchanged by this PR). V2 chrome defaults on when those env vars are unset.

---

## 7. PR Status

https://github.com/tenderbriefing/tender/pull/42 — **OPEN**, not draft.

- Base: `master` at `7d7eecc`
- Head: `feat/founder-dashboard-v2` at `e50d9dd`
- Commits vs master: 3 (implementation + two certification-doc commits). No PR #41 (`fix/production-scale-closure` / `ab32714`) in this range.
- Protected files unchanged vs master: `firestore.rules`, `firestore.indexes.json`, `storage.rules`, `cloudbuild.yaml`, `cloudbuild-hosting-proxy.yaml`, `.github/workflows/deploy.yml`
- CI run: https://github.com/tenderbriefing/tender/actions/runs/32203973203 — **success** on HEAD `e50d9dd`

| Check | Result | Job |
|---|---|---|
| Typecheck, lint, unit, integration, QA | pass (2m9s) | 95923438132 |
| Firestore emulator IDOR matrix | pass (2m39s) | 95923438278 |
| Production build | pass (4m34s) | 95923821089 |
| Playwright public/a11y gates | pass (5m35s) | 95924646709 |

---

## 8. Quality Gates

Re-run locally on HEAD `e50d9dd` at 2026-08-19T01:25–01:27Z:

| Gate | Result |
|---|---|
| `npm run typecheck` | PASS |
| `npm run lint` | PASS (pre-existing warning only: `ConnectorMatching.tsx` missing `findConnectors` dep) |
| `npm test` | PASS — **242 passed / 0 failed** (34 files), including 22 founder dashboard tests |
| `npm run build` | PASS — routes include `/founder`, `/founder/smes`, `/founder/agents`, `/founder/briefings`, `/founder/settings`, `/api/founder/dashboard` |
| `qa:secrets-scan` | PASS |
| `qa:config` | PASS |
| `qa:route-retirement` | PASS |
| `qa:npm-audit` | PASS — 2 critical, both allowlisted `websocket-driver`; no unapproved criticals |
| Playwright (CI) | PASS — Actions run 32203973203 |
| Playwright (local) | NOT RUN — chromium-1148 cache present; full e2e not re-run locally to avoid a Chromium download wait; CI result used |
| Firestore emulator (CI) | PASS — IDOR matrix job |
| Firestore emulator (local) | BLOCKED — no Java Runtime (`java -version` / `java_home` fail; `/usr/bin/java` is the macOS stub) |

---

## 9. Founder Authentication

| Case | Result | Evidence |
|---|---|---|
| Anonymous `GET /api/founder/dashboard` | **401** | Live production: `{"success":false,"error":"Unauthorized — sign in required"}` |
| Anonymous with query `view=overview&period=30` | **401** | Same body |
| Bogus Bearer | **401** | Live production: `Unauthorized — invalid or expired session` |
| HTML `GET /founder` | **200** HTML | Not treated as data access. Middleware still requires `FOUNDER_USER_INTELLIGENCE_ENABLED` for the shell; API still requires Bearer + `verifyFounderUser`. |
| Authenticated non-founder | **BLOCKED** live | No approved session. Unit: `evaluateFounderAccess` denies `userType: sme` and off-allow-list admin (`forbidden_not_founder`). Handler uses `verifyFounderUser` → 403 via `forbiddenResponse`. |
| Authorized founder | **BLOCKED** live | `SMOKE_TEST_PASSWORD` unset in env and `.env.local`. GitHub secrets have no smoke/founder password (Firebase hosting keys + `FIREBASE_SERVICE_ACCOUNT` only). GSM `secrets.list` IAM-denied. Hardcoded passwords in legacy QA scripts were not used. |

`/api/founder/dashboard` is not a public API (`isPublicApiRoute` false). Client V2 flag cannot unlock data: `verifyFounderUser` still requires `FOUNDER_USER_INTELLIGENCE_ENABLED`, admin `verifyApiUser`, and allow-list / `founderAccess`.

---

## 10. Overview Verification

**BLOCKED** — no founder session to open `/founder` as V2 against live data.

Code/unit evidence only (not a production walkthrough):

| KPI | Source / rule | Unit |
|---|---|---|
| SMEs | Lifetime `count()` `users.userType==sme` | Totals passed through from aggregation |
| Youth Agents | Lifetime `count()` `users.userType==youth-agent` | Same |
| Paid Bookings | All Time: `count()` `paymentStatus==paid`. Period: `paidAt` on ≤500 cohort | Paid counted from `paymentStatus`, not creation; pending excluded |
| Revenue | Sum `paymentAmount` else `quotedFee`; missing amounts omitted (not bookings×R249) | 2×24900 = 49800; pending excluded; null amount → revenue 0 |
| Upcoming | Paid, not cancelled, `briefingDate` > now, cohort | Future paid counted; cancelled/unpaid/missing date excluded |
| Completed | All Time: `count()` `status==completed`. Period: cohort | `closed` is not completed |

UI: period picker 7 / 30 / 90 / all; loading / error / empty copy present. Nav: Overview, SMEs, Youth Agents (`/founder/agents`), Briefings, Settings.

---

## 11. Financial Reconciliation

**BLOCKED.** No live dashboard output and no founder-authenticated query of production paid rows. Known PayFast/ITN production records were not compared to V2 KPIs.

Unit (fixture) behaviour that must still be proven on live data before merge:

- Paid Bookings uses `attendanceRequests.paymentStatus === 'paid'` only
- Revenue uses stored `paymentAmount`, else `quotedFee`; does not invent R249 × bookings
- Pending is excluded from paid/revenue
- Failed payment is a Needs Attention item, not paid revenue
- Missing amounts are omitted from the sum (`paidWithoutAmount`)

Do not merge or deploy until several production records (successful paid, pending, failed if present, completed paid, paid upcoming) are compared to dashboard inclusion/exclusion.

---

## 12. Activity Chart

**BLOCKED** live. Implementation: one **Business Activity** chart — SME registrations, Youth Agent registrations, paid bookings (`paidAt`), UTC day buckets, period cap 90, from ≤400 SME + ≤400 YA profiles + ≤500 requests. Unit test asserts series length and paid/SME bucket on 2026-08-18. Empty copy: **No activity in this period.**

---

## 13. Needs Attention

**BLOCKED** live. Unit: emits `paid_awaiting_assignment`, `report_overdue`, `proof_outstanding`, `payment_reconciliation`; each `href` starts with `/founder/briefings/`. Empty copy: **Nothing requires your attention.**

---

## 14. SME Directory

**BLOCKED** live. Implementation: `/founder/smes` — Company, Contact, Province, Joined, Bookings, Total Spent, Last Active; search + pagination over ≤800 profiles; paid bookings/spent from request cohort; detail is document get + recent requests.

---

## 15. Youth Agent Directory

**BLOCKED** live. Route is `/founder/agents` (nav label Youth Agents), not `/founder/youth-agents`. Columns: Agent, Province, Joined, Briefings, Completed, Reports, Earnings. Earnings = `paymentAmount`/`quotedFee` × `(1 - PLATFORM_COMMISSION_RATE)` (default 0.35) on **paid + completed** cohort rows. This is dashboard intelligence, not a payout ledger. No new payout system.

---

## 16. Briefings

**BLOCKED** live. `/founder/briefings`: SME, Tender, Briefing Date, Amount, Youth Agent, Status. Presentational lifecycle Paid → Agent Assigned → Attended → Report Delivered; backend `status` and `paymentStatus` remain on detail (single-doc get + `briefingReports where requestId limit 5`). Unit covers Paid / Agent Assigned / Attended / Report Delivered / unpaid.

---

## 17. Settings / Secondary Tools

**BLOCKED** live click-through. Code: `/founder/settings` links to User Intelligence (`/founder/user-intelligence`) and Operations console (`/admin/dashboard`). Primary nav does not include admin/infrastructure. User Intelligence remains a secondary surface.

---

## 18. Security

- Anonymous founder dashboard API: **401** (live production, middleware before handler)
- Invalid token: **401** (live)
- Non-founder / founder 200: **not executed** live
- `verifyFounderUser` unchanged in intent (enabled flag + admin + allow-list / `founderAccess`)
- Allow-list logic unchanged; this PR does not edit Firestore rules
- No new public API: `/api/founder/dashboard` is private
- HTML 200 on `/founder` is **not** founder data authorization
- V2 feature flag does not bypass `verifyFounderUser`
- PayFast, R249, ITN, WhatsApp, catalogue, Cloud Run memory: **not changed**

---

## 19. Firestore / Query Scale

Founder V2 path: `count()` for lifetime SME / YA / paid / completed; lists `limit` 500 requests, 800 profiles, 400/role for the chart; detail is document get. Cache TTL 20s with in-flight coalescing. `getAttendanceRequests({ limit: REQUEST_COHORT_LIMIT })` is capped (hard cap 2000 in storage). No `getAllTenders` on this path. `cloudbuild.yaml` memory remains **1Gi**.

Limitation: period Paid/Revenue/Upcoming and directories cannot see beyond the cohort. All Time Paid/Completed use aggregations; All Time Revenue is a bounded-cohort sum when paid volume exceeds 500, labelled in `dataNotes`.

---

## 20. Performance

No live founder API timing. Build emits modest page weights (~233–243 kB first load JS for founder V2 pages). Overview is one authenticated API call. Directory search is in-process over the bounded cohort. Residual risk is the 500-request cohort, documented rather than presented as complete history.

Production logs for V2: **not applicable** (not deployed). `run.services.get` and log read IAM-denied from this identity.

---

## 21. Responsive Browser Check

**BLOCKED** — no founder browser session. No material responsive defects were observed in code review; none were fixed (no redesign). CI Playwright public/a11y passed; that suite is not a signed-in founder viewport pass.

---

## 22. Production Smoke

**NOT RUN.** All 16 mandatory checks require a founder session and/or a deployed V2:

1. Founder login — BLOCKED  
2. `/founder` V2 shell — BLOCKED (production still legacy SHA)  
3. Six KPIs load — BLOCKED  
4. Revenue/Paid vs known paid record — BLOCKED  
5. Business Activity renders — BLOCKED  
6. Needs Attention loads — BLOCKED  
7. SME directory — BLOCKED  
8. One SME detail — BLOCKED  
9. Youth Agent directory — BLOCKED  
10. One Youth Agent detail — BLOCKED  
11. Briefings — BLOCKED  
12. One briefing detail — BLOCKED  
13. Settings — BLOCKED  
14. User Intelligence link — BLOCKED  
15. Admin/Operational link — BLOCKED  
16. Unauthorized API denied — **PASS** (anonymous 401 on production)

Public `GET /api/health/firestore` → 200 `{status:ok, connected:true}` (baseline only; not founder V2).

---

## 23. Production Logs

**Not inspected.** IAM denied for Cloud Run describe/logs. V2 is not on production, so there are no V2 `founder_dashboard_v2` hot-path logs to review.

---

## 24. Legacy Founder Home

**Retained.** `components/founder/legacy/FounderHomePage.tsx` remains behind `FOUNDER_DASHBOARD_V2=false`. Do not delete until V2 production verification succeeds. Follow-up: after a certified production pass, retire legacy Home in a small dedicated PR so two founder implementations are not permanent.

---

## 25. Known Limitations

- Authenticated founder walkthrough and live ITN reconciliation not executed (credential block)
- All Time revenue remains a ≤500 paid-request cohort sum when volume exceeds that bound
- SME/YA directory search is in-process over ≤800 profiles, not a collection search index
- Agent earnings are commission-model cohort figures, not a payout ledger
- Upcoming KPI ignores rows with missing `briefingDate`
- Playwright and Firestore emulator were not re-run locally (CI passed both)
- GSM/Cloud Run IAM denied for secret list and revision inspection

---

## 26. Rollback Readiness

Ready, unused (nothing deployed):

1. Do not merge; or revert the PR if merged.
2. After a future merge/deploy: set `FOUNDER_DASHBOARD_V2=false` and `NEXT_PUBLIC_FOUNDER_DASHBOARD_V2=false`, then `workflow_dispatch` **Deploy TenderBriefing**. `/founder` returns to Home + User Intelligence without deleting V2 routes.
3. Founder data APIs continue to fail closed if `FOUNDER_USER_INTELLIGENCE_ENABLED` is off.

No rollback was triggered.

---

## 27. Final Recommendation

**Do not merge. Do not deploy.**

Unblock only with an approved founder session from env, GitHub secrets, or GSM (not from hardcoded QA-script passwords). Then complete Overview (all periods), live paid/ITN reconciliation, directories, briefings, Settings, non-founder 403, founder 200, merge #42 via merge-commit, `workflow_dispatch` deploy on master, and the 16 production checks.

Until that evidence exists, Founder Dashboard V2 is not production-certified.

**FOUNDER DASHBOARD V2 — NOT READY**
