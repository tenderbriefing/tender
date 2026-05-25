# Workflow automation (Phase 11)

Real-time procurement orchestration via `workflowAutomationService.js`.

## Events

| Workflow event | Triggers |
|----------------|----------|
| `attendance_requested` | Paid request — notify SME + nearby agents (WhatsApp) |
| `request_paid` | Yoco payment confirmed — unlock agents |
| `request_accepted` | Agent/admin assign — notify SME |
| `report_uploaded` | Briefing report — PDF summary + SME/admin WhatsApp |
| `tender_closing_soon` | Tracked tender closing within 24h |
| `briefing_missed` | Agent absent after briefing window |

## Scheduled jobs

`POST /api/automation/run` with header `x-automation-secret` or `x-sync-secret` (production).

Body: `{ "job": "all" }` or one of:

- `tender_closing_reminders`
- `briefing_reminders`
- `missed_briefing_detection`
- `retry_failed_whatsapp`
- `sla_escalations`
- `smart_dispatch` (live dispatch top-5, radius/province escalation, stale close)

Cloud Scheduler example (hourly):

```bash
curl -X POST https://www.tenderbriefing.co.za/api/automation/run \
  -H "x-sync-secret: YOUR_SYNC_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"job":"all"}'
```

## SLA

- **15 min** — unpaid assignment queue: notify additional agents
- **60 min** — escalate to admins via workflow + WhatsApp

## Firestore

Collection `workflowEvents/{id}` — type, status, payload, retries, channels.

## Admin

`/admin/operations` — workflow panel, retry failed WhatsApp, telemetry.

APIs:

- `GET /api/admin/workflow-events`
- `GET /api/admin/automation-health`
- `POST /api/admin/notifications/retry`

## QA

```bash
npm run workflow:qa
```

## Push (foundation)

`POST /api/push/register-token` — stores FCM tokens on `users/{uid}.deviceTokens`.
