# TenderBriefing Platform Modules

Standalone procurement intelligence and briefing operations platform (no RFQ Assist / Biddify dependencies).

## Backend services (`backend/services/`)

| Service | Purpose |
|---------|---------|
| `storageAdapter.js` | Routes to JSON or Firestore via `STORAGE_ADAPTER` |
| `firestoreStorageService.js` | Firestore collections: tenderBriefings, attendanceRequests, etc. |
| `config/firebaseAdmin.js` | Firebase Admin SDK (credentials via env) |
| `incrementalSyncService.js` | OCDS API sync with `dateFrom`/`dateTo`, nightly reconciliation |
| `tenderClassificationService.js` | 12 industry sectors + confidence |
| `provinceDetectionService.js` | SA province normalization and detection |
| `deduplicationService.js` | OCID, tender number, title, department rules |
| `documentExtractionService.js` | PDF/text enrichment for briefing terms |
| `aiSummaryService.js` | OpenAI or rule-based summaries |
| `opportunityScoringService.js` | 0–100 opportunity score |
| `notificationService.js` | Email/WhatsApp/push-ready events |
| `agentAssignmentService.js` | SME requests, agent accept/decline, reports |
| `auditLogService.js` | JSONL logs in `backend/logs/` |
| `tenderHistoryService.js` | Field-level change tracking |
| `calendarService.js` | Briefing/closing calendar events |
| `tenderPipeline.js` | Orchestrates processing per tender |

## API routes

- `GET /api/tender-briefings`
- `GET /api/tender-briefings/:id`
- `GET /api/tender-briefings/stats/summary`
- `POST /api/attendance-requests`
- `GET /api/attendance-requests`
- `POST /api/agents/:id/accept`
- `POST /api/agents/:id/decline`
- `POST /api/briefing-reports`
- `GET /api/sync/status`
- `POST /api/sync/run`
- `GET /api/audit-logs`
- `GET /api/calendar/events`

## Frontend pages

- `/auth/signin` — Login
- `/sme/dashboard` → `/dashboard`
- `/agent/dashboard` → `/jobs`
- `/admin/dashboard` — Admin Dashboard
- `/tenders` — SME tender list (60s poll)
- `/tenders/[id]` — Tender details
- `/tenders/[id]/request-agent` — Request Youth Agent
- `/briefing-reports/upload` — Agent report upload
- `/settings` — Settings

## First-time sync

```bash
curl -X POST http://localhost:3000/api/sync/run \
  -H "Content-Type: application/json" \
  -d '{"force":true}'
```

- `STORAGE_ADAPTER=json` → `backend/data/` (local dev)
- `STORAGE_ADAPTER=firestore` → Firestore collections (production)

See `.env.local.example` and `scripts/verify-storage.js`.
