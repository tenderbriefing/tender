/**
 * Canonical Youth Agent Briefing Intelligence submission paths.
 * Prefer these over the retired `/briefing-reports/upload` legacy notes form.
 */

export function youthAgentAssignmentsPath(): string {
  return '/agent/workspace/assignments'
}

export function youthAgentAssignmentPath(requestId: string): string {
  return `/agent/workspace/assignments/${encodeURIComponent(requestId)}`
}

/** Audio + attendance proof submission (100MB audio). */
export function youthAgentSubmitEvidencePath(requestId: string): string {
  return `${youthAgentAssignmentPath(requestId)}/submit-evidence`
}

/**
 * Maps legacy `/briefing-reports/upload?requestId=…` links to the workspace flow.
 * Without a requestId, send agents to their assignments list.
 */
export function legacyBriefingUploadRedirect(requestId?: string | null): string {
  const id = String(requestId || '').trim()
  if (id) return youthAgentSubmitEvidencePath(id)
  return youthAgentAssignmentsPath()
}
