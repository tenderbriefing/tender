# TenderBriefing — Founder Dashboard V2 Certification

**Date:** 2026-08-19  
**Branch:** `feat/founder-dashboard-v2`  
**Starting SHA:** `7d7eecc3575c88099f9e6dc58c8c32442743cd72` (origin/master / production baseline)  
**Verdict:** PASS WITH CONDITIONS

This is a UI/product redesign of the Founder experience. It is not a backend rewrite, not merged, and not deployed.

---

## 1. Executive Verdict

**PASS WITH CONDITIONS**

The founder workspace now answers the six business questions on Overview (SMEs, Youth Agents, Paid Bookings, Revenue, Upcoming, Completed) plus a single Business Activity chart and clickable Needs Attention. Directories and briefing lifecycle are presentational only. Payment truth remains `attendanceRequests.paymentStatus === 'paid'`. Founder allow-list and server-side `verifyFounderUser` are unchanged. Conditions: not production-verified with a live founder session; All Time revenue is a bounded-cohort sum when paid volume exceeds 500; Playwright and Firestore emulator were not run locally.

## 2. Starting SHA

`7d7eecc3575c88099f9e6dc58c8c32442743cd72`

## 3. Final SHA

Recorded at PR open (this report is committed on the branch).

## 4. Branch

`feat/founder-dashboard-v2` from `origin/master`. Not mixed with PR #41 (`fix/production-scale-closure`).

## 5. PR

Recorded at PR open.

## 6. Files changed

New: `backend/services/founderDashboardService.js`, `app/api/founder/dashboard/route.ts`, founder V2 pages (`/founder/smes`, `/agents`, `/briefings`, `/settings` + detail routes), `components/founder/v2/*`, `components/founder/legacy/FounderHomePage.tsx`, `lib/founder/dashboard.ts`, `tests/unit/founderDashboard.test.ts`.

Updated: founder shell, access flags, header/console IA, env docs, hot-path and API policy tests.

Not changed: PayFast, R249, ITN, WhatsApp, catalogue, Cloud Run memory, auth allow-list logic, Firestore rules.

## 7. Founder navigation implemented

Primary: **Overview**, **SMEs**, **Youth Agents**, **Briefings**. **Settings** at the bottom of the navy sidebar (and in the mobile strip).

Not in primary nav (preserved elsewhere):

- User Intelligence → `/founder/user-intelligence` (Settings)
- Operations console, dispatch, RFQ, finance, integrations, diagnostics → `/admin/*` (Settings + Console header link)

Rollback chrome: `FOUNDER_DASHBOARD_V2=false` and `NEXT_PUBLIC_FOUNDER_DASHBOARD_V2=false` restores Home + User Intelligence.

## 8. Overview metrics and authoritative sources

| Metric | Source | Query | Definition | Period | Bounded | Cache |
|---|---|---|---|---|---|---|
| SMEs | `users` | `count()` where `userType==sme` | Lifetime registered SME accounts | Always all-time | Yes (aggregation) | 20s |
| Youth Agents | `users` | `count()` where `userType==youth-agent` | Lifetime registered Youth Agents | Always all-time | Yes | 20s |
| Paid Bookings | `attendanceRequests` | All Time: `count()` where `paymentStatus==paid`. Period: `paidAt` on ≤500 recent requests | Authoritative paid state only — not booking creation | 7/30/90/all | Yes | 20s |
| Revenue | Same paid records | Sum `paymentAmount` else `quotedFee` | Stored amounts on paid rows. Missing amounts omitted (not bookings×R249) | Same as Paid | Cohort ≤500; All Time flagged if count() > cohort | 20s |
| Upcoming Briefings | Request cohort | `paymentStatus==paid`, not cancelled, `briefingDate` > now | Current future paid briefings | Snapshot (not period-sliced) | ≤500 | 20s |
| Completed Briefings | `attendanceRequests` | All Time: `count()` where `status==completed`. Period: cohort `status==completed` | Matches executive analytics workflow status | 7/30/90/all | Yes | 20s |

## 9. Activity chart implementation

One chart: **Business Activity**. Daily buckets of SME registrations, Youth Agent registrations, and paid bookings (`paidAt`) over the selected period (UTC days, cap 90). Built from ≤400 SME profiles, ≤400 Youth Agent profiles, and ≤500 requests. Subtle grouped bars; secondary to KPIs.

## 10. Needs Attention implementation

Real exceptions only, from the request/report cohort:

- Paid briefing awaiting assignment (`paymentStatus==paid`, `status==pending`, no agent)
- Briefing report overdue (`reportSlaStatus==overdue`)
- Attendance proof outstanding (completed/closed without proof URL or `attendanceConfirmed`)
- Payment requiring reconciliation (`paymentStatus==failed`)

Each item links to `/founder/briefings/{id}`. Empty copy: **Nothing requires your attention.**

## 11. SME directory implementation

Table: Company | Contact | Province | Joined | Bookings | Total Spent | Last Active. Search + pagination over a bounded profile cohort (≤800). Bookings/spent from paid records in the request cohort. Detail: existing profile fields + recent requests. No invented fields.

## 12. Youth Agent directory implementation

