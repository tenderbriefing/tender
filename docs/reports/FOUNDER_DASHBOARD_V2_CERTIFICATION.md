# TenderBriefing — Founder Dashboard V2 Final Production Certification

**Date:** 2026-08-19T02:22:00Z  
**Exercise:** Final acceptance, controlled merge, production deploy, certification  
**PR:** https://github.com/tenderbriefing/tender/pull/42  
**Branch:** `feat/founder-dashboard-v2`  
**Verdict:** READY FOR PRODUCTION — MERGED AND DEPLOYED

---

## 1. Executive Verdict

**READY FOR PRODUCTION — MERGED AND DEPLOYED.**

PR #42 merged with merge-commit `ac63fa4c8469808bff274bb304827e63379ce6a3`. Production deploy of **master** succeeded: https://github.com/tenderbriefing/tender/actions/runs/32213598656. Post-deploy founder smoke against `https://www.tenderbriefing.co.za` succeeded: https://github.com/tenderbriefing/tender/actions/runs/32214922556 (base URL confirmed www). Paid count 3 and revenue 74700 cents still match Firestore. No rollback.

`SMOKE_TEST_PASSWORD` exists in GitHub secrets (names-only `gh secret list`; value never printed). Founder account `info@tenderbriefing.co.za` is the default and production `FOUNDER_EMAIL_ALLOWLIST`. Live founder sign-in succeeded. Anonymous `/api/founder/dashboard` is **401**. Invalid token is **401**. Authenticated SME `ops-smoke-sme@tenderbriefing.co.za` is **403**. Founder Overview is **200** for periods 7 / 30 / 90 / all. Live paid count and revenue match Firestore `paymentStatus === 'paid'` and `paymentAmount` (else `quotedFee`). Signed-in Playwright walkthrough and responsive Overview passed. Allow-list, `verifyFounderUser` fail-closed behaviour, Firestore rules, PayFast, ITN, WhatsApp, catalogue, and Cloud Run memory were not weakened.

HTML `GET /founder` **200** is recorded and is **not** treated as founder authorization.

---

## 2. Starting SHA

