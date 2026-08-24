# Commercial Pricing & Youth Agent Payout Engine — Certification Report

**Date:** 2026-08-24  
**Programme:** SME R349 / YA R200 / Gross R149 commercial model + payout ledger  
**Status:** Ready for Founder approval to merge — **NOT merged, NOT deployed**

**Verdict:** READY FOR FOUNDER APPROVAL TO MERGE (production smoke still required after deploy)

The production payment path, price snapshots, PayFast charge authority, Youth Agent payout ledger, Founder finance UI, agent earnings view, Firestore rules, and automated tests are implemented and passing locally. Historical R249 transactions are preserved.

**Conditions before merge/deploy:**

1. Deploy Firestore rules + composite indexes for `youthAgentPayouts`.
2. Run `npm run test:firestore-rules-emulator` in CI/staging (not executed in this certification run).
3. Complete production smoke: new booking → PayFast R349 ITN → evidence submit → eligible R200 payout → Founder mark paid.
4. Bulk-update remaining SEO/marketing copy still referencing R249 (see audit §6).
5. Optional: migrate Founder **Agents** directory earnings from legacy 35% commission display to payout-ledger truth.

---

## 2. Branch

`feat/commercial-pricing-ya-payout-engine`

---

## 3. Starting SHA

`7fdb4b0c7115f35125557703b19d4188d2034c06`

---

## 4. Final SHA

`7fdb4b0c7115f35125557703b19d4188d2034c06` (uncommitted working tree — 29 files touched)

---

## 5. Files Changed

### New

| Path | Purpose |
|------|---------|
| `lib/domain/briefingPricing.ts` | Canonical pricing constants (TS) |
| `backend/constants/briefingPricing.js` | Canonical pricing constants (JS/backend) |
| `lib/finance/youthAgentPayoutTypes.ts` | Payout types + state machine |
| `backend/services/finance/youthAgentPayoutService.js` | Payout ledger, eligibility, idempotency |
| `backend/services/founderFinanceService.js` | Founder finance KPI aggregation |
| `app/api/founder/finance/route.ts` | Founder finance API |
| `app/api/founder/payouts/[payoutId]/route.ts` | Hold / release / mark paid |
| `app/founder/finance/page.tsx` | Founder Finance + payout management UI |
| `tests/unit/briefingPricing.test.ts` | Pricing unit tests |
| `tests/unit/youthAgentPayout.test.ts` | Payout unit tests |

### Modified (core)

| Path | Change |
|------|--------|
| `lib/domain/paymentLifecycle.ts` | Re-exports pricing from `briefingPricing.ts` |
| `lib/payments/attendanceFee.ts` | R349 label + formatting |
| `backend/services/payments/attendancePaymentService.js` | R349 checkout, snapshots, historical charge preservation |
| `app/api/briefing-intelligence/evidence/route.ts` | Payout eligibility hook post-evidence |
| `firestore.rules` | `youthAgentPayouts` read/write rules |
| `firestore.indexes.json` | Composite indexes for payout queries |
| `app/agent/workspace/earnings/page.tsx` | YA payout rows |
| `backend/services/mobile/mobileFieldService.js` | R200 dispatch payout display |
| `components/founder/FounderShell.tsx` | Finance nav item |

---

## 6. R249 Reference Audit

| Location | Action | Notes |
|----------|--------|-------|
| `lib/domain/briefingPricing.ts` | **Retained** | `LEGACY_BRIEFING_PRICE_CENTS = 24900` for historical truth |
| `backend/constants/briefingPricing.js` | **Retained** | Same legacy constant |
| `lib/domain/paymentLifecycle.ts` | **Changed** | Canonical fee now 34900 via re-export |
| `backend/services/payments/attendancePaymentService.js` | **Changed** | New bookings R349; ITN validates request snapshot |
| `lib/payments/attendanceFee.ts` | **Changed** | Display R349.00 |
| `app/pricing/page.tsx` | **Changed** | Dynamic metadata via `ATTENDANCE_FEE_LABEL` |
| `lib/seo/landingContent/shared.ts` | **Changed** | FAQ uses R349; `R249_FAQ` alias kept |
| `lib/emails/fixtures.js` | **Changed** | Demo fixture R349 |
| Agent mobile/dispatch UI | **Changed** | Shows R200 payout, not SME charge |
| `tests/unit/paymentLifecycle.test.ts` | **Changed** | R349 default + R249 historical ITN match |
| `tests/integration/attendanceWorkflow.test.ts` | **Changed** | New booking 34900 + legacy R249 preservation test |
| `tests/unit/founderDashboard.test.ts` | **Retained** | Uses R249 fixtures to prove revenue ≠ bookings×price |
| `tests/unit/payfastItnReconciliation.test.ts` | **Retained** | Historical R249 ITN reconciliation |
| `docs/acceptance/payfast-live-r249-*` | **Retained** | Historical certification |
| `docs/reports/PAYFAST_CSP_*` | **Retained** | Historical |
| `lib/seo/landingContent/*.ts` (body copy) | **Partial** | FAQ updated via shared; inline R249 strings remain |
| `lib/seo/resources.ts` | **Not changed** | Still R249 marketing copy — update pre-launch |
| `app/layout.tsx` metadata | **Not changed** | Still R249 — update pre-launch |
| `components/auth/AuthShell.tsx` | **Not changed** | Still R249 |
| `backend/services/founderDashboardService.js` | **Retained comment** | Revenue logic unchanged (uses stored amounts) |
| `backend/services/commandCenterService.js` | **Not changed** | Still defaults missing amounts to 24900 — pre-existing |
| `scripts/payfast-readiness-check.js` | **Not changed** | Still expects 24900 — update before deploy QA |

