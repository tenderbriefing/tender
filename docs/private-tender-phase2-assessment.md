# Private Tender Publishing — Phase 2 Assessment

**Date:** 2026-08-25  
**Base:** `master` @ `4082c2062818d71dbb1429d61a12477d1c812577` (includes certified Phase 1 tip `a92c61c…` + certification docs)  
**Branch:** `feat/private-tender-organisation-workspace`  
**Phase 1 report:** `docs/reports/PRIVATE_TENDER_PUBLISHING_CERTIFICATION.md`

---

## 1. Current architecture (Phase 1)

Dual-layer model (must not be replaced):

| Layer | Collection / surface | Role |
| --- | --- | --- |
| Intake | `privateTenderSubmissions` | Submit → Founder review → audit |
| Catalogue | `tenderBriefings` | Canonical published opportunity (`sourceType: 'private'`, `visibility: 'public'`) |
| Documents | GCS `private-tender-submissions/...` via Admin SDK upload | Signed URLs for Founder / public tender docs |
| Booking | Existing `attendanceRequests` + PayFast | R349 — unchanged |

Flow:

```
/submit-tender → POST /api/private-tenders/{upload,submit}
  → Founder /founder/private-tenders → approve
  → tenderBriefings (priv-{submissionId})
  → catalogue / detail → R349 → YA → BI
```

---

## 2. Collections & document schema (Phase 1)

### `privateTenderSubmissions`

Present today:

- Identity: `id`, `trackingToken`, `status`
- Company/contact: `companyName`, `registrationNumber`, `website`, `contactPersonName`, `contactEmail`, `contactPhone`
- Tender: title, reference, description, category, province, municipality, closing*
- Briefing: compulsory fields (Phase 1 forces compulsory)
- Documents: `tenderDocument`, `supportingDocuments[]` (`storagePath`, …)
- Submitter: **`submittedByUid`**, **`submittedByEmail`** (nullable; public form usually omits Bearer)
- Review: `reviewedAt/By*`, `rejectionReason`, `changesRequestedNote`
- Publish: **`publishedTenderId`**, `publishedAt`
- Timestamps: `submittedAt`, `createdAt`, `updatedAt`
- Inline `audit[]`, `duplicateFlags[]`

**Absent (Phase 2 gaps):** `organisationId`, `createdBy`, membership link, `draft` status, durable external audit collection, withdraw/archive.

Statuses today: `submitted | under_review | changes_requested | approved | rejected | published`  
(`approved` is in the type enum but approve currently jumps to `published`.)

### Rules

```
match /privateTenderSubmissions/{id} { allow read, write: if false; }
```

Admin SDK + Founder/public APIs only. **Do not loosen for Phase 2.**

### Indexes

- `status` + `submittedAt`
- `tenderReference` + `submittedAt`

---

## 3. APIs (Phase 1)

| Route | Auth |
| --- | --- |
| `POST /api/private-tenders/upload` | Public (rate-limited) |
| `POST /api/private-tenders/submit` | Public; optional Bearer sets `submittedByUid` |
| `GET /api/private-tenders/status/[token]` | Token |
| `GET/POST /api/founder/private-tenders…` | `verifyFounderUser` |

Key service: `backend/services/privateTenderSubmissionService.js`  
(`createSubmission`, `reviewSubmission`, `publishSubmission`, `uploadPrivateTenderDocument`, …)

---

## 4. Auth model

- User types: `sme` | `youth-agent` | `admin`
- Founder: `founderAccess` **or** `FOUNDER_EMAIL_ALLOWLIST` (+ intelligence flag)
- **No organisation membership model** today
- Closest patterns: YA workspace feature flag (`YOUTH_AGENT_WORKSPACE_*`), SME workspace per-uid docs

---

## 5. Security boundaries (must preserve)

- Raw submissions never client-readable
- Corporate users must never write `tenderBriefings` / publish
- Founder-only moderation
- Catalogue only shows published canonical tenders
- R349 / PayFast / YA / BI untouched

---

## 6. Proposed Phase 2 extension

### New collections (Admin SDK deny-all client)

1. **`privateOrganisations`** — legal entity profile + verification (Founder may verify later; users cannot self-verify)
2. **`privateOrganisationMembers`** — `organisationId` + `uid` + role (`owner`|`admin`|`procurement`) + status
3. **`privateTenderAuditEvents`** — durable events (keep Phase 1 inline `audit[]` for compatibility)

### Extend `privateTenderSubmissions`

- Add: `organisationId`, `createdByUid`, optional `draft` fields
- Expand status machine: `draft`, `withdrawn`, `closed`, `archived` (+ keep Phase 1 statuses)
- Org-scoped create/update/submit/withdraw/duplicate via **`/api/procurement/*`**
- Preserve public `POST /api/private-tenders/submit` for guest Phase 1 path

### Workspace UI

`/procurement` (flag-gated): Dashboard, Tenders, New Tender, Organisation, Team

### Feature flag

- Server: `PRIVATE_TENDER_ORGANISATION_WORKSPACE_ENABLED` (fail-closed)
- Optional UI: `NEXT_PUBLIC_PRIVATE_TENDER_ORGANISATION_WORKSPACE_ENABLED`
- Phase 1 continues when flag is off

### `/submit-tender` decision — **Hybrid (A + B)**

- **Unauthenticated / no org:** keep certified public multi-step form (Phase 1)
- **Authenticated + active org membership + flag on:** soft-route CTA to `/procurement/tenders/new` (do not break guest submit)

---

## 7. Migration implications

- Legacy Phase 1 rows lack `organisationId` — Founder queue still lists them; org workspace ignores them unless backfilled
- Optional dry-run backfill script later (not auto-run)
- Do not delete or rewrite published `tenderBriefings`

---

## 8. Risks

| Risk | Mitigation |
| --- | --- |
| IDOR across organisations | Server membership checks; deny-all rules; dedicated tests |
| Loosening Firestore rules | Keep Admin SDK ownership |
| Breaking Phase 1 submit | Leave public APIs intact; flag off = no workspace |
| Duplicate publish | Keep existing idempotent `publishSubmission` |
| Status confusion (`approved` vs `published`) | Document; approve may still publish in one step; `approved` reserved for future split if needed |
| Index explosions | Add only org query indexes actually used |

---

## 9. Non-goals (explicit)

Supplier bidding, RFQ responses, evaluation, POs, contracts, invoicing, corporate payments, advertising packages, CRM analytics suite, automated KYC, parallel booking/BI, merging/deploying.

---

## 10. Reuse map

| Capability | Reuse |
| --- | --- |
| Upload | `uploadPrivateTenderDocument` |
| Publish | `publishSubmission` / `mapToCanonicalTender` |
| Founder gate | `verifyFounderUser` |
| Emails | `lib/services/privateTenderEmail.js` (+ org events) |
| Badge/filter | `isPrivateSectorTender` / `sourceSector` |
| Flag style | YA workspace fail-closed pattern |
| Validation | Extend `lib/privateTenders/validation.ts` for drafts (partial) vs submit (full) |

---

## Assessment conclusion

Phase 2 is a **workspace + organisation membership layer** on top of the certified intake collection, not a second marketplace. Implementation may proceed on `feat/private-tender-organisation-workspace` without modifying production until Founder merge approval.
