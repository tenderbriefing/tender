# R349 Platform-Wide Pricing Certification

**Date:** 2026-08-25  
**Scope:** Pricing migration only (not full PayFast→BI E2E)

---

## 1. Executive Verdict

**PRODUCTION CERTIFIED — PLATFORM-WIDE R349 PRICING**

PR #60 merged and deployed. Production revision `tenderbriefing-00131-nj5` @ 100% serves R349 on active commercial surfaces. Unpaid PayFast checkout regenerates **349.00**. Historical `paymentAmount: 24900` records remain unchanged. Banking/manual-EFT intact.

This does **not** certify the outstanding R349 PayFast settlement → BI → Founder approval → SME delivery workflow.

---

## 2. PR #60 Status

**MERGED** — https://github.com/tenderbriefing/tender/pull/60

Pre-merge: head SHA matched certification; all required CI green (typecheck/lint/unit, IDOR, Founder V2, Playwright, production build); mergeable CLEAN; diff limited to pricing migration (no cloudbuild/secrets).

## 3. Certified Source SHA

`7b0ef464b544d4f083e5cd36eef2758c448b5a87`

## 4. Merge SHA

`444eb84da503bcf0d7593f2d7922a3acde922149`

## 5. Merge Timestamp

`2026-08-25T08:02:14Z`

## 6. Deployment Run

[32824559807](https://github.com/tenderbriefing/tender/actions/runs/32824559807) — **success**

## 7. Production SHA

`444eb84da503bcf0d7593f2d7922a3acde922149`

## 8. Production Revision

`tenderbriefing-00131-nj5` @ **100%** traffic (`africa-south1`)

Rollback previous: `tenderbriefing-00130-6xv`

---

## 9. Public Pricing Smoke

| Path | HTTP | R349 present | Literal `${BRIEFING_PRICE_LABEL}` | Active R249 offer |
|------|------|--------------|-----------------------------------|-------------------|
| `/` | 200 | Yes | No | No |
| `/pricing` | 200 | Yes | No | No |
| `/how-it-works` | 200 | Yes | No | No |
| `/about` | 200 | Yes | No | No |
| `/tender-briefing-agent` | 200 | Yes | No | No |
| `/compulsory-tender-briefings` | 200 | Yes | No | No |

## 10. SME Booking Pricing

Existing authorised unpaid smoke request `req-1787605208259-42bhi4`:

| Field | Value |
|-------|--------|
| `paymentStatus` | `pending` |
| `paymentAmount` | **34900** |
| `briefingPriceCents` | **34900** |
| `pricingVersion` | `2026-08-v349` |
| SME API GET | **200** with same cents |
| Confirmation page | R349 present; no literal leak |

## 11. PayFast Checkout Generation

Regenerated unpaid checkout (no payment completed):

| Field | Value |
|-------|--------|
| HTTP | 200 |
| `amount` | **349.00** |
| `m_payment_id` | `TB-REQ-req-1787605208259-42bhi4` |
| `notify_url` | `https://www.tenderbriefing.co.za/api/webhooks/payfast` |
| `return_url` | `…/sme/requests/payment-success` |
| `cancel_url` | `…/sme/requests/payment-cancelled` |
| `formAction` | `https://www.payfast.co.za/eng/process` |

## 12. Historical R249 Compatibility

| Check | Result |
|-------|--------|
| `LEGACY_BRIEFING_PRICE_CENTS` | **24900** |
| Production docs with `paymentAmount: 24900` | Present (≥5 sampled; not rewritten) |
| Snapshot-based ITN validation | Unchanged |
| Mass Firestore rewrite | **Not performed** |

## 13. YA Liability / Margin

| Item | Cents |
|------|-------|
| Customer price | **34900** |
| YA liability | **20000** |
| Gross margin | **14900** |

No fake payout generated.

## 14. Literal Interpolation Regression

Confirmed **not** rendered on homepage, pricing, SEO landings, about, how-it-works, confirmation page.

## 15. Production Monitoring

| Signal | Result |
|--------|--------|
| Homepage / Firestore health | 200 / ok |
| 5xx on new revision (smoke window) | None observed |
| `${BRIEFING_PRICE_LABEL}` in logs | None |

## 16. Banking/EFT Regression

Smoke YA `/api/agent/banking`: **200**, masked account only, version 2. No banking/EFT code in PR #60.

## 17. Remaining R249 References

| Class | Examples |
|-------|----------|
| **ACCEPTABLE** | `LEGACY_BRIEFING_PRICE_CENTS`; historical fixtures; archived certs; production historical `paymentAmount: 24900` docs |
| **NOT ACCEPTABLE (cleared)** | Active UI/SEO/docs/env defaults for current offer |

## 18. Rollback Readiness

| Item | Value |
|------|--------|
| Previous revision | `tenderbriefing-00130-6xv` |
| Previous app SHA | `c6182f65666689ae352e2c1e987b0ce25845bc0d` |
| Procedure | Redeploy prior revision / prior Git SHA via Deploy TenderBriefing |
| Data | Historical and new pricing documents remain; no destructive migration |

## 19. Remaining Blockers

1. Full **R349 PayFast ITN settlement → BI → Founder → SME delivery** certification still outstanding (smoke request still `pending` payment).
2. PayFast dashboard confirmation still required for any COMPLETE-but-no-ITN investigation on the smoke booking.

## 20. Final Recommendation

**Ship / operate** R349 as the sole current commercial offer. Continue separate commercial+BI certification only after real PayFast settlement evidence on the authorised smoke request.