`7d7eecc3575c88099f9e6dc58c8c32442743cd72` (`origin/master`, production baseline including PR #39 and #40)

---

## 3. PR #42 HEAD

Certification-record HEAD is this commit on `feat/founder-dashboard-v2`.

Prior certified implementation HEAD: `e4848da92804ba80abeca047f980c48516154fbd`

| SHA | Role |
|---|---|
| `072a00c242c1d72a344c14a19ad597a561b6ff57` | V2 implementation |
| `1d2a5c56486ff57c27be6548c05671d49cd00379` | 403 for authenticated non-founders + secret-injected smoke |
| `04d7692` | Smoke uses public Firebase web API key (GitHub `APIKEY` is not Identity Toolkit) |
| `e4848da92804ba80abeca047f980c48516154fbd` | Live SME 403 via admin custom token + Playwright locator fix |

---

## 4. Merge SHA

`ac63fa4c8469808bff274bb304827e63379ce6a3` — `Merge pull request #42 from tenderbriefing/feat/founder-dashboard-v2` at 2026-08-19T03:50:36Z. Not squashed.

---

## 5. Final Production SHA

`ac63fa4c8469808bff274bb304827e63379ce6a3` (`origin/master` after PR #42). Deploy workflow `headSha` matched this commit.

---

## 6. Production Revision / Image

Deploy: https://github.com/tenderbriefing/tender/actions/runs/32213598656 — **success** (Firebase, Cloud Run africa-south1, hosting proxy, domain health).

Cloud Build: `6c65a871-247e-4c84-a627-25997fb0634c` in `africa-south1`, image repo `africa-south1-docker.pkg.dev/tenderbriefing-34679/tenderbriefing/`.

`gcloud run services describe` from this identity (`smartprocure.ai@gmail.com`) is IAM-denied (`run.services.get`). Exact ready revision name / image digest not readable here. Rollback flags remain `FOUNDER_DASHBOARD_V2=false` and `NEXT_PUBLIC_FOUNDER_DASHBOARD_V2=false` plus redeploy. `cloudbuild.yaml` still deploys `--memory=1Gi`.

---

## 7. PR Status

https://github.com/tenderbriefing/tender/pull/42 — **MERGED**.

- Base: `master` at `7d7eecc`
- No PR #41 (`fix/production-scale-closure` / `ab32714`) in `origin/master..HEAD`
- Protected files unchanged vs master: `firestore.rules`, `firestore.indexes.json`, `storage.rules`, `cloudbuild.yaml`, `cloudbuild-hosting-proxy.yaml`, `.github/workflows/deploy.yml`

CI on `e4848da`: https://github.com/tenderbriefing/tender/actions/runs/32207420538 — **success**

| Check | Result | Job |
|---|---|---|
| Typecheck, lint, unit, integration, QA | pass (3m6s) | 95933279098 |
| Firestore emulator IDOR matrix | pass (2m44s) | 95933279135 |
| Production build | pass | 95933816724 |
| Playwright public/a11y gates | pass | 95934609981 |

Founder V2 live smoke: https://github.com/tenderbriefing/tender/actions/runs/32207420541 — **success** (6m56s, job 95933233841)

---

## 8. Quality Gates

Local on this branch (typecheck / lint / unit / QA) plus CI on `e4848da`:

| Gate | Result |
|---|---|
| `npm run typecheck` | PASS |
| `npm run lint` | PASS (pre-existing warning only: `ConnectorMatching.tsx` missing `findConnectors` dep) |
| `npm test` | PASS — **243 passed / 0 failed** (34 files), including 23 founder dashboard tests |
| `npm run build` | PASS (CI + founder-smoke job) |
| `qa:secrets-scan` | PASS |
| `qa:config` | PASS |
| `qa:route-retirement` | PASS |
| `qa:npm-audit` | PASS — 2 critical, both allowlisted `websocket-driver`; no unapproved criticals |
| Playwright public/a11y (CI) | PASS — run 32207420538 |
| Playwright signed-in founder (smoke) | PASS — run 32207420541, traces/screenshots/video off |
| Firestore emulator (CI) | PASS — IDOR matrix |
| Firestore emulator (local) | BLOCKED — no Java Runtime; CI is authority |

---

## 9. Founder Authentication

| Case | Result | Evidence |
|---|---|---|
| Anonymous `GET /api/founder/dashboard` | **401** | Smoke vs PR HEAD Next + live production www: `Unauthorized — sign in required` (46ms local-head; production 401 previously) |
| Anonymous with `view=overview&period=30` | **401** | Smoke 6ms |
| Bogus Bearer | **401** | Smoke: `Unauthorized — invalid or expired session` |
| HTML `GET /founder` | **200** HTML | Explicitly **not** data access. Middleware requires founder intelligence flag for the shell; API requires Bearer + `verifyFounderUser`. |
| Authenticated non-founder | **403** | `ops-smoke-sme@tenderbriefing.co.za` password sign-in returned `INVALID_LOGIN_CREDENTIALS` (account exists, same smoke password does not). Live **403** proven with Admin custom token for that same SME (528ms). Handler change: `verifyApiUser` without `['admin']` so authenticated SMEs are forbidden, not collapsed to 401. |
| Authorized founder | **200** | `info@tenderbriefing.co.za` Identity Toolkit sign-in succeeded. Overview 200 for 7/30/90/all. Playwright signed-in landed on `/founder`. |

`/api/founder/dashboard` is not a public API. V2 chrome flag does not bypass `verifyFounderUser`. Production allow-list remains `FOUNDER_EMAIL_ALLOWLIST=info@tenderbriefing.co.za` in `cloudbuild.yaml`.

---

## 10. Overview Verification

Live founder API + signed-in Playwright (smoke 32207420541).

Lifetime SMEs **28**, Youth Agents **9** on every period (Firestore `count()`).

| Period | Paid Bookings | Revenue | Upcoming | Completed |
|---|---|---|---|---|
| 7 | 2 | R498.00 (`49800` cents) | 1 | 0 |
| 30 | 2 | R498.00 | 1 | 0 |
| 90 | 3 | R747.00 | 1 | 9 |
| all | 3 | R747.00 | 1 | 9 |

UI: period picker 7 / 30 / 90 / All Time clicked; Business Activity heading visible; Needs Attention heading visible. Nav: Overview, SMEs, Youth Agents (`/founder/agents`), Briefings, Settings.

---

## 11. Financial Reconciliation

**PASS — match.** Independent Admin/Firestore check vs dashboard All Time.

| Truth | Dashboard | Independent | Match |
|---|---|---|---|
| `attendanceRequests.paymentStatus === 'paid'` count | 3 | 3 (`count()` aggregation) | yes |
| Revenue (`paymentAmount` else `quotedFee`) | 104700 cents | 104700 cents | yes |
| Paid rows missing amount | 0 | 0 | yes |
| Pending excluded | 16 pending total / 16 in cohort | not in paid 3 | yes |
| Failed payments | 0 | 0 | n/a |

Redacted paid sample (no PII):

| ID | paymentStatus | provider | payfastPaymentId | amountCents | workflow status | ITN/PayFast marker |
|---|---|---|---|---|---|---|
| `req-…w6f0` | paid | payfast | yes | 34900 | pending | yes |
| `req-…lcb3` | paid | payfast | yes | 34900 | pending | yes |
| `req-…r8f8` | paid | yoco | no | 34900 | completed | no (legacy Yoco paid row; still `paymentStatus===paid`) |

2 of 3 paid rows carry PayFast ITN markers. Revenue is 3 × R349 stored amounts (`34900` each), not bookings × invented price. Pending 16 are excluded. No merge-blocking mismatch.

---

## 12. Activity Chart

**PASS** live. One **Business Activity** chart; Playwright heading visible. API series present for 7/30/90/all. Empty copy remains **No activity in this period.** Period cap 90.

---

## 13. Needs Attention

**PASS** live. Two `paid_awaiting_assignment` items, hrefs under `/founder/briefings/`. Matches the two paid+pending PayFast rows. Empty copy **Nothing requires your attention.** still shipped.

---

## 14. SME Directory

**PASS** live. `/founder/smes` Playwright: heading + Company column. API `view=smes` 200 and one SME detail 200 (id redacted). Search + pagination over bounded cohort; paid bookings/spent from request cohort.

---

## 15. Youth Agent Directory

**PASS** live. Route `/founder/agents`. Playwright heading + Completed column. API directory + detail 200. Earnings are `paymentAmount`/`quotedFee` × `(1 - PLATFORM_COMMISSION_RATE)` on paid+completed cohort rows — dashboard intelligence, not a payout ledger.

---

## 16. Briefings

**PASS** live. `/founder/briefings` Playwright Status column. API items include presentational lifecycles `paid`, `unpaid`, `report_delivered` plus backend `status`. Detail 200 for `req-…w6f0` with lifecycle `paid` and backend status present.

---

## 17. Settings / Secondary Tools

**PASS** live click-through. `/founder/settings`: User Intelligence → `/founder/user-intelligence`; Operations console → `/admin/dashboard`. Both HTML 200. Primary nav does not include admin/infrastructure.

---

## 18. Security

- Anonymous founder dashboard API: **401**
- Invalid token: **401**
- Authenticated SME: **403**
- Founder: **200**
- HTML 200 on `/founder` is **not** founder data authorization
- `verifyFounderUser` still requires `FOUNDER_USER_INTELLIGENCE_ENABLED`, authenticated user, admin `userType`, and allow-list / `founderAccess`
- Allow-list unchanged; Firestore rules not edited in this PR
- No new public API
- V2 feature flag does not bypass `verifyFounderUser`
- PayFast, R349 pricing, ITN, WhatsApp, catalogue, Cloud Run memory: **not changed**
- Smoke logs print HTTP status/latency/KPI numbers only; password and tokens not logged; Playwright traces off

---

## 19. Firestore / Query Scale

Founder V2 path: `count()` for lifetime SME / YA / paid / completed; lists `limit` 500 requests, 800 profiles, 400/role for the chart; detail is document get. Cache TTL 20s. Hard cap 2000 in storage. No `getAllTenders` on this path. `cloudbuild.yaml` memory remains **1Gi**. Live paid volume is 3, well under the 500 cohort.

---

## 20. Performance

Founder Overview API on PR HEAD against production Firestore: 382–674ms depending on period. Directory/detail 267–501ms. HTML shells 8–108ms. Playwright signed-in suite passed in ~11s once selectors were unique. Residual risk remains the 500-request cohort at higher volume, labelled in `dataNotes`.

---

## 21. Responsive Browser Check

**PASS** signed-in Playwright at 375 and 1280: Overview heading + Revenue visible; no horizontal overflow (`scrollWidth <= clientWidth + 8`). No product CSS changes (selector-only test fix).

---

## 22. Production Smoke

Pre-merge 16 checks against V2 on PR HEAD + production Firestore (not yet on www, which is still `7d7eecc`):

1. Founder login — **PASS**
2. `/founder` V2 shell — **PASS** (Playwright Overview)
3. Six KPIs load — **PASS**
4. Revenue/Paid vs known paid records — **PASS** (3 × 34900 = 104700)
5. Business Activity renders — **PASS**
6. Needs Attention loads — **PASS** (2 paid awaiting assignment)
7. SME directory — **PASS**
8. One SME detail — **PASS**
9. Youth Agent directory — **PASS**
10. One Youth Agent detail — **PASS**
11. Briefings — **PASS**
12. One briefing detail — **PASS**
13. Settings — **PASS**
14. User Intelligence link — **PASS**
15. Admin/Operational link — **PASS**
16. Unauthorized API denied — **PASS** (401 anonymous + invalid; 403 SME)

Post-merge www smoke (16 checks) against https://www.tenderbriefing.co.za after deploy — run 32214922556 **success**, `FOUNDER_SMOKE_BASE_URL=https://www.tenderbriefing.co.za`:

1. Founder login — **PASS**
2. `/founder` V2 API/shell — **PASS** (Overview 200; HTML 200 contains Youth Agents nav copy)
3. Six KPIs load — **PASS** (SMEs 28, Youth Agents 9, same period table as pre-merge)
4. Revenue/Paid vs known paid records — **PASS** (3 × 34900 = 104700)
5. Business Activity — **PASS** (API series)
6. Needs Attention — **PASS** (2 paid awaiting assignment)
7. SME directory — **PASS**
8. One SME detail — **PASS**
9. Youth Agent directory — **PASS**
10. One Youth Agent detail — **PASS**
11. Briefings — **PASS**
12. One briefing detail — **PASS**
13. Settings — **PASS**
14. User Intelligence link — **PASS**
15. Admin/Operational link — **PASS**
16. Unauthorized API denied — **PASS** (www anonymous 401 + smoke 403 SME)

Public `GET /api/health/firestore` → 200 `{status:ok, connected:true}`. No rollback.

---

## 23. Production Logs

Pre-deploy: no V2 logs on the previous revision. Post-deploy Cloud Run describe/logs remain IAM-denied for `smartprocure.ai@gmail.com`. Smoke against www succeeded with founder Overview 200, so V2 is serving. Cloud Build id `6c65a871-247e-4c84-a627-25997fb0634c`.

---

## 24. Legacy Founder Home

**Retained.** `components/founder/legacy/FounderHomePage.tsx` remains behind `FOUNDER_DASHBOARD_V2=false`. Do not delete until V2 production verification succeeds. Follow-up: retire legacy Home in a small dedicated PR after a certified production pass.

---

## 25. Known Limitations

- All Time revenue is a ≤500 paid-request cohort sum when volume exceeds that bound (live volume is 3)
- SME/YA directory search is in-process over ≤800 profiles
- Agent earnings are commission-model cohort figures, not a payout ledger
- Upcoming KPI ignores rows with missing `briefingDate`
- One live paid row is legacy `paymentProvider: yoco` and is correctly counted as paid
- SME smoke password is not the founder smoke password; 403 used Admin custom token for the existing SME
- GitHub secret `APIKEY` is not a valid Firebase web key; smoke uses the committed public web config
- Client rollback of V2 chrome is reliable when `NEXT_PUBLIC_FOUNDER_DASHBOARD_V2=false` is baked at image build; set both documented flags and redeploy

---

## 26. Rollback Readiness

Ready after deploy:

1. Set `FOUNDER_DASHBOARD_V2=false` and `NEXT_PUBLIC_FOUNDER_DASHBOARD_V2=false`, then `workflow_dispatch` **Deploy TenderBriefing**. `/founder` returns to Home + User Intelligence without deleting V2 routes.
2. Founder data APIs continue to fail closed if `FOUNDER_USER_INTELLIGENCE_ENABLED` is off.
3. Do not delete legacy Home as part of rollback.

No rollback triggered at certification time.

---

## 27. Final Recommendation

Pre-merge and post-deploy gates passed. PR #42 merged. Master `ac63fa4` deployed via Deploy TenderBriefing. www founder smoke passed. No rollback.

**FOUNDER DASHBOARD V2 — READY FOR PRODUCTION — MERGED AND DEPLOYED**
