# Private Tender Phase 3 — Implementation Assessment

**Date:** 2026-08-26  
**Branch:** `feat/private-tender-briefing-operations-phase3`  
**Base:** `origin/master` @ `cdeb8586ad3b6c41bccafd08caa44d24ba3c567b`  
**Status:** Pre-implementation assessment (no production changes)

## Verdict

**SAFE TO IMPLEMENT ON BRANCH** — Phase 3 can be delivered as additive extensions of the certified R349 → Youth Agent → Briefing Intelligence stack after Founder publish. No parallel booking, PayFast, BI, banking, or marketplace engines are required.

## Current certified baseline (immutable)

- Phase 1 guest `/submit-tender` + Founder publish → `tenderBriefings` (`sourceType=private`)
- Phase 2 organisation workspace + IDOR + durable `privateTenderAuditEvents`
- SME booking via `attendanceRequests` + PayFast (`briefingPriceCents=34900`, `pricingVersion=2026-08-v349`)
- YA payout `20000` cents; monthly manual EFT unchanged
- BI: evidence → Whisper → AI minutes → Founder approve → SME delivery

## Reuse map

| Phase 3 need | Reuse | Avoid |
|---|---|---|
| 3A Booking | `createRequest`, PayFast checkout, tender catalogue CTA | New payment collection / `/api/bookings` |
| 3B Founder ops | `founderDashboardService`, existing briefing rows | Separate private ops engine |
| 3C Assignment recommendations | `liveDispatchService` + explainable scorer | Opaque auto-assign AI |
| 3D Evidence | `briefing-intelligence/evidence` metadata | GPS tracking / biometrics |
| 3E AI v2 | Extend `briefingSummaryService` / minutes schema behind flag | Parallel report pipeline |
| 3F Follow-ups | New Admin-SDK collection + Founder gate | Mutating approved report in place |
| 3G SME history | Enrich `/api/attendance-requests` + SME requests UI | Bid-management workspace |
| 3H Notifications | Existing TX email + founder ops notify | Notification spam |

## Data model extensions (additive)

1. **Submission / published tender briefing fields:** `briefingType`, `briefingEndTime`, `briefingAddress`, `briefingProvince`, `briefingMunicipality`, `briefingContactDetails`, `briefingRegistrationDeadline` (optional; physical booking CTA when type=`physical` and compulsory/required).
2. **Attendance request snapshot (immutable at booking):** `source`, `privateTenderId`, `privateSubmissionId`, `organisationId`, `briefingSnapshot`, `pricingVersion`, `briefingPriceCents`.
3. **Evidence metadata:** strengthen `submittedAt`, actor, request link, optional note (no surveillance).
4. **AI v2 structured sections** behind `BRIEFING_INTELLIGENCE_V2_ENABLED`.
5. **`briefingFollowUpUpdates`** collection (Admin SDK deny-all client): linked to private tender / request; Founder review; never overwrites original report.

## Security

- Fail-closed flags (server authoritative; NEXT_PUBLIC never authorizes)
- Cross-org IDOR for follow-ups and private-linked requests
- Server-owned payment / approval / ownership fields
- Durable audit for material lifecycle events
- No secrets in repo; no production flag enablement in this PR

## Non-goals (hard stop)

Supplier bidding, evaluation, awards, marketplace, ERP, escrow, banking APIs, autonomous AI decisions.

## Rollout (post-merge, Founder-controlled)

1. Merge on green CI  
2. Deploy app + rules + indexes  
3. Enable flags deliberately: booking → ops → AI v2 → follow-ups  
4. Production smoke (stop before real payment unless authorised)  
5. Production certification separately  

## Rollback

Disable Phase 3 flags; keep Phase 1/2 intact. Do not roll back Firestore blindly. Application rollback to last certified Phase 2 revision if needed (`tenderbriefing-00137-fbl` lineage / prior known-good).
