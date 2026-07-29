# Architecture Assessment — Founder User Intelligence Dashboard

**Date:** 2026-07-30  
**Starting SHA:** `970266309652d3e8faa3f06c96dac2baae0fac22`  
**Branch:** `feature/founder-user-intelligence`

## Current state

| Area | Finding |
|------|---------|
| Roles | Only `sme` / `youth-agent` / `admin`. No founder/owner/super-admin. |
| Admin UI | Client `AdminAuthGuard`; middleware does **not** enforce admin role on `/admin`. |
| Analytics | GA4 helpers exist but are largely unwired. No durable first-party product events. |
| Agent↔SME | Per `attendanceRequests` assignment — not a permanent portfolio link. |
| Geography | Province + city only. No municipality field — do not invent coordinates. |
| Feature flags | None — introduce fail-closed env flag. |
| Tests | Smoke/QA Node scripts; no Jest suite. |

## Design decisions (Phase 1)

1. **Founder ≠ ordinary admin.** Access = `admin` + allowlisted email / `founderAccess: true` + feature flag ON.
2. **Shared analytics foundation, separate views.** One `productEvents` store; SME Intelligence, Youth Agent Intelligence, and Network views stay distinct.
3. **Reuse** `users` / `smes` / `agents` / `attendanceRequests` / `smeWorkspace` as primary signals until events accumulate.
4. **Engagement rules** are documented and transparent (see `lib/founder/engagement.ts`).
5. **Server-side only** for founder APIs; Firestore rules deny client reads of raw product events except own create.
6. **Phase 1 scope:** route, RBAC, overview + SME/Agent lists + detail drawers, network view (request-based), province geo aggregates, action centre, event ingest + key emitters, audit log, indexes, QA script, docs.
7. **Deferred (Phase 2):** full cohort retention charts, interactive SA map tiles, session replay, CSV export at scale, scheduled daily rollups, municipality drill-down (needs schema).

## Security posture

- Fail-closed feature flag `FOUNDER_USER_INTELLIGENCE_ENABLED`
- Allowlist `FOUNDER_EMAIL_ALLOWLIST` (default `info@tenderbriefing.co.za`)
- `verifyFounderAccess` on every `/api/founder/*` route
- Middleware blocks `/founder` HTML without session cookie when possible; primary enforcement is API + layout guard
- Audit every founder dashboard access and export attempt
