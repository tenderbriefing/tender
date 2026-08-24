# Monthly Youth Agent EFT Payouts — Engineering Certification

**Branch:** `feat/monthly-ya-eft-payouts`  
**Base SHA:** `40dc19b9776bfb2ce1858f5018b3f551d48247ab` (PR #56 merge)  
**Date:** 2026-08-24  
**Scope:** Monthly EFT settlement batches on top of job-level R200 liabilities

---

## Executive Verdict

**READY FOR FOUNDER APPROVAL TO MERGE**

Job-level `youthAgentPayouts` liabilities are preserved. Monthly `youthAgentPayoutBatches` group eligible jobs per agent per calendar month. Founder generates batches, performs external EFT, and records payment reference — all jobs in the batch settle atomically. R349 / R200 / R149 commercial model unchanged.

**Not deployed.** Pending Founder PR review.

---

## Architecture

### Job-level (`youthAgentPayouts`)

- One R200 liability per request (`ya-payout-{requestId}`)
- Statuses: `pending` → `eligible` → `batched` → `settled` (or `held`, `cancelled`)
- Legacy `paid` treated as `settled` in summaries
- Eligibility still driven by evidence submission only

### Monthly batch (`youthAgentPayoutBatches`)

- Deterministic ID: `ya-batch-{youthAgentUid}-{YYYY-MM}`
- Statuses: `ready` → `paid`
- Links `payoutIds[]` / `requestIds[]`
- `paymentMethod: EFT`

### Inclusion rule

A job belongs to the calendar month containing its **`eligibleAt`** timestamp (UTC). Documented in `lib/finance/youthAgentPayoutBatchTypes.ts`.

### Hold release

If the agent's batch for the original `eligibleAt` month is already **paid**, `eligibleAt` rolls forward to release time so earnings are not lost.

---

## EFT workflow

1. Jobs accrue as `eligible` (R200 each)
2. Founder: **Generate Monthly Payouts** for `YYYY-MM`
3. Jobs → `batched`, batch → `ready`
4. Founder performs external EFT
5. Founder: **Record EFT** with payment reference
6. Batch → `paid`, all linked jobs → `settled` (single transaction)

No banking integration in this release.

---

## Idempotency

| Operation | Protection |
|-----------|------------|
| Generate monthly batch | Deterministic batch ID; existing batch returned |
| Mark batch paid | Transaction; `alreadyPaid: true` on retry |
| Job in two batches | `settlementBatchId` set at batch creation |
| Legacy per-job mark paid | Blocked when status is `batched` |

---

## Founder Finance KPIs

- Booking Revenue
- YA Earnings Accrued (eligible, not batched)
- Outstanding YA Liability (accrued + batched awaiting EFT)
- YA Payouts Settled
- Gross Contribution (revenue − YA share; **not profit**)

---

## Updated production smoke (§15)

Production certification **no longer** requires Founder to mark individual R200 jobs paid.

Certify instead:

1. Real R349 PayFast payment + ITN
2. YA evidence → R200 job `eligible`
3. BI pipeline + Founder report approval + SME delivery
4. Founder Finance shows R349 / R200 / R149 with R200 **outstanding** (monthly EFT)
5. Monthly EFT settlement tested separately with controlled batch data

Do **not** mark R200 job paid merely for certification.

---

## Migration / deployment

1. Deploy application + Firestore rules + indexes
2. No backfill of historical monthly batches
3. Existing `paid` job records remain valid (legacy per-job settlement)
4. New jobs follow monthly batch path

---

## Rollback

Revert to PR #56 behaviour: individual `mark_paid` on jobs (legacy path still available for pre-batch records).

---

## Remaining blockers

- Founder PR approval
- Production deploy + rules/index deploy
- Pending R349 production smoke (`req-1787605208259-42bhi4`) unaffected by this branch
