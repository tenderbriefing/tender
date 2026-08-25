# Private Tender Publishing — Certification Report

## 1. Executive Verdict

**PRODUCTION CERTIFIED — PRIVATE TENDER PUBLISHING PHASE 1**

Phase 1 private company tender intake, Founder verification, canonical catalogue publishing, R349 booking integration, and Firestore protections are live in production. Commercial invariants (R349 / R200 / R149) are unchanged. PayFast architecture, banking/EFT, BI pipeline, and Founder allow-list were not modified.

**Release note:** First post-merge deploy of PR #61 (`tenderbriefing-00132-m7n`) lacked `FIREBASE_STORAGE_BUCKET` on Cloud Run, causing document upload **503**. Narrow hotfix **PR #62** set the bucket in `cloudbuild.yaml`, redeployed as `tenderbriefing-00133-zvg` @ **100%**, after which full production smoke passed.

## 2. PR #61 Status

| Item | Value |
| --- | --- |
| PR | https://github.com/tenderbriefing/tender/pull/61 |
| State | **MERGED** (merge commit) |
| Merged at | `2026-08-25T10:45:29Z` |
| Pre-merge head verified | `ed693145d5dbbcee7ffc661d1619b5fff8dcb401` |
| Hotfix | https://github.com/tenderbriefing/tender/pull/62 (storage bucket) — **MERGED** `2026-08-25T11:24:09Z` |

## 3. Certified Source SHA

