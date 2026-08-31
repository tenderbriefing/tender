# Commercial Pricing — TenderBriefing (canonical)

**Status:** Authoritative internal commercial reference  
**Code source of truth:** `lib/domain/briefingPricing.ts`  
**Backend mirror:** `backend/constants/briefingPricing.js`  
**Do not** introduce a second pricing source.

## Current product economics (sole active model)

| Item | Amount | Cents | Source |
| --- | --- | ---: | --- |
| SME attendance fee (per compulsory briefing) | **R349** | **34900** | `BRIEFING_PRICE_CENTS` |
| Youth Agent payout (per completed briefing) | **R200** | **20000** | `YOUTH_AGENT_PAYOUT_CENTS` |
| Gross contribution (before other operating costs) | **R149** | **14900** | `GROSS_CONTRIBUTION_CENTS` = fee − payout |

Rules:

1. **R349** is the only supported attendance price for **new** bookings.
2. **R200** is the fixed Youth Agent payout for successfully completed briefings.
3. **R149** must be derived as `BRIEFING_PRICE_CENTS - YOUTH_AGENT_PAYOUT_CENTS` — do not hard-code a parallel contribution figure in product logic.
4. Display labels (`BRIEFING_PRICE_LABEL`, short labels, emails, UI) must derive from the cents constants above.
5. PayFast checkout for new bookings must charge **349.00** ZAR.

## Historical production records

- Firestore / PayFast / invoice / audit rows that store a different `paymentAmount`, `quotedFee`, or `briefingPriceCents` are **immutable financial history**.
- Reconciliation and revenue reporting must use **persisted** amounts on those records (`resolveRequestChargeCents`).
- Never backfill, rewrite, or “correct” historical charged amounts to R349.

## Retired price

The former attendance price is permanently retired from the repository and product surface. CI enforces this via `tests/unit/retiredPricingGuard.test.ts`.

## Related

- Engineering Constitution → Payment standards
- `docs/PAYFAST_PAYMENTS_SETUP.md`
- Founder finance UI and YA payout ledger consume the same constants
