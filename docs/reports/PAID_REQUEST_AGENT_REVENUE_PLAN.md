# Paid Request Agent revenue flow — implementation plan

**Baseline:** master `afd3e06` / Cloud Run `tenderbriefing-00185-z6j` (search certified).  
**Commercial constants:** SME **R349** / YA payout **R200** / contribution **R149** (`lib/domain/briefingPricing.ts`).

## Audit verdict

The PayFast money path is already production-certified (PR #105 / revenue-boundary):

- Server-only create of `attendanceRequests`
- Canonical charge `BRIEFING_PRICE_CENTS = 34900`
- ITN / reconcile marks `paid`; browser confirm is read-only
- Founder ops + SME Resend confirmation on authoritative pay
- YA accept gated on paid

Gaps closed in this change set:

1. Soft IDOR — YA `notifiedAgents` read only when `paymentStatus` is `paid` or `not_required`
2. Behavioural `payment_confirmed` + `booking_confirmed` from `markRequestPaid` (observational only; fail-soft)
3. Payment-success UX — poll server; do not claim confirmed until `paymentStatus=paid`
4. Request-agent conversion copy — R349 CTA; no attendance promise before payment/accept
5. Retry CTA — Try Payment Again on abandoned checkout
6. Regression tests (ITN funnel emit idempotency, Firestore IDOR, UX contracts)

## Canonical commercial journey

```
Search → Tender detail → Request Agent → Checkout (PayFast)
  → PAYMENT_PENDING → (ITN) PAYMENT_CONFIRMED
  → BOOKING eligible for YA accept (AGENT_ALLOCATION via marketplace)
  → ATTENDANCE / report lifecycle (existing)
```

Persisted enums remain `paymentLifecycle` + `attendanceLifecycle` (no migration).

## Out of scope

- Second payment provider
- Auto-assign (`AUTONOMOUS_AUTO_ASSIGN`) product flip
- Real live charge in CI (Founder performs controlled settle if needed)
- Tender-search redesign
