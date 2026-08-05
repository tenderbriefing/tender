# Youth Agent Workspace flags

Flag key: `youth_agent_workspace_v1`

## Fail-closed defaults

| Variable | Default | Role |
|----------|---------|------|
| `YOUTH_AGENT_WORKSPACE_ENABLED` | unset/false | Global server enablement |
| `YOUTH_AGENT_WORKSPACE_PILOT_UIDS` | empty | Comma-separated Firebase Auth UIDs |
| `NEXT_PUBLIC_YOUTH_AGENT_WORKSPACE_ENABLED` | unset/false | Advisory UI only — never authorizes |

## Access rules

1. Empty allow-list + global false ⇒ deny all.
2. UID on allow-list + `userType` in `youth-agent` \| `admin` ⇒ allow (even if global false).
3. Global true ⇒ youth-agent and admin.
4. SME / founder never gain agent workspace via this flag.

## Pilot procedure

1. Add UIDs to Secret Manager / Cloud Run env `YOUTH_AGENT_WORKSPACE_PILOT_UIDS`.
2. Keep `YOUTH_AGENT_WORKSPACE_ENABLED=false` for pilot-only.
3. Confirm `GET /api/agent/workspace` returns `enabled: true` for pilots.
4. Revoke by removing UID from allow-list (no redeploy of client required if env refreshed).

## Rollback

Unset pilot UIDs and keep global false. Classic `/agent/mobile` and attendance APIs remain.
