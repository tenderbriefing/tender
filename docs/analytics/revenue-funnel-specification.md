# TenderBriefing Revenue Funnel — Measurement Specification

**Status:** Phase B engineering contract (Phase C instrumentation implements this document)  
**P0 certified SHA:** `dc2771db7088bf7d48299b05157d78565a6dcea7`  
**P0 freeze docs merge (PR #107):** `113693fbe1f002ca9f7839298c17e26881d97b41`  
**Instrumentation version:** `2026-10-p1-funnel-v1`  
**Instrumentation effective (SAST):** `2026-10-06` (Africa/Johannesburg)  

This document is the **only** authoritative definition of Founder commercial funnel metrics.  
Dashboards must cite these stage IDs. If a metric cannot be defended, label the limitation — do not invent precision.

---

## 0. Non-negotiables

1. **Financial authority = Firestore payment state only**  
   `attendanceRequests.paymentStatus === "paid"` set by trusted server (PayFast ITN / authorised reconcile).  
   No client event, GA4 event, or `productEvents` row may substitute for payment success.

2. **Do not add analytics-only fields to `attendanceRequests`.**  
   `checkoutStartedAt` is **not approved**. Checkout evidence lives in `productEvents`.

3. **Do not change** pricing, PayFast, ITN, exemptions, Firestore payment rules, or historical payment amounts for measurement.

4. **Revenue amounts** use Founder Finance / Founder V2 precedence (see §2). Never `paidCount × current R349`. Never `commissionService` list-price fallback.

5. **Timezone for Founder commercial day boundaries:** `Africa/Johannesburg` (SAST, UTC+2, no DST).

6. **Pre-booking funnel** (DISCOVERY → BOOKING_INTENT) is **PROSPECTIVE SINCE INSTRUMENTATION** only.  
   Do not imply historical full-funnel completeness before `2026-10-p1-funnel-v1`.

---

## 1. Instrumentation version

| Field | Value |
|-------|--------|
| `instrumentationVersion` | `2026-10-p1-funnel-v1` |
| Effective date (SAST calendar) | `2026-10-06` |
| Storage | Stamped on new `productEvents` documents written by Phase C paths |

**UNIQUE TENDER VIEW** = one counted `tender_opened` per (`sessionId` + `tenderId`) within a browser session (client sessionStorage dedupe).  
**UNIQUE BOOKING INTENT** = one counted `booking_intent` per (`sessionId` + `tenderId`) within a browser session.

Server events (`booking_created`, `checkout_started`) are emitted on each successful API completion.  
PayFast checkout **retries** may create multiple `checkout_started` rows for one `requestId`.

| KPI intent | Aggregation |
|------------|-------------|
| **CHECKOUT ATTEMPTS** | Raw count of `checkout_started` events (behavioural) |
| **UNIQUE BOOKINGS REACHING CHECKOUT** | `COUNT DISTINCT metadata.requestId` (fallback `targetEntityId`) |

Phase D **must** use unique `requestId` for funnel conversion denominators that mean “bookings reaching checkout”.  
Implementation helper: `lib/analytics/checkoutFunnelAggregation.ts`.  
Do **not** let retries inflate conversion rates.

---

## 2. Financial truth rules

### 2.1 Paid booking

A booking is **paid** iff:

```
attendanceRequests.paymentStatus === "paid"
```

`not_required` is **not revenue**. It is dispatchable fulfilment only.

### 2.2 Trusted amount (cents)

For a paid row, trusted amount = first positive finite of:

1. `paymentAmount`
2. `briefingPriceCents`
3. `quotedFee`

If none → **PAID — AMOUNT UNRESOLVED** (count the booking; **add R0 to revenue**; surface data-quality exception).  
Do **not** substitute current R349 / prior list prices.

### 2.2.1 Revenue-field trust audit (measurement certification)

| Field | Who writes (current) | When written | Client influence (current) | Snapshot? | Post-pay mutate (current) | Weaker historical epochs |
|-------|----------------------|--------------|----------------------------|-----------|---------------------------|---------------------------|
| `paymentAmount` | Admin SDK only (`markRequestPaid`, create/checkout snapshots via `briefingPriceSnapshotFields`) | Create defaults; re-stamp on checkout; **restamped to charged cents on ITN paid** | **Blocked** — `create: if false`; privileged keys denylist on client update | Intended transaction stamp; on paid = ITN-path charge | Client cannot; Admin SDK could | Pre-`create: if false` / weaker rules: clients could forge create amounts. Prefer this field when present on **paid** rows because ITN `markRequestPaid` overwrites with `resolveRequestChargeCents` result. |
| `briefingPriceCents` | Same Admin SDK paths | Same | **Blocked** currently | Quote/snapshot at create/checkout; restamped on paid | Client cannot currently | Same historical forge risk if never restamped by ITN |
| `quotedFee` | Same Admin SDK paths | Same | **Blocked** currently | Legacy/display alias; restamped on paid | Client cannot currently | Same historical forge risk |

**Safe reporting posture:**

- **Current-epoch paid** (ITN/`markRequestPaid` after P0): all three fields are typically equal to charged cents → high confidence.
- **Historical paid with any positive amount in the precedence chain:** use stored amount for revenue (do not rewrite). Residual risk remains if a pre-P0 paid row never received ITN restamp and retained a client-era forged fee — treat as **best-effort historical snapshot**, not invent R349.
- **Historical paid with no positive amount:** **PAID — AMOUNT UNRESOLVED** — count booking, revenue += 0.
- Never use `commissionService` list-price fallback for Founder revenue.

### 2.3 Classes

| Class | Rule |
|-------|------|
| PAID + TRUSTED AMOUNT | `paymentStatus === paid` and amount resolved via §2.2 |
| PAID — AMOUNT UNRESOLVED | `paymentStatus === paid` and amount unresolved |
| UNPAID | any other paymentStatus (`pending`, `failed`, `cancelled`, `not_required`, …) |

### 2.4 Current list price

Canonical **current** booking price: **R349 / 34900 cents** (`pricingVersion` `2026-08-v349`).  
Used only for new quotes / display — **never** to rewrite or impute historical revenue.

### 2.5 Test scope

Commercial Founder KPIs default to **Real SMEs** (`accountScope=real`): exclude `isTestData` / effective test accounts. Same as Founder V2 / Finance.

### 2.6 Prospective pre-booking metrics (Phase D UI contract)

For DISCOVERY / TENDER_DETAIL / BOOKING_INTENT:

- Label as **prospective since `2026-10-p1-funnel-v1` (SAST 2026-10-06)**.
- Periods entirely before that boundary: show **Unavailable / not instrumented** — **not** zero.
- Zero after the boundary means observed zero events, not missing instrumentation.
- Do not chart pre-instrumentation days as 0 demand.

### 2.7 REPORT_DELIVERED

Remains **PARTIALLY RECONSTRUCTIBLE**. Do not collapse legacy + BI into false precision in Phase D.

---

## 3. Report / fulfilment lifecycle (do not collapse)

Production has **two** report tracks. They are not identical.

### 3.1 BRIEFING_COMPLETED

| | |
|--|--|
| **Definition** | Compulsory briefing attendance workflow marked completed for the booking |
| **Authoritative source** | `attendanceRequests.status === "completed"` |
| **Timestamp** | `completedAt` if present, else `updatedAt` when status became completed |
| **NOT sufficient** | BI `evidence_uploaded` alone; GPS check-in alone |
| **Historical** | Reconstructible where status persisted |
| **Financial authority** | NO |

### 3.2 REPORT_PRODUCED

| | |
|--|--|
| **Definition** | A briefing report artifact exists for the booking (either track) |
| **Authoritative source (OR)** | (A) Legacy: `briefingReports` doc with `requestId`, **or** request `reportId` / `reportSubmittedAt`; (B) BI: `briefingIntelligenceReports` with status ≥ draft-ready / agent_review / awaiting_founder_review / finalized / delivered |
| **Timestamp** | Legacy: `briefingReports.createdAt` or `reportSubmittedAt`; BI: `draftReadyAt` or `createdAt` of report |
| **Historical** | Reconstructible when docs exist |
| **Financial authority** | NO |
| **Limitation** | Dual-track; a booking may have one, both, or neither |

### 3.3 REPORT_DELIVERED

| | |
|--|--|
| **Definition** | Report content has been delivered to the SME (email/PDF handoff), not merely drafted |
| **Authoritative source** | **Prefer BI:** `briefingIntelligenceReports.status === "delivered"` and/or `deliveredAt` set. **Legacy:** treat as delivered when legacy report submitted **and** ready-email path completed is **not** durably stamped — use `reportSubmittedAt` / legacy submit as **proxy only** |
| **`attendanceRequests.reportDeliveredAt`** | **Not authoritative** — not consistently written by deliver routes |
| **Classification** | **PARTIALLY RECONSTRUCTIBLE** |
| **Financial authority** | NO |

Founder Phase D must show REPORT_DELIVERED with an explicit **partial** badge until a single write-path stamps delivery on one canonical field (out of P1 Phase C scope; would require Founder approval if touching attendanceRequests).

---

## 4. Assignment semantics

| Concept | Production field | Notes |
|---------|------------------|-------|
| Agent identified / assigned | `assignedAgentId` or `agentId` set; often `status === "assigned"` | Admin may assign |
| Agent accepted | **`acceptedAt`** set (no `assignedAt` field exists) | Youth Agent accept path sets this |

**AGENT_ASSIGNED/ACCEPTED (funnel stage):** count when `assignedAgentId` (or `agentId`) is present **and** prefer `acceptedAt` as timestamp when present; else `lastTransitionAt` / `updatedAt`.  
Do not invent `assignedAt`. Do not rename domain statuses for cosmetic funnel labels.

---

## 5. Canonical funnel stages

### 5.1 DISCOVERY

| Attribute | Specification |
|-----------|----------------|
| Business definition | User encountered a **commercially meaningful** compulsory-briefing catalogue or hub listing (results present), not an empty shell or accidental nav flicker |
| Event name | `tender_listing_viewed` |
| Authoritative source | `productEvents` (prospective) |
| Timestamp | `productEvents.timestamp` |
| Identifiers | `sessionId`, optional `actorUserId`, `pagePath`, metadata `province` / `resultCount` when known |
| Historical | **Not reconstructible** before instrumentation |
| Prospective | YES since `2026-10-p1-funnel-v1` |
| Financial authority | **NO** |
| Deduplication | Once per (`sessionId` + `pagePath`) per browser session |
| Limitations | Public anonymous actors use `actorUserId: anonymous_funnel`; not a census of all CDN hits |

### 5.2 TENDER_DETAIL

| Attribute | Specification |
|-----------|----------------|
| Business definition | Individual tender opportunity detail page meaningfully opened |
| Event name | `tender_opened` |
| Authoritative source | `productEvents` |
| Timestamp | event timestamp |
| Identifiers | `tenderId` (metadata + `targetEntityId`), `sessionId`, optional uid |
| Historical | **Not reconstructible** before instrumentation |
| Prospective | YES |
| Financial authority | **NO** |
| Deduplication | **UNIQUE TENDER VIEW** = once per (`sessionId` + `tenderId`) |
| Limitations | Refresh inflation mitigated by session dedupe only |

### 5.3 BOOKING_INTENT

| Attribute | Specification |
|-----------|----------------|
| Business definition | Authenticated SME entered the Youth Agent booking journey UI for a specific tender (`/tenders/[id]/request-agent`), not a catalogue CTA impression |
| Event name | `booking_intent` |
| Authoritative source | `productEvents` |
| Timestamp | event timestamp |
| Identifiers | `tenderId`, `sme` uid, `sessionId` |
| Historical | **Not reconstructible** before instrumentation |
| Prospective | YES |
| Financial authority | **NO** |
| Deduplication | **UNIQUE BOOKING INTENT** = once per (`sessionId` + `tenderId`) |
| Limitations | Does not include `/sme/book-agent` browse-only without tender selected |

### 5.4 BOOKING_CREATED

| Attribute | Specification |
|-----------|----------------|
| Business definition | Server successfully created (or resumed unpaid) `attendanceRequests` row for SME+tender |
| State / event | **Authority:** Firestore `attendanceRequests`. Optional mirror event: `booking_created` in `productEvents` |
| Timestamp | **Authority:** `createdAt` on request |
| Identifiers | `requestId`, `smeId`, `tenderId` |
| Historical | **Reconstructible** from Firestore |
| Prospective | YES |
| Financial authority | **NO** (unpaid create is not revenue) |
| Deduplication | One active request per SME+tender (server); event mirror fail-soft |
| Limitations | Resume of existing unpaid request is still “intent progressed” — count unique `requestId` |

### 5.5 CHECKOUT_STARTED

| Attribute | Specification |
|-----------|----------------|
| Business definition | Trusted server successfully built/issued PayFast checkout payload for a request |
| Event name | `checkout_started` → **`productEvents` only** (not on attendanceRequests) |
| Authoritative source (behavioural) | `productEvents` where `eventName === checkout_started` |
| Timestamp | event timestamp |
| Identifiers | `requestId`, `tenderId`, `smeId` (actor) |
| Historical | **Partial** — may approximate via `payfastRedirectUrl` presence + `updatedAt`, but Phase C authority for KPIs is the event from effective date |
| Prospective | YES |
| Financial authority | **NO** |
| Deduplication | Prefer unique `requestId` in period aggregations; retries may emit again |
| Limitations | Create path usually auto-checkouts — BOOKING_CREATED and CHECKOUT_STARTED often near-simultaneous |

### 5.6 PAYMENT_SUCCESS

| Attribute | Specification |
|-----------|----------------|
| Business definition | Trusted payment entitlement granted |
| State | `attendanceRequests.paymentStatus === "paid"` |
| Timestamp | `paidAt` |
| Identifiers | `requestId`, `smeId`, `tenderId`, `payfastPaymentId`, trusted amount fields |
| Historical | **Reconstructible** |
| Prospective | YES |
| Financial authority | **YES** |
| Deduplication | Document id / request id |
| Limitations | Browser `/payment-success` confirm is **poll-only** — never mark paid. No client `payment_success` product event as authority |

### 5.7 AGENT_ASSIGNED/ACCEPTED

| Attribute | Specification |
|-----------|----------------|
| Business definition | Youth Agent (or admin) attached to a paid/dispatchable booking; acceptance time when available |
| State | `assignedAgentId` or `agentId` present |
| Timestamp | `acceptedAt` when set; else transition/updated |
| Identifiers | request id, agent id, sme id |
| Historical | Reconstructible |
| Prospective | YES |
| Financial authority | NO |
| Deduplication | By request id |
| Limitations | Admin assign vs agent accept both valid; no `assignedAt` field |

### 5.8 BRIEFING_COMPLETED

See §3.1.

### 5.9 REPORT_PRODUCED

See §3.2.

### 5.10 REPORT_DELIVERED

See §3.3 — **PARTIALLY RECONSTRUCTIBLE**.

### 5.11 REPEAT_BOOKING

| Attribute | Specification |
|-----------|----------------|
| Business definition | Paying SME with ≥2 PAID bookings (trusted paid state), ordered by `paidAt` |
| Source | Derived from `attendanceRequests` |
| Timestamp | Second (and later) `paidAt` |
| Identifiers | `smeId` |
| Historical | Reconstructible |
| Prospective | YES |
| Financial authority | Counts are financial-adjacent; revenue still from trusted amounts only |
| Deduplication | By smeId cohorts |
| Limitations | Requires stable `smeId`; test accounts excluded in commercial scope |

---

## 6. KPI mapping (Founder — Phase D contract preview)

| Founder question | Stage / rule |
|------------------|--------------|
| Catalogue demand | DISCOVERY (prospective) |
| Detail demand | TENDER_DETAIL unique views (prospective) |
| Booking journey starts | BOOKING_INTENT (prospective) |
| Bookings created | BOOKING_CREATED from Firestore |
| Checkout starts | CHECKOUT_STARTED unique requestIds (prospective event) |
| Paid bookings / revenue | PAYMENT_SUCCESS + §2 |
| Fulfilment | AGENT_* → BRIEFING_COMPLETED → REPORT_* |
| Retention | REPEAT_BOOKING |

Always separate **OBSERVED FACT** from **HYPOTHESIS** in UI copy.

---

## 7. Event taxonomy (Phase C allow-list additions)

| Event | Emitter | Auth |
|-------|---------|------|
| `tender_listing_viewed` | Catalogue / compulsory hub clients | Authed preferred; public funnel route allowed |
| `tender_opened` | Tender detail client | Public funnel route allowed |
| `booking_intent` | request-agent page (SME) | Authenticated |
| `booking_created` | Server after successful create | Server (actor = SME) |
| `checkout_started` | Server after successful PayFast checkout issue | Server (actor = SME) |
| `private_tender_briefing_booked` | Server (repaired ingest shape) | Server |

**Forbidden as financial authority:** any client `payment_success` / GA4 `purchase` used as ledger.

GA4 remains optional supplementary behavioural analytics — not accounting truth.

---

## 8. Privacy & security

- Metadata allow-list only; no cards, tokens, PayFast secrets, passwords, document bodies.
- Prefer internal ids (`tenderId`, `requestId`, `smeId`) over emails in events.
- Founder aggregation endpoints: fail-closed Founder auth. SME / Youth Agent / unauthenticated / cross-tenant IDOR → DENY.
- Retention: `productEvents` follow existing Founder User Intelligence privacy posture; new funnel events increase volume — no shadow CRM.

---

## 9. Performance

- Client: fire-and-forget; sessionStorage dedupe; no heavy new bundles.
- Server: fail-soft event writes; never block PayFast checkout or ITN on analytics failure.
- Do not scan unbounded collections for Phase C.

---

## 10. Known limitations (label in Founder UI later)

1. Pre-`2026-10-p1-funnel-v1` discovery/detail/intent history does not exist.  
2. REPORT_DELIVERED is partially reconstructible (dual track; `reportDeliveredAt` unreliable).  
3. checkout_started retries may duplicate without unique-requestId aggregation.  
4. BOOKING_CREATED ≈ CHECKOUT_STARTED on the primary create path.  
5. Missing trusted amounts must never be imputed.  
6. Public catalogue bots may still create some anonymous discovery/detail events (rate-limited).

---

## 11. Phase boundaries

| Phase | Scope |
|-------|--------|
| **B** | This specification |
| **C** | Minimal events, repairs, SAST day keys for Founder commercial charts, tests — **no dashboard UI** |
| **D** | Founder V2 funnel surfaces (requires separate Founder approval) |
| **E** | Certification against production |

**STOP after Phase C** until Founder approves Phase D.