---

## 7. New Pricing Architecture

```
lib/domain/briefingPricing.ts          (TS authority)
backend/constants/briefingPricing.js   (JS authority)
         ↓
paymentLifecycle / attendanceFee / attendancePaymentService
         ↓
attendanceRequests.{briefingPriceCents, paymentAmount, quotedFee, pricingVersion, currency}
         ↓
PayFast checkout (amountCents from resolveRequestChargeCents)
         ↓
ITN validation (expected cents = request snapshot, not today's price)
```

**Commercial invariants (new bookings):**

| Field | Cents | ZAR |
|-------|-------|-----|
| SME charge | 34900 | R349.00 |
| YA payout | 20000 | R200.00 |
| Gross contribution | 14900 | R149.00 |

Env overrides (optional): `ATTENDANCE_FEE_CENTS`, `YOUTH_AGENT_PAYOUT_CENTS`, `NEXT_PUBLIC_ATTENDANCE_FEE_LABEL`.

---

## 8. Payout Architecture

```
Evidence POST (attendance + audio)
  → briefingIntelligenceReports (unchanged BI pipeline)
  → youthAgentPayoutService.ensurePayoutOnEvidenceSubmitted()
       → Firestore transaction on youthAgentPayouts/ya-payout-{requestId}
       → status: eligible (if evidence valid)
  → Whisper / AI / Founder approval (parallel — NOT required for eligibility)
```

**State machine:** `pending` → `eligible` → `held` | `paid` | `cancelled`

Founder actions via `PATCH /api/founder/payouts/[payoutId]`:
- `hold`, `release`, `mark_paid` (requires `paymentReference`)

---

## 9. Firestore Collections / Schema

### `youthAgentPayouts/{payoutId}`

Document ID: `ya-payout-{requestId}` (deterministic)

Minimum fields: `payoutId`, `assignmentId`, `requestId`, `tenderId`, `youthAgentUid`, `currency`, `briefingRevenueCents`, `payoutAmountCents`, `grossContributionCents`, `status`, `eligibilityStatus`, `eligibilityReason`, `attendanceVerified`, `evidenceSubmitted`, `reportId`, `completedAt`, `eligibleAt`, `paidAt`, `paidBy`, `paymentReference`, `paymentMethod`, `holdReason`, `pricingVersion`, `payoutVersion`, `createdAt`, `updatedAt`.

### `attendanceRequests` (extended)

New optional fields: `briefingPriceCents`, `pricingVersion` (alongside existing `paymentAmount`, `quotedFee`).

---

## 10. Security Controls

| Control | Implementation |
|---------|----------------|
| Client cannot set PayFast amount | Checkout uses server `resolveRequestChargeCents` |
| Client cannot write payouts | Firestore `allow write: if false` on `youthAgentPayouts` |
| YA read own payouts only | Rules: `youthAgentUid == request.auth.uid` |
| SME no payout access | Denied by rules |
| Founder payout mutations | Server API + `verifyFounderUser` only |
| Audit trail | `auditLogService.logEvent` on create/hold/paid |
| IDOR tests | Added to `tests/firestore/rules.idor.test.ts` |

---

## 11. Idempotency Strategy

- **Payout ID:** `ya-payout-{requestId}` — one liability per assignment/request.
- **Creation:** Firestore transaction — if doc exists, update evidence flags or return existing; never second liability.
- **Mark paid:** Transaction rejects double-pay (`alreadyPaid: true`).
- **Evidence retries:** Safe — merges evidence metadata without duplicate cents.

---

## 12. Founder Dashboard Changes

