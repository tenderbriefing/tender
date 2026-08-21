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

Create these against project `tenderbriefing-34679`, Cloud Run service `tenderbriefing` (`africa-south1`). Do not alert on 401/403.

| Alert | Filter / metric | Window | Threshold |
|-------|-----------------|--------|-----------|
| HTTP 5xx | `run.googleapis.com/request_count` response_code_class=5xx | 5m | > 2% of requests **or** > 5 absolute if traffic is low |
| 503/504 | log `httpRequest.status=503 OR 504` resource.type=cloud_run_revision | 5m | >= 3 |
| Container restart / OOM | log `textPayload:"Memory limit"` OR `severity>=ERROR` with `The request was aborted` | 10m | >= 1 |
| Catalogue latency | log `jsonPayload.event="hot_path"` AND `jsonPayload.endpoint="tender-briefings"` AND `jsonPayload.durationMs>8000` | 10m | >= 5 |
| PayFast ITN reject | log `jsonPayload.event="itn_rejected"` | 15m | > 10 |
| Automation failure | log `jsonPayload.event="automation_run_completed"` AND `jsonPayload.errorCount>0` | 30m | >= 2 consecutive |
| Sync failure | log `jsonPayload.event="catalogue_summary_write_failed"` OR sync `lastError` | 60m | >= 1 after a scheduled run |
| Transactional email skip | log `[transactionalEmail]` / `RESEND_API_KEY missing` unexpected in production | 30m | >= 3 |
| Authz on intelligence | log path `/api/admin/command-center` OR `/api/founder/user-intelligence` status=5xx | 5m | >= 1 |

Notification channel must be created once in Cloud Console (email to `info@tenderbriefing.co.za` or ops pager). This identity cannot create policies without `monitoring.alertPolicies.create`.

Apply helper (fails closed without IAM):

```bash
# Does not print secrets. Requires monitoring.alertPolicies.create.
bash scripts/apply-production-alerts.sh
```

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
