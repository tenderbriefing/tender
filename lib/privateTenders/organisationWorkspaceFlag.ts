/**
 * Fail-closed feature flag for Private Tender Organisation Workspace (Phase 2).
 *
 * - `PRIVATE_TENDER_ORGANISATION_WORKSPACE_ENABLED=false` (default) ⇒ workspace APIs deny.
 * - Phase 1 public `/submit-tender` and Founder review remain available regardless.
 * - `NEXT_PUBLIC_PRIVATE_TENDER_ORGANISATION_WORKSPACE_ENABLED` is UI-only and must
 *   never authorize data access.
 *
 * Flag key (docs/ops): `private_tender_organisation_workspace_v1`
 */

function truthy(v: string | undefined | null): boolean {
  if (!v) return false
  const s = String(v).trim().toLowerCase()
  return s === '1' || s === 'true' || s === 'yes' || s === 'on'
}

export function isPrivateTenderOrganisationWorkspaceEnabled(): boolean {
  return truthy(process.env.PRIVATE_TENDER_ORGANISATION_WORKSPACE_ENABLED)
}

export function isPrivateTenderOrganisationWorkspaceUiEnabled(): boolean {
  return (
    truthy(process.env.NEXT_PUBLIC_PRIVATE_TENDER_ORGANISATION_WORKSPACE_ENABLED) ||
    isPrivateTenderOrganisationWorkspaceEnabled()
  )
}

export const PRIVATE_TENDER_ORG_WORKSPACE_FLAG_KEY =
  'private_tender_organisation_workspace_v1' as const
