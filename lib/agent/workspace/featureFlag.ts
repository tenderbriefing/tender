/**
 * Fail-closed feature flag for Youth Agent Workspace v1.
 *
 * Semantics:
 * - `YOUTH_AGENT_WORKSPACE_ENABLED=false` (default) ⇒ not globally enabled.
 * - Non-empty `YOUTH_AGENT_WORKSPACE_PILOT_UIDS` grants access to those exact
 *   Firebase Auth UIDs (pilot path), even while the global flag is false.
 * - Empty allow-list + global flag false ⇒ deny everyone.
 * - When globally enabled: youth-agent and admin may access; SME/founder never
 *   via this flag (SME uses separate verification surfaces).
 * - `NEXT_PUBLIC_YOUTH_AGENT_WORKSPACE_ENABLED` is advisory UI only and must
 *   never authorize data. Prefer server API probe for workspace visibility.
 *
 * Flag key (docs/ops): `youth_agent_workspace_v1`
 */

function truthy(v: string | undefined | null): boolean {
  if (!v) return false
  const s = String(v).trim().toLowerCase()
  return s === '1' || s === 'true' || s === 'yes' || s === 'on'
}

/** Parse comma-separated pilot UIDs (trimmed, non-empty). */
export function parseYouthAgentWorkspacePilotUids(
  raw: string | undefined | null = process.env.YOUTH_AGENT_WORKSPACE_PILOT_UIDS
): string[] {
  if (!raw) return []
  return String(raw)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

/** Server-side global enablement gate (not the only path to access). */
export function isYouthAgentWorkspaceEnabled(): boolean {
  return truthy(process.env.YOUTH_AGENT_WORKSPACE_ENABLED)
}

/** Client-safe mirror — must not alone authorize sensitive data. */
export function isYouthAgentWorkspaceUiEnabled(): boolean {
  return truthy(process.env.NEXT_PUBLIC_YOUTH_AGENT_WORKSPACE_ENABLED)
}

/**
 * Pilot allow-list (comma-separated UIDs).
 * Independent of the global ENABLED flag so pilots can be activated while
 * both public/server global flags remain false.
 * Fail-closed: empty list means no UID matches.
 */
export function isYouthAgentWorkspacePilotUser(uid: string | null | undefined): boolean {
  if (!uid) return false
  const list = parseYouthAgentWorkspacePilotUids()
  if (list.length === 0) return false
  return list.includes(uid)
}

/**
 * Authoritative access decision for Youth Agent Workspace APIs.
 * Pilot UID match wins even when globally disabled.
 * SME and founder are never granted workspace agent access here.
 */
export function canAccessYouthAgentWorkspace(opts: {
  uid: string | null | undefined
  userType?: string | null
}): boolean {
  if (!opts.uid) return false
  // Founder is not a userType; founderAccess alone must not open agent workspace.
  if (opts.userType === 'sme') return false
  if (isYouthAgentWorkspacePilotUser(opts.uid)) {
    return opts.userType === 'youth-agent' || opts.userType === 'admin'
  }
  if (!isYouthAgentWorkspaceEnabled()) return false
  return opts.userType === 'youth-agent' || opts.userType === 'admin'
}

/** Stable product flag key for analytics / ops docs. */
export const YOUTH_AGENT_WORKSPACE_FLAG_KEY = 'youth_agent_workspace_v1' as const
