# API Inventory (summary)

| Class | Examples | Auth |
|-------|----------|------|
| Public | `/api/tender-briefings`, `/api/health/firestore`, PayFast ITN, support POST | None / secret |
| SME | `/api/attendance-requests`, PayFast create-checkout, SME workspace | Bearer SME |
| Agent | accept/decline, mobile v1, briefing upload | Bearer youth-agent |
| Admin | `/api/admin/**`, calendar mutate | Bearer admin |
| Webhook | `/api/webhooks/payfast`, WhatsApp | Signature / fail-closed |
| Retired | `/api/bookings`, `/api/payments/yoco/**`, `/api/webhooks/yoco` | 410 / prod block |

Full route enumeration: see Phase 0 architecture inventory exploration notes and `docs/architecture/INVENTORY.md`.

Error contract (new): `{ error: { code, message, requestId? } }` — migrate incrementally alongside legacy `{ success:false, error }`.
