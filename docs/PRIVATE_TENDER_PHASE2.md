# Private Tender Publishing — Phase 2

Organisation procurement workspace on top of certified Phase 1 private tender publishing.

**Assessment:** `docs/private-tender-phase2-assessment.md`  
**Certification:** `docs/reports/PRIVATE_TENDER_PUBLISHING_PHASE2_CERTIFICATION.md`

---

## Architecture

```
Organisation (privateOrganisations)
  └─ Members (privateOrganisationMembers)
       └─ Drafts / submissions (privateTenderSubmissions + organisationId)
            └─ Founder moderation (unchanged gate)
                 └─ Canonical tenderBriefings (sourceType=private)
                      └─ Existing R349 → YA → BI
```

Phase 1 public `/submit-tender` remains available (guest path). Authenticated org members use `/procurement` when the feature flag is on.

---

## Collections (Admin SDK deny-all client)

| Collection | Purpose |
| --- | --- |
| `privateOrganisations` | Legal entity profile |
| `privateOrganisationMembers` | uid ↔ org role |
| `privateTenderSubmissions` | Extended with `organisationId`, `draft`, withdraw, … |
| `privateTenderAuditEvents` | Durable audit (fail-soft writes) |

---

## State machine

Statuses: `draft → submitted → under_review → changes_requested|approved|rejected|published → closed|archived` (+ `withdrawn` from draft/submitted/changes_requested).

Corporate users cannot transition to `published`. Founder publish remains idempotent (`priv-{submissionId}`).

---

## Organisation permissions

| Capability | owner | admin | procurement |
| --- | --- | --- | --- |
| manage profile | ✓ | ✓ | |
| manage members | ✓ | ✓ | |
| create/edit/submit/withdraw/duplicate | ✓ | ✓ | ✓ |
| destructive org | ✓ | | |

Users cannot self-set `verificationStatus=verified`.

---

## APIs

Procurement (flag-gated):

- `GET/POST/PATCH /api/procurement/organisation`
- `GET /api/procurement/team`, `POST .../invite`, `PATCH .../[membershipId]`
- `GET /api/procurement/dashboard`
- `GET/POST /api/procurement/tenders`
- `GET/PATCH /api/procurement/tenders/[id]`
- `POST .../submit|withdraw|duplicate`

Founder: existing `/api/founder/private-tenders/[id]/review` (+ optional `issueCategory`).

Phase 1 public: `/api/private-tenders/*` unchanged.

---

## Feature flag

- Server: `PRIVATE_TENDER_ORGANISATION_WORKSPACE_ENABLED` (fail-closed)
- UI: `NEXT_PUBLIC_PRIVATE_TENDER_ORGANISATION_WORKSPACE_ENABLED`
- Flag key: `private_tender_organisation_workspace_v1`

When disabled, Phase 1 submit + Founder review continue to work.

---

## Security

- All new collections: `allow read, write: if false`
- Membership derived server-side from Auth UID (never trust client orgId/role)
- Org A cannot read Org B submissions (API ownership checks)
- Founder APIs remain Founder-only

---

## Indexes

Added composites for:

- `organisationId + updatedAt`
- `organisationId + status + updatedAt`
- members `uid + status`, `organisationId + uid`
- audit `submissionId + createdAt`

---

## `/submit-tender` decision

**Hybrid:** keep certified guest form; when workspace UI flag is on, show CTA to `/procurement`.

---

## Rollback

1. Set `PRIVATE_TENDER_ORGANISATION_WORKSPACE_ENABLED=false`
2. Optionally route Cloud Run back to prior revision
3. Do **not** delete `privateOrganisations` / memberships / drafts
4. Firestore rules may stay deny-all (safe)

---

## Migration

Legacy Phase 1 rows without `organisationId` remain Founder-visible; ignored by `/procurement`.  
Scaffold: `scripts/backfill-private-tender-organisations.js` (dry-run default; do not auto-apply).

---

## Monitoring / limitations

- No KYC automation
- Approve still publishes in one Founder action (Phase 1 behaviour)
- Email remains fail-soft
- No supplier bidding / RFQ / payments between corporates
