# Architecture Inventory — Tender Briefing

**As of:** 2026-07-31 (enterprise programme)

## Frontend route groups

| Group | Paths |
|-------|-------|
| Public | `/`, marketing landings, `/tenders`, `/pricing`, legal |
| Auth | `/auth/*` |
| SME | `/sme/dashboard`, `/sme/requests/**`, `/sme/rfq-inbox`, onboarding |
| Agent | `/agent/**`, `/jobs` |
| Admin | `/admin/**`, founder (flagged) |
| Payment UX | `/sme/requests/payment-success\|cancelled` |
| Retired | `/bookings` → redirect; prod 404 for `*-test` / scraper-demo |

Calendar: API-only (`/api/calendar`, `/api/calendar/events`).

## Backend capabilities

| Capability | Authority |
|------------|-----------|
| AuthN/Z | middleware + `verifyApiUser` + `accessControl` |
| Attendance | `/api/attendance-requests/**` + `agentAssignmentService` |
| Payments | PayFast create-checkout + ITN webhook + `attendancePaymentService` |
| Briefings PDF | `/api/briefing-reports/**` with ownership |
| Public tenders | `/api/tender-briefings` + sanitisation |
| Mobile agent | `/api/mobile/v1/**` |
| Webhooks | PayFast (verified), WhatsApp (fail-closed unless configured) |

## Infrastructure

Firebase Hosting → Cloud Run hosting proxy → Cloud Run app (`tenderbriefing`, africa-south1). Firestore + Storage + Secret Manager. GitHub Actions CI + Deploy.

## Data model (core)

- `users`, `agents`, `smes`
- `tenderBriefings`
- `attendanceRequests` (workflow `status` + `paymentStatus`)
- `briefingReports`
- `auditLogs`, `notifications`, `workflowEvents`, `dispatchEvents`
- SME workspace subcollections
- Legacy collections retained read-only/blocked: `bookings`, etc.

## Duplicate / legacy concepts

- Yoco routes: proxy/410
- bookingService: only matching legacy (prod-blocked APIs)
- Vocabulary mix reduced toward Book an agent / attendance request

See explore inventory in programme baseline for full 88 pages / 109 APIs.
