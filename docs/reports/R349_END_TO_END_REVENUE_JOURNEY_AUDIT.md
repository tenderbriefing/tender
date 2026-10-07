# R349 end-to-end revenue journey — audit

**Baseline:** master `604c627` / Cloud Run `tenderbriefing-00187-59q`.

## Architecture (reuse — do not replace)

| Authority | Source |
|-----------|--------|
| SME price R349 | `BRIEFING_PRICE_CENTS = 34900` (`lib/domain/briefingPricing.ts` / backend twin) |
| YA payout R200 | `20000` cents in payout engine / briefingPricing |
| Payment state | Firestore `attendanceRequests.paymentStatus` via `markRequestPaid` only |
| Payment verification | PayFast ITN signature + server validate + amount ±1¢ |
| Booking confirmation | Same `markRequestPaid` → `request_paid` workflow |
| Notifications | Resend transactional + Founder ops (idempotent) |
| Analytics | Observational `productEvents` only |

## Journey (already wired)

Search → tender detail → `/request-agent` → POST `/api/attendance-requests` → PayFast checkout → ITN → `markRequestPaid` → SME email + Founder notify → YA marketplace (`paid` gate).

Browser `/payment-success` and `/api/payments/payfast/confirm` are **not** payment authority.

## Gaps closed in this change set

1. Auth return preservation after PayFast / My Requests session drop
2. Role-selection preserves purchase `redirect`
3. Soft IDOR: Admin-SDK / API `notifiedAgents` requires `paid` \| `not_required` (mirror Firestore rules)
4. List/detail CTA fee consistency + encoded guest redirect
5. Regression tests for the above

## Out of scope

- Live PayFast settle in CI (Founder controlled settle for full commercial PASS)
- Auto-assign / marketplace redesign
- Second payment provider
