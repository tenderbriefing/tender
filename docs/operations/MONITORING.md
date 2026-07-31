# Monitoring & Observability Runbook

## Critical structured events

Emitted via `lib/observability/logger.ts` / `observabilityBridge.js`:

| Event | When |
|-------|------|
| `payment_initiated` | PayFast checkout created |
| `itn_received` / `itn_accepted` / `itn_rejected` / `duplicate_itn_ignored` | PayFast ITN |
| `rate_limit_exceeded` | Shared/edge limiter |
| `cross_user_access_denial` | PDF / ownership deny |
| `webhook_rejected` | WhatsApp / unsigned |
| `briefing_pdf_downloaded` | PDF download success |
| `authorisation_denial` | Client amount rejected |

## Recommended Cloud Monitoring alerts

1. Cloud Run 5xx rate > 2% for 5m → on-call
2. Log match `itn_rejected` count > 10/15m → payments owner
3. Log match `paymentStatus":"pending"` aged requests (custom metric) > threshold → dispatch
4. Auth 401 spike on `/api/attendance-requests` → security
5. `rate_limit_exceeded` surge → abuse review
6. WhatsApp `whatsapp_disabled` unexpected if feature expected on

## Operator checks

```bash
# Health
curl -sS https://www.tenderbriefing.co.za/api/health/firestore

# Paid but unassigned (Admin API / console query)
# attendanceRequests where paymentStatus==paid AND status==pending
```

## Incident runbooks

- PayFast: `docs/runbooks/PAYFAST.md`
- Auth: rotate compromised tokens; check `verifyApiUser` suspend flags
- Dispatch: command center pending-paid queue
