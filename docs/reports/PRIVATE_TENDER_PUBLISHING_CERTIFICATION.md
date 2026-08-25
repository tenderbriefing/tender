# Private Tender Publishing — Certification Report

## 1. Executive Verdict

**PASS WITH CONDITIONS — READY FOR FOUNDER APPROVAL TO MERGE**

Phase 1 private company tender intake, Founder verification, and canonical catalogue publishing are implemented on `feat/private-tender-publishing` without a parallel marketplace. Commercial invariants (R349 / R200 / R149) are unchanged. Live Founder V2 smoke and PayFast readiness scripts were not executed in this environment (missing `SMOKE_TEST_PASSWORD`).

## 2. Branch

`feat/private-tender-publishing`

## 3. Base SHA

`03340e2eec109dda2427643b1f12ddb34f5e1b73` (production-aligned `master` tip including PR #60 R349 certification)

## 4. Final SHA

`abab9ebdeba3b3794abe1f759a2fdb3ad46519a8`

## 5. PR

https://github.com/tenderbriefing/tender/pull/61

## 6. Architecture

| Layer | Role |
| --- | --- |
| `privateTenderSubmissions` | Intake / review / audit only (Admin SDK writes) |
| `tenderBriefings` | Canonical published catalogue (unchanged collection) |
| `sourceType: 'private'` | Distinguishes private-sector opportunities from public/eTenders |
| `visibility: 'public'` | Published private tenders are catalogue/SEO visible |

**Not confused with** existing RFQ `visibility: 'private'` owner-only records.

## 7. Submission Flow

- Public page: `/submit-tender` (multi-section form, honeypot, confirmation)
- Upload: `POST /api/private-tenders/upload` (PDF/DOC/DOCX, 10 MB, private GCS path)
- Submit: `POST /api/private-tenders/submit` (rate-limited, server validation)
- Status: `/submit-tender/status/[token]` + `GET /api/private-tenders/status/[token]`
- Phase 1 requires `briefingRequired` + `briefingCompulsory` and briefing before closing

## 8. Founder Verification

- Queue: `/founder/private-tenders`
- Detail: `/founder/private-tenders/[id]`
- Actions: under review / request changes / reject / **Approve & Publish**
- Auth: `verifyFounderUser` on all Founder APIs
- Duplicate flags surfaced for Founder review (no silent merge)

## 9. Canonical Tender Publishing

- Approve maps submission → `createEmptyTenderBriefing` + `upsertTenders`
- Deterministic id `priv-{submissionId}`; repeated approve is idempotent
- Links `privateSubmissionId` / `publishedTenderId`
- Documents served via signed URL route `/api/tenders/[id]/documents/[docId]`

## 10. Catalogue / Search

- Private tenders appear in existing catalogue when compulsory + upcoming briefing
- Subtle **Private Sector** badge on cards
- Sector filter: All / Public Sector / Private Sector
- Search haystack includes company, title, reference, province, category

## 11. Private Tender Detail

- Uses existing `/tenders/[id]` architecture
- Hero label: **Private Sector Tender**
- Disclaimer: third-party publisher remains responsible for evaluation/award
- Same R349 attendance CTA (`TenderActionPanel`)

## 12. R349 Booking Integration

- No alternate booking path; existing attendance request + PayFast flow
- Snapshot remains `BRIEFING_PRICE_CENTS = 34900`

## 13. YA Workflow

- Unchanged assignment / evidence / Submit Report path against canonical tender id

## 14. BI Integration

- Unchanged Whisper → AI report → Founder → SME delivery against published tender

## 15. YA Liability

- `YOUTH_AGENT_PAYOUT_CENTS = 20000` / gross margin `14900` — regression-tested

## 16. Security / IDOR

- Firestore: `privateTenderSubmissions` deny all client read/write (Admin SDK only)
- Founder APIs require Founder allow-list
- Public cannot list/review submissions
- IDOR emulator suite extended and **PASS** (40 tests)

## 17. Firestore Rules / Indexes

- Rules updated for `privateTenderSubmissions`
- Composite indexes: `status+submittedAt`, `tenderReference+submittedAt`
- **Deploy required on merge** (`firebase deploy --only firestore:rules,firestore:indexes`)

## 18. SEO

- Published private tenders use existing tender SEO builders (+ private keywords)
- `/submit-tender` and status pages: **noindex**
- Expired behaviour unchanged (historical compulsory detail remains indexable per existing policy)

## 19. Notifications

- Fail-soft Resend emails: submitted ack / published / rejected / changes requested
- No Founder internal notes exposed to companies

## 20. Regression Gates

| Gate | Status |
| --- | --- |
| typecheck | PASS |
| lint | PASS (pre-existing unrelated warning only) |
| unit (401 incl. private tender) | PASS |
| private tender tests | PASS |
| Firestore IDOR emulator | PASS |
| BI unit/integration suite | PASS |
| Playwright (release-gates incl. submit-tender) | PASS (focused + private tender page) |
| production build | PASS |
| Founder V2 smoke | **SKIPPED** — `SMOKE_TEST_PASSWORD` unset |
| PayFast readiness | **SKIPPED** — `SMOKE_TEST_PASSWORD` unset |

## 21. Files Changed

Key additions:

- `lib/privateTenders/*`, `backend/services/privateTenderSubmissionService.js`
- `app/submit-tender/**`, `app/founder/private-tenders/**`
- `app/api/private-tenders/**`, `app/api/founder/private-tenders/**`
- `app/api/tenders/[id]/documents/[docId]/route.ts`
- `lib/services/privateTenderEmail.js`
- Tests + firestore rules/indexes + catalogue/SEO wiring

## 22. Remaining Blockers

1. Deploy Firestore rules + indexes before/with production release.
2. Re-run Founder V2 smoke + PayFast readiness with `SMOKE_TEST_PASSWORD` in a credentialed environment.
3. Optional: first production dry-run (submit → Founder approve → catalogue → R349 booking) after merge.

## 23. Deployment Recommendation

**Do not deploy automatically.** Merge only after Founder approval. After merge, deploy app + Firestore rules/indexes together. Monetisation remains SME R349 briefing attendance; Phase 1 publishing is free.
