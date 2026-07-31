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

## Never

- Mark paid from browser success page alone.
- Accept client-supplied amount.
- Reintroduce Yoco/Stripe as a second provider.