`ed693145d5dbbcee7ffc661d1619b5fff8dcb401` (PR #61 tip at Founder-approved merge)

## 4. Merge SHA

| Merge | SHA |
| --- | --- |
| PR #61 → master | `13371afb10b2b96df291218e99b1cadd6c9e4085` |
| PR #62 hotfix → master (production tip) | `a92c61c82ca152339dca212703162603a0d2c199` |

## 5. Merge Timestamp

- PR #61: `2026-08-25T10:45:29Z`
- PR #62: `2026-08-25T11:24:09Z`

## 6. Deployment Run

| Deploy | Run | Result |
| --- | --- | --- |
| PR #61 initial | https://github.com/tenderbriefing/tender/actions/runs/32838836620 | success → revision `tenderbriefing-00132-m7n` |
| Hotfix (certifying) | https://github.com/tenderbriefing/tender/actions/runs/32842139586 | **success** → revision `tenderbriefing-00133-zvg` |

Jobs (certifying run): Auth/rules QA, Firebase (rules+indexes+storage+hosting), Cloud Run, hosting proxy, verify domains & health — all **success**.

## 7. Production SHA

`a92c61c82ca152339dca212703162603a0d2c199` (master tip including PR #61 + storage hotfix PR #62)

## 8. Production Revision

| Field | Value |
| --- | --- |
| Revision | `tenderbriefing-00133-zvg` |
| Traffic | **100%** |
| Prior (rollback) | `tenderbriefing-00131-nj5` (pre–PR #61); intermediate `tenderbriefing-00132-m7n` (PR #61 without storage env) |
| Env confirmed | `FIREBASE_STORAGE_BUCKET=tenderbriefing-34679.firebasestorage.app` |

## 9. Firestore Rules

**PASS** — deployed with release; production client reads denied:

```
match /privateTenderSubmissions/{submissionId} {
  allow read, write: if false;
}
```

Production REST probe on `privateTenderSubmissions/{smokeId}`:

| Actor | Status |
| --- | --- |
| Anonymous | **403** |
| SME | **403** |
| YA | **403** |
| Founder (client SDK/REST) | **403** (Admin SDK / Founder APIs only) |

## 10. Firestore Indexes

**PASS** — deployed with release. Certified composites for `privateTenderSubmissions`:

1. `status` ASC + `submittedAt` DESC
2. `tenderReference` ASC + `submittedAt` DESC

No index errors observed in production smoke / logs.

## 11. Public Submission Smoke

**PASS** — `scripts/pr61-production-cert-smoke.js` against `https://www.tenderbriefing.co.za`

| Check | Result |
| --- | --- |
| `/submit-tender` | 200 |
| Upload PDF | 200 (after hotfix) |
| Submit | 201 |
| Status | `submitted` |
| Submission ID | `pts-1787658350645-5ebd298f` |
| Unapproved not in catalogue | PASS |
| Synthetic naming | `PRODUCTION SMOKE — PRIVATE TENDER` |

## 12. Founder Review Smoke

**PASS**

| Check | Result |
| --- | --- |
| anon `/api/founder/private-tenders` | 401 |
| SME | 403 |
| YA | 403 |
| Founder list | 200 |
| Founder detail | 200 |

## 13. Approval / Publication

**PASS**

| Field | Value |
| --- | --- |
| Published tender ID | `priv-pts-1787658350645-5ebd298f` |
| `sourceType` | `private` |
| Company preserved | yes (`PRODUCTION SMOKE — PRIVATE TENDER Co`) |
| Submission status | `published` |
| `publishedTenderId` write-back | yes |

## 14. Idempotency

**PASS** — re-approve returned same `publishedTenderId`, `created: false`. No duplicate tender.

## 15. Catalogue / Search

**PASS** (during live window before archive)

- Public tender detail API **200** with `sourceType=private`
- Detail page showed **Private Sector** label
- Unapproved submission excluded from catalogue
- Client-side Private/Public sector filter uses `sourceType` (unchanged architecture)

## 16. Tender Detail

**PASS** (live window)

- Private Sector badge/label present
- R349 CTA present
- No active R249 reference
- Compulsory briefing fields present on canonical record

## 17. R349 Booking Integration

**PASS** — stop before payment settlement

| Check | Result |
| --- | --- |
| Request ID | `req-1787658383536-lxhlds` |
| Canonical tender ID | `priv-pts-1787658350645-5ebd298f` |
| `paymentAmount` | **34900** |
| PayFast amount | **349.00** |
| Merchant ref | `TB-REQ-*` |
| `notify_url` | `https://www.tenderbriefing.co.za/api/webhooks/payfast` |
| Payment completed | **No** (by design) |

## 18. YA / BI Integration

**PASS** (structural)

- Booking uses normal `attendanceRequests` model (no parallel private booking)
- Canonical tender carries company, reference, venue, date/time, instructions, documents
- BI remains evidence → Whisper → AI report → Founder → SME (no parallel BI path)
- No fake attendance evidence / R200 liability / BI run for this release

## 19. Security / IDOR

**PASS**

- Client direct read of raw submissions: denied for anon/SME/YA/Founder client
- Founder access only via authenticated Founder APIs
- Published catalogue follows existing `tenderBriefings` public policy

## 20. SEO

**PASS**

- `/submit-tender`: `robots=noindex, nofollow`
- Live published private tender used existing tender detail SEO path (verified badge/detail 200)
- After archive: detail returns **404** with `noindex` (not left as Soft 404 commercial listing)

## 21. Notifications

**PASS** (fail-soft contract)

- Unit/cert: Resend failures do not undo submit/approve or force 500 after commit
- Production smoke did not require live mailbox verification; emails remain fail-soft

## 22. Regression Monitoring

**PASS**

| Surface | Result |
| --- | --- |
| `/` `/pricing` `/submit-tender` `/tenders` | 200 |
| `/api/health/firestore` | 200 |
| Pricing page R349 | present (no active R249 CTA) |
| Cloud Run ERROR logs (revision 00133 window) | none returned |
| PayFast / banking / BI / Founder allow-list | unchanged by release |

Full PayFast ITN → BI E2E remains a **separate** certification stream (not re-run).

## 23. Smoke Data Cleanup

**DONE**

| Asset | Action |
| --- | --- |
| Canonical tender `priv-pts-1787658350645-5ebd298f` | `status=cancelled`, `briefingCompulsory=false`, title prefixed `[ARCHIVED PRODUCTION SMOKE]`, `smokeArchivedAt` set |
| Attendance request `req-1787658383536-lxhlds` | pending booking **cancelled** (no payment) |
| Submission `pts-1787658350645-5ebd298f` | retained for audit (`status=published`, linked `publishedTenderId`) |
| Public discoverability | tender detail **404** / not in compulsory catalogue |

## 24. Rollback Readiness

| Item | Value |
| --- | --- |
| Previous stable revision | `tenderbriefing-00131-nj5` |
| Previous master tip (pre–PR #61) | `03340e2eec109dda2427643b1f12ddb34f5e1b73` |
| App rollback | Route 100% traffic to `tenderbriefing-00131-nj5` (or redeploy prior SHA) |
| Firestore rules rollback | Redeploy rules from pre–PR #61 commit; **do not delete** `privateTenderSubmissions` data |
| Indexes | Composite indexes may remain; unused indexes are safe |
| Data compatibility | New submissions remain forward-compatible; published `sourceType=private` tenders readable by older app as normal catalogue rows |

## 25. Remaining Blockers

**None for Phase 1 production certification.**

Optional follow-ups (non-blocking):

1. Separate full PayFast ITN → BI E2E certification stream
2. Optional mailbox delivery confirmation for Resend templates

## 26. Final Recommendation

**PRODUCTION CERTIFIED — PRIVATE TENDER PUBLISHING PHASE 1**

Operate with Founder verification required before any real commercial private tender is approved. Monetisation remains SME R349 briefing attendance; Phase 1 publishing is free.

---

## Appendix A — Pre-merge gate evidence (PR #61)

Pre-merge: head `ed69314…`, CI green, mergeable CLEAN, narrowly scoped, rules/indexes match candidate. Verdict at that time: **READY FOR FOUNDER APPROVAL TO MERGE**.

## Appendix B — Architecture (unchanged)

| Layer | Role |
| --- | --- |
| `privateTenderSubmissions` | Intake / review / audit (Admin SDK writes) |
| `tenderBriefings` | Canonical published catalogue |
| `sourceType: 'private'` | Private-sector classification |
| `visibility: 'public'` | Catalogue/SEO visibility when published |

## Appendix C — Production smoke harness

`scripts/pr61-production-cert-smoke.js` — Admin custom-token auth; never logs secrets; creates clearly marked synthetic data and archives after checks.
