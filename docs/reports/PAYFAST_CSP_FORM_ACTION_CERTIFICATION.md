# PayFast CSP form-action remediation — Certification Report

**Programme:** R249 attendance PayFast checkout (production blocker)  
**Date (UTC):** 2026-08-12  
**Executive Verdict:** **PASS**

## Root cause

TenderBriefing submitted a valid signed PayFast hosted checkout (`POST https://www.payfast.co.za/eng/process`). PayFast responded with `302` to `https://payment.payfast.io/eng/process/payment/...`. Chromium enforces CSP `form-action` across that redirect chain. Production CSP allowed only `www.payfast.co.za` / `sandbox.payfast.co.za`, so the browser blocked the hop. Users saw “Continuing payment for your existing request…” and never reached the payment page. No ITN was received because payment never started.

## Change

| Item | Value |
|------|--------|
| Branch | `fix/payfast-csp-form-action` |
| Starting SHA (origin/master pre-fix) | `f4fa119071f5c615b9f7e1f465c1564d72b06bf0` |
| Fix commit | `324747a0e7b26fa16bc4f50594e1c187a3649b07` |
| Final merged SHA | `7d2ee4506473d265b592cafaa50c6d11ccf37506` |
| PR | [#28](https://github.com/tenderbriefing/tender/pull/28) |
| Pre-merge CI | [31638540134](https://github.com/tenderbriefing/tender/actions/runs/31638540134) **success** |
| Deploy | [31639344236](https://github.com/tenderbriefing/tender/actions/runs/31639344236) **success** |

### Files changed

- `next.config.js` — CSP `form-action` only
- `tests/unit/payfastCsp.test.ts` — regression coverage
- `docs/API_INTEGRATIONS.md` — operator note

### Exact CSP directive changed

**Before**

```
form-action 'self' https://www.payfast.co.za https://sandbox.payfast.co.za
```

**After**

```
form-action 'self' https://www.payfast.co.za https://sandbox.payfast.co.za https://payment.payfast.io
```

Not changed: `connect-src`, `frame-src`, `script-src`, `default-src`, and no `*.payfast.io` wildcard (exact host only).

## Payment contract regression (unchanged)

| Check | Result |
|-------|--------|
| Checkout payload / signature generation | Unchanged |
| Merchant secrets / `PAYFAST_MODE=live` | Unchanged |
| `return_url` / `cancel_url` / `notify_url` | Still `www.tenderbriefing.co.za` paths |
| ITN is source of truth (`/api/webhooks/payfast`) | Unchanged |
| `/api/payments/payfast/confirm` does not mark paid | Confirmed (read-only status poll) |
| Unpaid active request resume (no duplicate) | Unit/integration covered; pending request `req-1786562638424-6nlcb3` remains `paymentStatus: pending` |

## Local / CI gates

| Gate | Result |
|------|--------|
| typecheck | PASS |
| lint | PASS (pre-existing hook warning only) |
| `npm test` (174) | PASS |
| PayFast + CSP + attendance targeted | PASS |
| `qa:firestore-rules` / `qa:google-auth` | PASS |
| `npm run build` | PASS |
| `npm audit --omit=dev` | Known deferred advisories (Release Standard conditional) |

## Production

| Field | Value |
|-------|--------|
| Cloud Run revision | `tenderbriefing-00109-h6m` (100% traffic) |
| Image digest | `sha256:b47efce78405107e8f03cc9461ab755f6f7fff9f3f5d767f91eb4185c7b21482` |
| Deploy workflow | [31639344236](https://github.com/tenderbriefing/tender/actions/runs/31639344236) |
| Health `/api/health/firestore` | `status: ok`, `connected: true` |

### Live CSP header verification

`curl -sI https://www.tenderbriefing.co.za/` includes:

```
form-action 'self' https://www.payfast.co.za https://sandbox.payfast.co.za https://payment.payfast.io
```

### PayFast redirect verification (no charge)

From `https://www.tenderbriefing.co.za/` origin, Chromium submitted the real signed R249 checkout form:

| Check | Result |
|-------|--------|
| Left TenderBriefing | Yes |
| Reached `payment.payfast.io` | Yes |
| CSP violations | **0** |
| Payment page render | Yes — PayFast engine UI; “Total: R 249.00”; payment method choices visible |
| Charge completed | **No** (aborted after page render) |
| ITN fired | No (expected — payment not completed) |
| Pending request still usable | Yes — still `pending` / unpaid |

## Security verification

| Check | Result |
|-------|--------|
| ITN signature + PayFast server validate | Unchanged server path |
| Return URL cannot spoof paid | Confirm route only reports status |
| Duplicate ITN / checkout retry | Existing idempotency + unpaid resume; no new entitlement without paid ITN |
| Secrets in client/PR | No merchant secrets committed; temp probe files removed |

## Remaining risks / manual actions

1. SME should retry **My Requests → Pay R249 with PayFast** on the existing pending booking (no need to re-create).
2. If PayFast shows “same account” while logged in as the merchant profile, pay with a different PayFast login than `info@tenderbriefing.co.za` (pre-existing merchant constraint, unrelated to CSP).
3. Welcome-email Resend domain verification remains a separate production issue (out of scope for this release).

## Verdict rationale

Production certification required reaching the real PayFast payment page without a CSP block. That was demonstrated under the live CSP after revision `tenderbriefing-00109-h6m`.
