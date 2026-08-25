# PayFast ITN Production Incident — Diagnosis

**Date:** 2026-08-25  
**Scope:** Missing ITN / unpaid smoke booking (not BI certification)

---

## 1. Executive Verdict

**PASS WITH CONDITIONS — EXTERNAL PAYFAST VERIFICATION REQUIRED**

Platform-side ITN infrastructure for live PayFast appears **healthy**:

- Production generates a correct `notify_url`
- Unauthenticated **POST** reaches the handler without login/redirect
- Fail-closed signature rejection works
- Empty-field ITN signature fix (Aug 2026 hotfix) remains intact
- Request remains `pending` because **no validated PayFast ITN for this merchant reference was received**

Cannot distinguish from this environment alone:

| Scenario | Meaning |
|----------|---------|
| **A** | Payment never completed on PayFast |
| **B** | PayFast COMPLETE but ITN never delivered |

**PAYFAST DASHBOARD VERIFICATION REQUIRES FOUNDER** for merchant reference `TB-REQ-req-1787605208259-42bhi4`.

No application code defect was proven. No code changes were made. Request was **not** marked paid manually.

---

## 2. Request

`req-1787605208259-42bhi4`

---

## 3. Merchant Reference

`TB-REQ-req-1787605208259-42bhi4`

---

## 4. Production SHA

App: `c6182f65666689ae352e2c1e987b0ce25845bc0d`  
Repo HEAD at diagnosis: `f5eebbeddedbb09496db398e97119cccbb1ca795` (docs-only ahead of app)

---

## 5. Production Revision

`tenderbriefing-00130-6xv` @ 100% (`africa-south1`)

Env (non-secret):

- `PAYFAST_MODE=live`
- `NEXT_PUBLIC_SITE_URL=https://www.tenderbriefing.co.za`
- `APP_URL=https://www.tenderbriefing.co.za`
- Merchant ID / key / passphrase: mounted (redacted)

---

## 6. Generated notify_url

Literal production checkout fields (regenerated 2026-08-25):

| Field | Value |
|-------|--------|
| `notify_url` | `https://www.tenderbriefing.co.za/api/webhooks/payfast` |
| `return_url` | `https://www.tenderbriefing.co.za/sme/requests/payment-success?requestId=req-1787605208259-42bhi4` |
| `cancel_url` | `https://www.tenderbriefing.co.za/sme/requests/payment-cancelled?requestId=req-1787605208259-42bhi4` |
| `amount` | `349.00` |
| `m_payment_id` | `TB-REQ-req-1787605208259-42bhi4` |
| `custom_str1` | `req-1787605208259-42bhi4` |
| `formAction` | `https://www.payfast.co.za/eng/process` |
| Signature | Present (32-char MD5; value not logged) |

HTTPS, production www hostname, correct route. No localhost / preview / staging URL.

Architecture map:

```
createCheckoutForExistingRequest
  → siteBaseUrl (NEXT_PUBLIC_SITE_URL in production)
  → createPayfastCheckoutForRequest
  → payfastService.createCheckoutPayload
  → POST /api/webhooks/payfast (ITN)
  → processPayfastItn
      → verifyItnSignature
      → validateItnWithPayfast (live query/validate)
      → merchant_id check
      → amount vs resolveRequestChargeCents
      → markRequestPaid (idempotent)
```

Primary files:

- `backend/services/payments/attendancePaymentService.js`
- `backend/services/integrations/payfastService.js`
- `app/api/webhooks/payfast/route.ts`
- `app/api/payments/payfast/create-checkout/route.ts`
- `middleware.ts` + `lib/security/apiRoutePolicy.ts`

---

## 7. notify_url Reachability

| Probe | Result |
|-------|--------|
| DNS `www.tenderbriefing.co.za` | Resolves via Firebase Hosting (`*.web.app` / `199.36.158.100`) |
| TLS | Valid cert for `tenderbriefing.co.za` |
| Hosting rewrite | `firebase.json` → `tenderbriefing-hosting-proxy` (europe-west1) → Cloud Run app |
| GET `/api/webhooks/payfast` | **401** (expected — only POST is public) |
| OPTIONS | **401** (not required for PayFast ITN) |
| POST form-urlencoded unsigned | **400** `Missing ITN signature` — **no auth redirect** |
| Direct Cloud Run POST | **400** `Missing ITN signature` |
| Apex `/api/...` | **401** on GET; **no** apex→www redirect for `/api/` (middleware exempts APIs) |
| Diagnostic POST mutate paid? | **No** — request still `pending` after probes |

Conclusion: endpoint is publicly reachable for PayFast-style POSTs. Security is signature/validate-based, not session auth.

---

## 8. PayFast Transaction Evidence