Table: Agent | Province | Joined | Briefings | Completed | Reports | Earnings. Earnings use the existing platform commission model (`PLATFORM_COMMISSION_RATE`, default 0.35) on **paid + completed** cohort rows with a stored amount; omitted when amount is missing. No speculative scoring.

## 13. Briefings implementation

Table: SME | Tender | Briefing Date | Amount | Youth Agent | Status. Presentational lifecycle **Paid → Agent Assigned → Attended → Report Delivered**. Backend `status` and `paymentStatus` remain on the detail page. Click-through to the request document (single-doc get, not a collection scan).

## 14. Founder authorization verification

- HTML `/founder*` still gated by `FOUNDER_USER_INTELLIGENCE_ENABLED` in middleware (redirect if off). A 200 HTML shell is not data access.
- `/api/founder/dashboard` is not a public API. Anonymous requests without Bearer → middleware **401**.
- Handler calls `verifyFounderUser` (admin + allow-list / `founderAccess`).
- Unit tests cover anonymous denial, non-admin denial, off-allow-list admin denial, allow-listed founder.

## 15. Firestore/query scalability assessment

No unbounded collection reads on this path. Totals use `count()`. Lists use `limit` (500 requests, 800 profiles, 400/role for the chart). Detail uses document get + `briefingReports where requestId limit 5`. Cache TTL 20s with in-flight coalescing. Same class of bound as command center / founder intelligence.

**Limitation:** period Paid/Revenue/Upcoming and directories cannot see beyond the cohort. All Time Paid/Completed use aggregations; All Time Revenue does not (no SUM index) and is labelled when the cohort is incomplete.

## 16. Tests added/updated

Added `tests/unit/founderDashboard.test.ts` (authz, paid/revenue/upcoming/completed, period, needs-attention, pagination, empty copy, lifecycle, activity series, API surface). Updated control-centre V2 header, hot-path safeguard, API route policy.

## 17. Test totals

`npm test`: **242 passed / 0 failed** (34 files).

## 18. Typecheck / lint / build results

- `npm run typecheck`: pass
- `npm run lint`: pass (pre-existing warning in `ConnectorMatching.tsx` only)
- `npm run build`: pass (Next.js production). Routes include `/founder`, `/founder/smes`, `/founder/agents`, `/founder/briefings`, `/founder/settings`, `/api/founder/dashboard`
- `qa:secrets-scan`, `qa:config`, `qa:route-retirement`: pass
- Playwright e2e and Firestore emulator: **not run locally** (avoid long Chromium/emulator wait; rely on CI)

## 19. Screens / routes verified

Build emitted:

- `/founder` (Overview V2; legacy home if flag off)
- `/founder/smes`, `/founder/smes/[id]`
- `/founder/agents`, `/founder/agents/[id]`
- `/founder/briefings`, `/founder/briefings/[id]`
- `/founder/settings`
- `/founder/user-intelligence` (preserved)
- `/api/founder/dashboard`

Live signed-in founder browser pass: **not executed** (no production founder session in this exercise).

## 20. Performance findings

Founder V2 avoids catalogue scans and does not load full collections into the browser. Overview is one authenticated API call. Directory search is debounced. Residual risk is the same 500-request cohort used elsewhere: metrics that are not `count()` aggregations may under-represent history; this is documented in `dataNotes`, not silently presented as complete.

## 21. Security findings

Allow-list and founder flag unchanged. No PayFast, fee, ITN, WhatsApp, or rules edits. Dashboard API is founder-authorized. Client flag cannot unlock data (`verifyFounderUser` still requires server `FOUNDER_USER_INTELLIGENCE_ENABLED`).

## 22. Existing Founder functionality preserved / migrated

- User Intelligence remains at `/founder/user-intelligence`
- Legacy Home remains behind `FOUNDER_DASHBOARD_V2=false`
- Admin/ops surfaces unchanged under `/admin`
- Founder intelligence API unchanged

## 23. Technical debt discovered

- No Firestore SUM aggregation for all-time revenue; cohort sum is conservative
- SME/YA directories still filter/search in process over ≤800 profiles (same bound as User Intelligence) — not a full-collection search index
- Agent earnings are commission-model cohort figures, not a payout ledger
- Upcoming KPI ignores rows with missing `briefingDate` (cannot invent dates)

## 24. Deployment status

**Not merged. Not deployed.** Do not treat this SHA as production.

## 25. Rollback strategy

1. Do not merge; or revert the PR.
2. After merge, set `FOUNDER_DASHBOARD_V2=false` and `NEXT_PUBLIC_FOUNDER_DASHBOARD_V2=false` and redeploy — `/founder` returns to Home + User Intelligence without deleting V2 routes.
3. Founder data APIs continue to fail closed if `FOUNDER_USER_INTELLIGENCE_ENABLED` is off.

## 26. Final recommendation

**READY WITH CONDITIONS** — merge only after a founder-account walkthrough of Overview, one SME, one Youth Agent, one briefing, and Settings. Do not enable in production until that walkthrough confirms numbers match known paid/ITN truth. Then remove the legacy home once V2 is trusted (do not keep two permanent implementations).