- New nav: **Finance** → `/founder/finance`
- KPIs: Booking Revenue, Agent Payouts Due, Agent Payouts Paid, Gross Contribution
- Payout table with filters (status dropdown)
- Actions: Hold, Release, Mark paid (with payment reference prompt)

---

## 13. Youth Agent Earnings Changes

- `getAgentEarnings` → reads `youthAgentPayouts` via `youthAgentPayoutService`
- Workspace earnings page shows payout rows (R200) + summary
- Mobile dispatch shows **R200.00 payout** (not SME R349)

---

## 14. PayFast Changes

- Checkout `amountCents` = request snapshot (34900 for new bookings)
- ITN validation uses `resolveRequestChargeCents(request)` — accepts historical 24900
- Signature / ITN verification logic **not weakened**

---

## 15. Historical Transaction Treatment

- Existing paid R249 records: **unchanged**
- `markRequestPaid` preserves `briefingPriceCents` / `quotedFee` / `paymentAmount` from request at payment time
- Founder revenue sums **actual stored amounts** — never `bookings × R349`
- Legacy gross contribution on old bookings: R249 − R200 = R49 (stored per payout record)

---

## 16. Tests Added

| Test file | Coverage |
|-----------|----------|
| `tests/unit/briefingPricing.test.ts` | R349/R200/R149 invariants, legacy R249, snapshots |
| `tests/unit/youthAgentPayout.test.ts` | Eligibility, idempotency, state machine, historical revenue |
| `tests/integration/attendanceWorkflow.test.ts` | New booking 34900, legacy R249 preservation |
| `tests/firestore/rules.idor.test.ts` | Payout IDOR + write denial |

---

## 17. Test Results

| Suite | Result |
|-------|--------|
| `npm run typecheck` | **PASS** |
| `npm run lint` | **PASS** (1 pre-existing hook warning) |
| `npm run test` | **PASS** — 369/369 tests |
| `npm run build` | **PASS** |
| `npm run qa:secrets-scan` | **PASS** |
| Firestore rules emulator | **NOT RUN** (requires emulator) |
| Playwright e2e | **NOT RUN** |

---

## 18. Required Indexes / Rules

Deploy together:

```bash
firebase deploy --only firestore:rules,firestore:indexes
```

New indexes on `youthAgentPayouts`:
- `status` + `createdAt` DESC
- `youthAgentUid` + `createdAt` DESC

---

## 19. Required Environment / Config

| Variable | Default | Purpose |
|----------|---------|---------|
| `ATTENDANCE_FEE_CENTS` | `34900` | Override SME price (staging) |
| `YOUTH_AGENT_PAYOUT_CENTS` | `20000` | Override YA payout |
| `NEXT_PUBLIC_ATTENDANCE_FEE_LABEL` | `R349.00` | Display label |

No new secrets required.

---

## 20. Migration Requirements

**No backfill required for launch.**

- New payouts created on evidence submission going forward.
- Optional bounded backfill script for pre-existing completed briefings with evidence — **not included**; run only after Founder approval with idempotent `ensurePayoutOnEvidenceSubmitted`.

---

## 21. Rollback Procedure

1. Revert merge / redeploy previous Cloud Run revision.
2. Revert Firestore rules if payout collection rules cause issues (payout reads fail closed for clients).
3. Pricing env: set `ATTENDANCE_FEE_CENTS=24900` for emergency rollback (new bookings only).
4. Payout records are append-only — do not delete; mark `cancelled` if needed.

---

## 22. Remaining Blockers

1. Production smoke not executed on this branch.
2. SEO/marketing pages partially still say R249 (non-payment paths).
3. `scripts/payfast-readiness-check.js` still asserts 24900.
4. Founder **Agents** tab still shows legacy 35% commission earnings estimate.
5. Firestore rules emulator suite not re-run here.

---

## 23. Production Smoke-Test Procedure

1. Create new attendance request → confirm Firestore `briefingPriceCents: 34900`, `pricingVersion: 2026-08-v349`.
2. PayFast checkout shows R349.00; complete payment; ITN marks paid with 34900 preserved.
3. Assign YA; submit attendance + audio evidence.
4. Confirm `youthAgentPayouts/ya-payout-{requestId}` with `status: eligible`, `payoutAmountCents: 20000`.
5. Simulate Whisper failure — payout remains eligible.
6. Founder → Finance → Mark paid with reference → `status: paid`, audit log entry.
7. YA → Earnings → sees R200 row.
8. Verify historical R249 paid request still shows 24900 in revenue totals.

---

## 24. Recommendation

**PASS WITH CONDITIONS** — merge after Founder review, Firestore deploy, marketing copy sweep, and production smoke per §23.

---

*Generated for Founder review. Do not deploy without explicit approval.*