**Unavailable from this environment.**

Founder must check PayFast live dashboard / history for:

- `m_payment_id` = `TB-REQ-req-1787605208259-42bhi4`
- Amount R349.00
- Status COMPLETE / CANCELLED / abandoned
- ITN delivery attempts / failures
- `pf_payment_id` if present

Note: Paying while logged into the **merchant** PayFast account (`PAYFAST_MERCHANT_EMAIL=info@tenderbriefing.co.za`) can cause PayFast to refuse same-account payments. Smoke checkout uses `ops-smoke-sme@tenderbriefing.co.za` as `email_address` (not omitted). Payer must complete checkout with a **non-merchant** PayFast login / guest flow.

---

## 9. Production Webhook Evidence

| Window | Finding |
|--------|---------|
| Smoke request ITN | **None** for `req-1787605208259-42bhi4` |
| Last 7d `/api/webhooks/payfast` | Aug 18: successful `itn_accepted` / duplicate for **different** request `req-1787083805398-rcw6f0`; Aug 18: two Python-urllib **401**s (non-POST / non-public method behaviour); Aug 25: only **our** diagnostic unsigned POSTs → `itn_rejected` / `Missing ITN signature` |
| Distinction | **No request received** from PayFast for this smoke (not “received then rejected”) |

Firestore still:

- `paymentStatus: pending`
- `payfastPaymentId: null`
- `paidAt: null`

Browser confirmation / payment-success polling does **not** mark paid (by design).

---

## 10. Signature Validation

- Checkout signatures: ordered fields, empty skipped, passphrase appended, MD5
- ITN signatures: posted key order until `signature`, **empty fields included**, passphrase appended (Aug 12 hotfix retained)
- Local check: empty `custom_str1` included in param string; bad sig rejected; good sig with empty field accepted
- Unit tests: `payfastSignature`, `payfastItnReconciliation`, `paymentLifecycle`, `payfastCheckoutEmail` — **PASS** (20)

---

## 11. Merchant Validation

`processPayfastItn` compares `posted.merchant_id` to `PAYFAST_MERCHANT_ID`. Fail-closed on mismatch / missing. Not weakened.

---

## 12. Amount Validation

Checkout amount `349.00` ↔ request snapshot `34900` cents. ITN uses `amount_gross`/`amount` × 100 vs `resolveRequestChargeCents(request)` (±1¢). Legacy R249 path separate. No pricing change.

---

## 13. Persistence Path

On valid COMPLETE ITN: `markRequestPaid` → lifecycle transition → Firestore save → `request_paid` workflow → audit → founder/SME emails (fail-soft).

Not exercised for this request (no valid ITN). Scenario F (validated but not persisted) **not indicated**.

---

## 14. Idempotency

Same `pf_payment_id` + already paid → `{ duplicate: true }`, HTTP 200. Covered by unit/reconciliation tests. No production duplicates created during diagnosis.

---

## 15. Root Cause

**Unproven between Scenario A and Scenario B.**

Proven platform facts:

1. Correct live checkout payload including notify_url and R349.00
2. ITN endpoint reachable and rejecting unsigned payloads correctly
3. **Zero** PayFast ITN deliveries logged for this merchant reference
4. Booking correctly remains pending without ITN

Not proven: whether the Founder’s PayFast attempt reached COMPLETE status.

---

## 16. Code Changes

**None.**

---

## 17. Tests

| Suite | Result |
|-------|--------|
| `tests/unit/payfastSignature.test.ts` | PASS |
| `tests/unit/payfastItnReconciliation.test.ts` | PASS |
| `tests/unit/paymentLifecycle.test.ts` | PASS |
| `tests/unit/payfastCheckoutEmail.test.ts` | PASS |
| Empty-field ITN signature regression (inline) | PASS |

---

## 18. PR

None (no fix required yet).

---

## 19. Deployment Requirement

**No** — unless Founder dashboard proves COMPLETE + ITN delivery failure that identifies a new platform defect.

---

## 20. Next Action

1. **Founder:** Open PayFast live dashboard → search `TB-REQ-req-1787605208259-42bhi4` / R349.00  
2. **If NOT COMPLETE / no transaction:** complete payment again via  
   `https://www.tenderbriefing.co.za/sme/requests/confirmation?requestId=req-1787605208259-42bhi4`  
   using smoke SME; avoid merchant PayFast login.  
3. **If COMPLETE with `pf_payment_id`:** supply ID — then investigate ITN delivery history; only then consider admin `reconcileAuthoritativePayfastPayment` with PayFast `process/query` evidence (never manual Firestore paid edit).  
4. After ITN/reconcile shows `paid`, resume R349 + BI certification Phases C–H on the **same** request.
