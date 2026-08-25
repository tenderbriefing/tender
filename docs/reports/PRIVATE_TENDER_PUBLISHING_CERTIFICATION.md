# Private Tender Publishing — Certification Report

## 1. Executive Verdict

**READY FOR FOUNDER APPROVAL TO MERGE**

Phase 1 private company tender intake, Founder verification, and canonical catalogue publishing are implemented on `feat/private-tender-publishing` without a parallel marketplace. Commercial invariants (R349 / R200 / R149) are unchanged. All mandatory release gates are **PASS**, including Founder V2 smoke and PayFast readiness.

## 2. Branch

`feat/private-tender-publishing`

## 3. Base SHA

`03340e2eec109dda2427643b1f12ddb34f5e1b73` (production-aligned `master` tip including PR #60 R349 certification)

## 4. Final SHA

_Recorded at tip after pre-merge certification commit._

## 5. PR

https://github.com/tenderbriefing/tender/pull/61

Candidate head verified at start of this exercise: `bf96a415bf41f9ec639fff4150032c97de02ae35` (matched PR #61 head). Subsequent certification-only commits (smoke harness + report) advance the tip; gates below were re-run on the working tree including those fixes.

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

**PASS** — local/json cert (`scripts/pr61-private-tender-booking-cert.js`):

- First publish creates canonical tender (`sourceType=private`, `visibility=public`)
- Repeat publish idempotent (same tender id, `created=false`)
- Attendance request uses canonical tender id
- `paymentAmount` / `briefingPriceCents` = **34900**
- No `privateBooking` path
- YA liability constant remains **20000**
- BI linkage via `request.tenderId`

## 13. YA Workflow

- Unchanged assignment / evidence / Submit Report path against canonical tender id

## 14. BI Integration

- Unchanged Whisper → AI report → Founder → SME delivery against published tender
- BI regression suite: **PASS** (72 tests)

## 15. YA Liability

- `YOUTH_AGENT_PAYOUT_CENTS = 20000` / gross margin `14900` — regression-tested

## 16. Security / IDOR

- Firestore: `privateTenderSubmissions` deny all client read/write (Admin SDK only)
- Founder APIs require Founder allow-list
- Public cannot list/review submissions
- IDOR emulator suite: **PASS** (40 tests)

### Founder Smoke

**PASS**

Auth via Admin custom tokens when `SMOKE_TEST_PASSWORD` unset (service account — no secrets logged). Against local PR HEAD (`http://127.0.0.1:3000`) with production Firestore:

- anon → `/api/founder/private-tenders` **401**
- SME → **403**
- YA → **403**
- Founder list → **200**
- Founder HTML `/founder/private-tenders` → **200**
- Existing Founder Dashboard V2 overview/directories/reconcil → **PASS** (`ok: true`, `failures: []`)

### PayFast Readiness

**PASS**

Production readiness (`https://www.tenderbriefing.co.za`) with Admin custom-token SME/YA auth:

- `paymentAmount` **34900**
- PayFast amount field **349.00**
- `notify_url` = `https://www.tenderbriefing.co.za/api/webhooks/payfast`
- return/cancel URLs present
- merchant ref `TB-REQ-*`
- unpaid gated from agent accept/opportunities
- Legacy R249 constant retained (**24900**)
- No private booking/payment module
- Note: `/api/integrations/health` is auth-gated (**401**) on production; checkout path is authoritative

### Founder Approval Idempotency

**PASS** — service + booking cert prove short-circuit when `publishedTenderId` set; mapper id stable `priv-{submissionId}`

### Submission Abuse Controls

**PASS** — unit validation + public API policy:

- missing company / reference / briefing rejected
- briefing after closing rejected
- unsafe/oversized file rejected
- rate limit on submit/upload/status
- raw submissions not client-readable (Firestore rules)
- honeypot field on form

### Notification Fail-Soft

**PASS** — email helpers skip when Resend unset; submit/review routes catch email errors and still return success (201 / 200)

## 17. Firestore Rules / Indexes

### Rules (must deploy with release)

```
match /privateTenderSubmissions/{submissionId} {
  allow read, write: if false;  // Admin SDK only
}
```

Published private-sector tenders use existing `tenderBriefings` public catalogue read policy (`visibility != 'private'`). No broader client write permissions introduced.

### Indexes (must deploy with release)

`firestore.indexes.json` additions:

1. `privateTenderSubmissions`: `status` ASC + `submittedAt` DESC (Founder queue filter)
2. `privateTenderSubmissions`: `tenderReference` ASC + `submittedAt` DESC (duplicate checks)

Single-field queries (`trackingToken`, `submittedAt` order) use automatic indexes.

Catalogue `sourceType` filter is client-side over the existing bounded compulsory catalogue page — **no new tenderBriefings composite index required** for Phase 1.

**Do not deploy until Founder merge approval.** Release must include: app + `firestore:rules` + `firestore:indexes`.

## 18. SEO

- Published private tenders use existing tender SEO builders (+ private keywords)
- `/submit-tender` and status pages: **noindex**
- Expired behaviour unchanged

## 19. Notifications

- Fail-soft Resend emails: submitted ack / published / rejected / changes requested
- No Founder internal notes exposed to companies

## 20. Final Gate Matrix

| Gate | Status |
| --- | --- |
| typecheck | **PASS** |
| lint | **PASS** (pre-existing unrelated warning only) |
| unit (409) | **PASS** |
| private tender / PR61 cert tests | **PASS** |
| Founder V2 smoke | **PASS** |
| PayFast readiness | **PASS** |
| Firestore IDOR emulator | **PASS** |
| BI regression | **PASS** |
| Playwright (release-gates focused + submit-tender) | **PASS** |
| production build | **PASS** |
| Diff audit | **PASS** — narrowly scoped; no cloudbuild/secrets/banking/PayFast ITN/pricing-constant mutations |

## 21. Files Changed

Key additions remain private-tender intake/publish + catalogue badge/filter + Founder queue. Pre-merge certification also updates:

- `scripts/founder-dashboard-v2-smoke.js` — Admin token fallback + private-tender auth matrix
- `scripts/payfast-readiness-check.js` — Admin token fallback + amount/notify/legacy/private-path checks
- `scripts/pr61-private-tender-booking-cert.js` — booking/idempotency cert harness
- `tests/unit/pr61CertificationGaps.test.ts`

## 22. Remaining Blockers

1. **Founder merge approval** (human)
2. On release: deploy **Firestore rules + indexes** together with the app
3. Optional post-merge: first production dry-run submit → approve → R349 booking

## 23. Deployment Recommendation

**Do not merge or deploy automatically.** After Founder approval to merge, deploy app + Firestore rules/indexes together. Monetisation remains SME R349 briefing attendance; Phase 1 publishing is free.
