# Canonical commercial pricing (current)

| Item | Value |
|------|--------|
| SME attendance fee | **R750.00** (`75000` cents) |
| Youth Agent payout | **R200.00** (`20000` cents) |
| Gross contribution | **R550.00** |
| Pricing version | `2026-10-v750` |
| Source of truth | `lib/domain/briefingPricing.ts` + `backend/constants/briefingPricing.js` |

Optional server override: `ATTENDANCE_FEE_CENTS` (Cloud Run). Public label: `NEXT_PUBLIC_ATTENDANCE_FEE_*`.

**Historical note:** Certification reports under `docs/reports/` that mention R349 describe earlier commercial epochs. Do not treat them as current price authority. Paid historical bookings keep their stored snapshots; unpaid checkouts always charge the current canonical cents.
