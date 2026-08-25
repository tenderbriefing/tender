# R349 Platform-Wide Pricing Certification

**Date:** 2026-08-25  
**Branch:** `feat/platform-wide-r349-pricing`

---

## 1. Executive Verdict

**READY FOR FOUNDER APPROVAL TO MERGE**

Canonical current briefing price is **R349 / 34900**. Active customer-facing surfaces, docs, env examples, and QA scripts no longer present R249 as the current offer. Historical R249 fixtures/constants remain for financial truth and ITN compatibility.

---

## 2. Branch

`feat/platform-wide-r349-pricing`

## 3. Base SHA

`1b450d1947122a9082934657c7dd47bff4a9bc53` (`origin/master` at branch creation)

## 4. Final SHA

`72ec1724fc4782bf3ae0c701e72ba132a0ddece1`

## 5. PR

https://github.com/tenderbriefing/tender/pull/60

---

## 6. Authoritative Current Price

`BRIEFING_PRICE_CENTS = 34900` / **R349.00**  
Source: `lib/domain/briefingPricing.ts` + `backend/constants/briefingPricing.js`

## 7. YA Liability

`YOUTH_AGENT_PAYOUT_CENTS = 20000` / **R200.00**

## 8. Gross Margin

`GROSS_CONTRIBUTION_CENTS = 14900` / **R149.00**  
(`34900 - 20000`)

---

## 9. Customer-Facing Surfaces Updated

| Area | Change |
|------|--------|
| `app/layout.tsx` metadata | Fixed broken single-quoted `${BRIEFING_PRICE_LABEL}` → real **R349.00** interpolation |
| SEO landing / programmatic / SME banners | Fixed JSX that rendered literal `${BRIEFING_PRICE_LABEL}` |
| Payment cancelled page | Shows `{BRIEFING_PRICE_LABEL}` (no fake `.00` suffix) |
| Landing FAQ alias | Removed active `R249_FAQ` name → `BRIEFING_PRICE_FAQ` |
| Auth / resources / pricing pages | Already used `BRIEFING_PRICE_LABEL` / `ATTENDANCE_FEE_LABEL` (R349) |

---

## 10. PayFast Checkout

New checkouts continue to use `resolveRequestChargeCents` / `briefingPriceSnapshotFields` → **349.00** / **34900**. Production fee env overrides unset (code defaults apply).

## 11. Payment Validation

ITN validates against **request snapshot** (historical 24900 still accepted for old bookings; new bookings expect 34900). Covered by existing PayFast/paymentLifecycle tests.

## 12. Founder Finance

Revenue remains sum of stored payment amounts (not bookings × list price). Comments updated away from “× R249” wording.

## 13. Emails / Notifications

Transactional emails format **stored** cents. Current fixtures updated to R349 where representing new bookings; `formatMoneyCents(24900)` retained as historical format coverage.

## 14. SEO / Marketing

Active SEO/landing/copy uses `BRIEFING_PRICE_LABEL` (**R349.00**). Launch WhatsApp templates and PayFast setup docs updated to R349.

## 15. Historical R249 Compatibility

Retained:

- `LEGACY_BRIEFING_PRICE_CENTS = 24900`
- Historical ITN / reconciliation / founder dashboard fixtures at 24900
- Gross contribution for R249 revenue = **4900** (R49)

No Firestore mass rewrite.

## 16. Remaining R249 Search Results

| Occurrence | Class |
|------------|--------|
| `LEGACY_BRIEFING_PRICE_CENTS` | **ACCEPTABLE** |
| Historical unit/integration fixtures (`payfastItn*`, `founderDashboard`, `attendanceWorkflow`, payout gross) | **ACCEPTABLE** |
| Prior certification / acceptance HTML under `docs/reports`, `docs/acceptance`, `docs/archive` | **ACCEPTABLE** (historical records) |
| `_legacy/services/yocoService.js` comment | **ACCEPTABLE** (retired path) |
| Active UI / checkout defaults / env.example / runbooks / constitution fee | **Cleared** (now R349) |

## 17. Tests

| Gate | Result |
|------|--------|
| typecheck | PASS |
| lint | PASS (existing hooks warning) |
| unit (`tests/unit`) | PASS 308/308 |
| BI unit + PayFast signature/ITN | PASS |
| Firestore IDOR emulator | PASS 46/46 |
| production build | PASS |

## 18. Security / Regression

- No payment validation weakened
- Banking/manual-EFT tests green
- No secrets changed

## 19. Deployment Recommendation

Merge via controlled process, then Deploy TenderBriefing. Post-deploy spot-check homepage meta + pricing page + PayFast checkout amount **349.00**. Do **not** complete a fake payment solely for this migration.

## 20. Remaining Blockers

None for merge readiness. Production deploy and optional unpaid smoke checkout verification remain post-merge Founder actions.
