# ADR 011 — Youth Agent Workspace v1

## Status

Accepted (feature-flagged, fail-closed)

## Context

Youth agents already use `/agent/dashboard`, `/agent/mobile/*`, attendance lifecycle, PayFast earnings, and briefing uploads. Product needs a cohesive **Youth Agent Workspace** (Today / Assignments / Messages / Earnings / Performance / Profile) without deleting the existing attendance workflow until certified.

## Decision

1. Ship workspace under `/agent/workspace/*` (alongside existing mobile field routes).
2. Reuse attendance workflow states (`lib/domain/attendanceLifecycle.ts`) — do not invent a parallel assignment state machine.
3. Gate all workspace APIs with `youth_agent_workspace_v1` via:
   - `YOUTH_AGENT_WORKSPACE_ENABLED` (default false)
   - `YOUTH_AGENT_WORKSPACE_PILOT_UIDS` (comma-separated UIDs; pilot path works while global false)
   - Server-side authoritative (`lib/agent/workspace/featureFlag.ts`); `NEXT_PUBLIC_*` advisory only
4. Extend schema conservatively with:
   - `agentWorkspaceAuditEvents` (append-only audit)
   - `fieldReportDrafts` (draft autosave + lock)
   - `assignmentMessages` (assignment-scoped)
   - `agentEarningsLedger` (append-only ZAR ledger)
   - `agentWorkspaceAnalytics`
5. SME verification via existing SME surfaces + `/api/agent/workspace/verify`; admin minimal oversight at `/admin/agent-workspace`.
6. Do not expose founder/SME/admin product surfaces inside the agent workspace UI.
7. AI summaries only behind existing AI flags/services — never invent facts.

## Consequences

- Old `/agent/mobile` and attendance APIs remain until workspace is certified and migration is explicit.
- Production deploy remains manual (`workflow_dispatch`); flag stays off until pilot UIDs configured.
- Firestore/Storage rules + IDOR tests must cover new collections.
