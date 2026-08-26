# Private Tender Publishing — Phase 3: Briefing Operations & Intelligence

**Assessment:** `docs/private-tender-phase3-assessment.md`  
**Branch:** `feat/private-tender-briefing-operations-phase3`  
**Status:** Implementation (not production-certified until merge, deploy, flag enablement, and production smoke)

---

## Scope

Deepen TenderBriefing’s core operating model around **published private tenders → physical briefing attendance → R349 Youth Agent service → evidence → AI intelligence → Founder approval → SME delivery → controlled follow-up clarifications**.

TenderBriefing is **not** becoming a procurement marketplace, bidding platform, ERP, contract-management system, supplier marketplace, escrow platform, or tender evaluation platform.

---

## Architecture

```
Organisation / guest private tender
  └─ Founder publish → tenderBriefings (sourceType=private)
       └─ Structured briefing fields (3A)
            └─ SME CTA: Appoint a Youth Agent — R349
                 └─ attendanceRequests + immutable booking snapshot
                      └─ Existing PayFast path (unchanged)
                           └─ YA assignment (explainable recommendations; Founder assigns)
                                └─ Evidence integrity metadata (3D)
                                     └─ Whisper → AI minutes (+ v2 sections when flagged)
                                          └─ Founder approve → SME delivery
                                               └─ briefingFollowUpUpdates (append-only, Founder-gated)
```

**Reuse before invent:** one authoritative `attendanceRequests` lifecycle; one PayFast path; one BI pipeline; existing Founder ops dashboard; existing audit + founder ops notifications.

---

## Lifecycle

1. Private tender published with optional briefing configuration  
2. Physical bookable briefing → SME books R349 service  
3. Immutable snapshot stamped on request (`source`, `privateTenderId`, `organisationId`, `briefingSnapshot`, `pricingVersion`, `briefingPriceCents=34900`)  
4. Payment via existing PayFast  
5. Founder assigns Youth Agent (recommendations explainable, not auto-assign)  
6. Agent submits audio + attendance proof (+ integrity metadata)  
7. Transcription → AI draft (v2 sections when flag on)  
8. Founder review / approve / regenerate / reject  
9. SME receives approved report only  
10. Optional Founder-approved clarification/addendum as a **separate** record  

---

## Data model extensions (additive)

### Private tender / submission

- `briefingRequired`, `briefingCompulsory`
- `briefingType`: `physical` | `online` | `none`
- `briefingDate`, `briefingStartTime` / `briefingTime`, `briefingEndTime`
- `briefingVenue`, `briefingAddress`, `briefingProvince`, `briefingMunicipality`
- `briefingInstructions`, `briefingContactDetails`, `briefingRegistrationDeadline`

### Attendance request (immutable at booking)

- `source`: `private_tender` | `public_tender` | `other`
- `privateTenderId`, `privateSubmissionId`, `organisationId`
- `tenderNumber`, `tenderTitle`
- `briefingSnapshot` (full briefing field copy + `snapshotAt`)
- `pricingVersion`, `briefingPriceCents` / `paymentAmount` / `quotedFee` = **34900**

### Evidence (`evidenceIntegrity` on BI report)

- `submittedAt`, `briefingDate`, `uploadActorUid`, `sourceRequestId`
- optional `agentNote`, `attendanceContext`, file metadata  
- **No** continuous GPS, biometrics, or surveillance

### Follow-ups (`briefingFollowUpUpdates` — Admin SDK only)

- Links: `privateTenderId`, `briefingRequestId`, `organisationId`, `smeId`
- `updateType`, `title`, `content`, `attachments`
- `reviewStatus`: pending_review → approved | rejected  
- **Never** mutates the original approved report

---

## Security model

- Fail-closed feature flags (server authoritative; `NEXT_PUBLIC_*` is UI-only)
- Founder APIs via `verifyFounderUser`
- SME history scoped to caller `uid` (admin may pass `smeId`)
- Follow-ups: deny-all client Firestore rules; Admin SDK routes only
- Cross-org ownership retained on follow-up records; review patches do not rewrite org/SME ownership
- Server-owned payment / approval / ownership fields
- Durable audit events for material lifecycle actions (fail-soft writes)
- No secrets in repo; no production flag enablement in this PR

---

## Feature flags (fail-closed; **do not enable in production during this PR**)

