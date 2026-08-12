# PayFast hosted Apple Pay / Google Pay — Certification Report

**Date (UTC):** 2026-08-12  
**Scope:** Certify Apple Pay and Google Pay via **existing** R249 PayFast hosted checkout only  
**Executive Verdict:** **PASS WITH CONDITIONS**

## Summary

No TenderBriefing application code change is required. PayFast hosted checkout does **not** pin `payment_method`; dashboard-enabled methods (including wallets) are loaded by PayFast’s payment engine. Live production page includes Apple Pay and Google Pay **PRODUCTION** configuration. Card and Instant EFT remain available. CSP remains clean. ITN remains the sole paid entitlement path.

## Baseline (unchanged)

| Field | Value |
|-------|--------|
| Production revision | `tenderbriefing-00109-h6m` (100%) |
| Certified payment SHA | `7d2ee4506473d265b592cafaa50c6d11ccf37506` |
| Image digest | `sha256:b47efce78405107e8f03cc9461ab755f6f7fff9f3f5d767f91eb4185c7b21482` |
| Code change required | **NO** |
| Deployment required | **NO** |

## 1. Is a TenderBriefing code change necessary?

**NO.**

Evidence:

- `backend/services/integrations/payfastService.js` builds hosted checkout fields without forcing `payment_method` (field only present if caller sets it; attendance checkout does not).
- Live unpinned checkout → `302` → `payment.payfast.io` with amount `249.00`.
- PayFast engine HTML includes wallet config when methods are enabled on the merchant account.

## 2. Merchant dashboard vs production engine

| Method | Dashboard (owner-confirmed) | Live engine evidence |
|--------|----------------------------|----------------------|
| Apple Pay | ENABLED | `#apple-pay-item`, `<apple-pay-button>`, Apple Pay assets present on `payment.payfast.io` |
| Google Pay | ENABLED | `#google-pay-environment=PRODUCTION`, `#google-pay-merchant-id=BCR2DN5TTDZLBKAB`, `#google-pay-gateway-id=payfast`, `pay.google.com` payframe iframe |
| Credit / Cheque card | ENABLED | Visible in method list |
| Debit Card | ENABLED | Visible in method list |
| Instant EFT | ENABLED | Visible in method list |

Forced `payment_method=ap` and `payment_method=gp` both accepted by PayFast (`302` to payment engine, no rejection).

## 3. Live R249 checkout inventory (Chrome / Chromium)

From `https://www.tenderbriefing.co.za/` → PayFast process → `payment.payfast.io`:

| Check | Result |
|-------|--------|
| Amount | **R 249.00** |
| Credit & Cheque card | **Presented** |
| Debit Card | **Presented** |
| Instant EFT | **Presented** |
| SnapScan / Zapper / Bank QR | Presented |
| CSP violations on redirect | **0** |
| Live CSP `form-action` | includes `www.payfast.co.za`, `sandbox.payfast.co.za`, `payment.payfast.io` |

## 4. Google Pay production checkout

| Check | Result |
|-------|--------|
| Merchant PRODUCTION config on page | **Yes** |
| Google Pay gateway = payfast | **Yes** |
| `PaymentRequest.canMakePayment()` (Chrome) | **true** |
| Google payframe iframe loaded | **Yes** (`pay.google.com/gp/p/ui/payframe?...`) |
| Listed as text tile “Google Pay” in “How will you be paying today?” | **Not in text list** (PayFast injects wallet UI separately; eligibility-gated) |
| Charge completed | **No** (by design) |

**Result:** Google Pay is **wired and loadable** on the live hosted checkout for this merchant. Full shopper tap-to-authorize was not executed.

## 5. Apple Pay production checkout

| Check | Result |
|-------|--------|
| Apple Pay DOM / button assets on live page | **Yes** |
| `#apple-pay-item` visible in Chrome | **No** (`display: none` — expected outside eligible Safari/Apple Pay session) |
| `ApplePaySession` / `canMakePayments` in probe browser | Present (environment-dependent) |
| Forced `payment_method=ap` accepted | **Yes** |
| Charge completed | **No** |

**Result:** Apple Pay is **configured on the live PayFast engine** for this merchant. **Visible presentation** to an end user requires an eligible Safari / iPhone / iPad session with Apple Pay set up — not available as a fully interactive shopper session in this certification environment.

## 6. Security / ITN / idempotency (code review + existing tests)

| Control | Evidence | Result |
|---------|----------|--------|
| `return_url` cannot mark paid | `POST /api/payments/payfast/confirm` only returns current `paymentStatus` | **PASS** |
| Only ITN marks paid | `processPayfastItn` → signature + PayFast validate + `COMPLETE` → `markRequestPaid` | **PASS** |
| Duplicate ITN | Same `pf_payment_id` when already paid → `duplicate: true`, no re-dispatch path as new payment | **PASS** |
| Unpaid retry / resume | `createRequest` resumes unpaid active request; no duplicate booking | **PASS** (integration tests) |
| Downstream once | `markRequestPaid` short-circuits if already paid (`alreadyPaid: true`); `request_paid` only after transition | **PASS** |
| Amount check | ITN amount vs quoted fee | **PASS** |

## 7. CSP

No additional origins required. Zero CSP violations observed during hosted checkout navigation. Existing PayFast CSP certification remains valid.

## 8. Remaining manual tests

1. **Apple Pay (required for unconditional PASS):** On a real iPhone/Mac Safari with Apple Pay configured, open My Requests → Pay R249 → confirm Apple Pay control is **visible/usable**, then cancel (no need to charge).
2. **Google Pay (shopper UX):** On Chrome/Android with Google Pay / saved cards, confirm the Google Pay control is usable, then cancel.
3. Optional controlled R249 charge via wallet only if owner authorises — ITN already certified for card/EFT path architecture.

## 9. Final matrix

| Item | Result |
|------|--------|
| Executive Verdict | **PASS WITH CONDITIONS** |
| Apple Pay merchant status | ENABLED (dashboard + live engine assets) |
| Google Pay merchant status | ENABLED (dashboard + live PRODUCTION config) |
| Apple Pay production checkout | Configured; **visible Safari presentation pending manual device test** |
| Google Pay production checkout | PRODUCTION config + payframe + `canMakePayment=true`; shopper tap not executed |
| Credit/debit card | **PASS** (presented) |
| Instant EFT | **PASS** (presented) |
| R249 amount | **PASS** |
| CSP | **PASS** (0 violations; no change) |
| ITN | **PASS** (unchanged authority) |
| Idempotency | **PASS** |
| Code change required | **NO** |
| Deployment required | **NO** |
| Production revision | `tenderbriefing-00109-h6m` |
| Remaining manual test | Eligible Safari Apple Pay visibility; optional Google Pay tap-cancel |
| Final Verdict | **PASS WITH CONDITIONS** |
