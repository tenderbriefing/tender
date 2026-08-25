/**
 * Organisation membership roles and permission helpers (Phase 2).
 */

export const PRIVATE_ORG_ROLES = ['owner', 'admin', 'procurement'] as const
export type PrivateOrgRole = (typeof PRIVATE_ORG_ROLES)[number]

export const PRIVATE_ORG_MEMBER_STATUSES = ['active', 'invited', 'disabled'] as const
export type PrivateOrgMemberStatus = (typeof PRIVATE_ORG_MEMBER_STATUSES)[number]

export const PRIVATE_ORG_STATUSES = ['pending', 'active', 'suspended'] as const
export type PrivateOrgStatus = (typeof PRIVATE_ORG_STATUSES)[number]

export const PRIVATE_ORG_VERIFICATION_STATUSES = [
  'unverified',
  'pending',
  'verified',
  'rejected',
] as const
export type PrivateOrgVerificationStatus = (typeof PRIVATE_ORG_VERIFICATION_STATUSES)[number]

export const PRIVATE_ORG_TYPES = [
  'private_company',
  'nonprofit',
  'soe',
  'other',
] as const
export type PrivateOrgType = (typeof PRIVATE_ORG_TYPES)[number]

export type OrgPermission =
  | 'manage_profile'
  | 'manage_members'
  | 'create_tender'
  | 'edit_tender'
  | 'submit_tender'
  | 'withdraw_tender'
  | 'duplicate_tender'
  | 'view_tenders'
  | 'destructive_org'

const ROLE_PERMISSIONS: Record<PrivateOrgRole, readonly OrgPermission[]> = {
  owner: [
    'manage_profile',
    'manage_members',
    'create_tender',
    'edit_tender',
    'submit_tender',
    'withdraw_tender',
    'duplicate_tender',
    'view_tenders',
    'destructive_org',
  ],
  admin: [
    'manage_profile',
    'manage_members',
    'create_tender',
    'edit_tender',
    'submit_tender',
    'withdraw_tender',
    'duplicate_tender',
    'view_tenders',
  ],
  procurement: [
    'create_tender',
    'edit_tender',
    'submit_tender',
    'withdraw_tender',
    'duplicate_tender',
    'view_tenders',
  ],
}

export function orgRoleHasPermission(
  role: string | null | undefined,
  permission: OrgPermission
): boolean {
  if (!role || !(PRIVATE_ORG_ROLES as readonly string[]).includes(role)) return false
  return ROLE_PERMISSIONS[role as PrivateOrgRole].includes(permission)
}

export function isActiveOrgMembership(member: {
  status?: string | null
  role?: string | null
} | null): boolean {
  return Boolean(member && member.status === 'active' && member.role)
}