| Flag | Purpose |
| --- | --- |
| `PRIVATE_TENDER_BRIEFING_BOOKING_ENABLED` | Physical private-tender booking gate + snapshot enforcement path |
| `NEXT_PUBLIC_PRIVATE_TENDER_BRIEFING_BOOKING_ENABLED` | UI CTA “Appoint a Youth Agent — R349” |
| `BRIEFING_INTELLIGENCE_V2_ENABLED` | AI v2 section schema + prompt guidance |
| `BRIEFING_FOLLOW_UP_UPDATES_ENABLED` | Clarifications/addenda collection + Founder/SME APIs |
| `NEXT_PUBLIC_BRIEFING_FOLLOW_UP_UPDATES_ENABLED` | Optional UI gating for follow-ups |

CJS mirror: `backend/constants/briefingOpsFlags.js`  
TS: `lib/privateTenders/briefingOpsFlags.ts`

---

## Pricing behaviour (immutable)

| Item | Amount |
| --- | --- |
| SME booking | R349.00 / **34900** cents |
| Youth Agent payout | R200.00 / **20000** cents |
| Gross contribution (before other costs) | R149.00 |
| Historical R249 bookings | Remain historically correct |
| Pricing versions | Immutable on stamped requests |
| PayFast / YA banking / monthly manual EFT | **Unchanged** — no redesign |

---

## Notification events

Reuse existing architecture (founder ops notify, product events, TX email). Meaningful Phase 3 events include:

| Audience | Events |
| --- | --- |
| SME | Booking/payment confirmation (existing), report ready (existing), approved clarification via history |
| Youth Agent | Assignment / reminders / submission requirements (existing workflows) |
| Founder | Paid awaiting assignment, evidence submitted, report awaiting review, follow-up pending review |

Avoid spam; prefer operationally meaningful hooks already in the attendance + BI pipeline.

---

## AI report v2 schema

When `BRIEFING_INTELLIGENCE_V2_ENABLED`:

- `tenderInformation`
- `briefingSpecificInformation`
- `amendmentsOrChanges` (`tenderRequirement`, `briefingChange`, `bidderImplication`)
- `questionsAndAnswers`
- `submissionImplications`
- `keyDates`
- `mandatoryActions`
- `commercialOrTechnicalClarifications`
- `risksOrUncertainties`
- `clarityNotes`

Rules: never fabricate; official metadata authoritative for tender number / closing date; unclear transcript → explicit uncertainty notes. Founder approval remains the final gate before SME delivery.

---

## Follow-up clarification architecture

1. Founder creates update (`POST /api/founder/briefing-follow-ups`)  
2. Pending review until Founder approves/rejects (`POST .../[id]/review`)  
3. Approved updates listed for SME (`GET /api/sme/briefing-history`) and shown on request detail as **Subsequent updates**  
4. Original approved report preserved untouched  

---

## APIs (new / extended)

| Route | Role |
| --- | --- |
| `POST /api/attendance-requests` | Stamps private booking snapshot; physical gate when booking flag on |
| `GET /api/founder/attendance-requests/[id]/recommendations` | Explainable YA recommendations |
| `GET/POST /api/founder/briefing-follow-ups` | List/create clarifications |
| `POST /api/founder/briefing-follow-ups/[id]/review` | Approve/reject |
| `GET /api/sme/briefing-history` | SME briefing-service history + approved follow-ups |
| Founder dashboard KPIs | Additive pipeline counts (paid unassigned, evidence outstanding, …) |

---

## Non-goals (hard stop)

Supplier tender submissions, bid response creation, evaluation panels, scoring, awards, supplier marketplace, RFQ marketplace, POs, contract management, ERP, invoice management, escrow, banking APIs, automatic YA payout, autonomous AI assignment/decisions.

---

## Rollout (post-merge, Founder-controlled)

1. Merge on green CI  
2. Deploy app + Firestore rules + indexes  
3. Enable flags deliberately: booking → ops/recommendations → AI v2 → follow-ups  
4. Production smoke (stop before real PayFast unless authorised)  
5. Separate production certification  

## Rollback

1. Disable Phase 3 flags (fail-closed restores prior UX/API behaviour)  
2. Keep Phase 1 guest submit + Phase 2 org workspace intact  
3. Do not blindly roll back Firestore data  
4. Application rollback to last certified Phase 2 revision if required (`tenderbriefing-00137-fbl` lineage)

---

## Tests

- Unit: `tests/unit/privateTenderPhase3.test.ts`  
- Lifecycle smoke (no real PayFast): `scripts/pr-phase3-lifecycle-smoke.js`  
- Existing Phase 1/2, pricing, and payout suites remain authoritative for regression
