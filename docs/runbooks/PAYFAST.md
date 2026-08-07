# PayFast Runbook — Tender Briefing

## Authoritative flow

1. SME creates attendance request (`paymentStatus=pending`, fee R249 server-side).
2. `POST /api/payments/payfast/create-checkout` builds signed fields (amount from server).
3. Browser POSTs to PayFast.
4. Return/cancel URLs are UX only.
5. ITN `POST /api/webhooks/payfast` verifies signature → PayFast validate → merchant → amount → marks `paid` idempotently → dispatches `request_paid`.

## Failure modes

| Symptom | Likely cause | Action |
|---------|--------------|--------|
| Checkout not configured | Missing merchant env | Check Secret Manager / `payfast:readiness` |
| ITN 400 invalid signature | Passphrase mismatch | Rotate/sync passphrase |
| Amount mismatch → failed | Fee drift | Confirm `ATTENDANCE_FEE_CENTS` / quotedFee |
| Paid but agents not notified | Workflow failure | Check `workflowEvents` / automation logs |
| PayFast hosted **400** — *Merchant is unable to receive payments from the same account* | **PayFast policy**, not a TenderBriefing signature/ITN bug. Buyer is using the same PayFast login and/or the same email as the merchant account that receives funds. | See [Same-account restriction](#same-account-restriction) |

## Same-account restriction

PayFast blocks merchants from paying into their own merchant account. This surfaces on **PayFast’s hosted page** (HTTP 400) before ITN — our cancel/return URLs never see a structured error code.

### What we send

- `email_address` = SME auth email (`request.smeEmail`), never a hardcoded merchant mailbox.
- Process URL is live when `PAYFAST_MODE=live` (Cloud Run production).
- Merchant ID / key / passphrase come from Secret Manager (`payfast-merchant-*`).

### Ops / founder steps to complete payment

1. Open the unpaid request (resume checkout): `/sme/requests/{requestId}` → **Pay with PayFast**.
2. On PayFast, pay with a **different** personal or business identity than the merchant account:
   - Do **not** log into PayFast with the merchant dashboard credentials.
   - Do **not** use the email registered on the PayFast merchant profile as the payer email.
3. For owner/smoke tests, use a dedicated SME (e.g. `ops-smoke-sme@…`), not the merchant-registered mailbox.
4. Optional: set non-secret `PAYFAST_MERCHANT_EMAIL` to the merchant profile email. Checkout then **omits** `email_address` when the SME email matches, so PayFast prompts for another payer email (still blocked if they log in as the merchant).

### Resume unpaid request

`POST /api/payments/payfast/create-checkout` with `{ attendanceRequestId }` rebuilds a signed live checkout for `pending` / `failed` requests owned by the SME. Re-booking the same tender resumes the existing unpaid request instead of creating a duplicate (see attendance-requests resume flow).

## Production checklist (config)

| Check | Expected |
|-------|----------|
| `PAYFAST_MODE` | `live` |
| Secrets | `PAYFAST_MERCHANT_ID`, `PAYFAST_MERCHANT_KEY`, `PAYFAST_PASSPHRASE` from GSM |
| Notify URL | `https://www.tenderbriefing.co.za/api/webhooks/payfast` |
| Fee | Server `ATTENDANCE_FEE_CENTS` (default `24900`) |

## Never

- Mark paid from browser success page alone.
- Accept client-supplied amount.
- Reintroduce Yoco/Stripe as a second provider.
- Rotate or print PayFast secrets while debugging same-account (policy) failures.
