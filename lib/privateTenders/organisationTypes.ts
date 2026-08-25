/**
 * Phase 2 organisation / membership TypeScript shapes.
 * Documents are written via Admin SDK only.
 */

import type {
  PrivateOrgRole,
  PrivateOrgMemberStatus,
  PrivateOrgStatus,
  PrivateOrgType,
  PrivateOrgVerificationStatus,
} from './organisationPermissions'

export interface PrivateOrganisationAddress {
  line1?: string
  line2?: string
  city?: string
  province?: string
  postalCode?: string
  country?: string
}

export interface PrivateOrganisation {
  id: string
  legalName: string
  tradingName: string
  registrationNumber: string
  website: string
  organisationType: PrivateOrgType
  industry: string
  address: PrivateOrganisationAddress
  primaryContactName: string
  primaryContactEmail: string
  primaryContactPhone: string
  status: PrivateOrgStatus
  verificationStatus: PrivateOrgVerificationStatus
  createdBy: string
  createdAt: string
  updatedAt: string
}

export interface PrivateOrganisationMember {
  id: string
  organisationId: string
  uid: string
  email: string
  role: PrivateOrgRole
  status: PrivateOrgMemberStatus
  invitedByUid: string | null
  createdAt: string
  updatedAt: string
}

export interface PrivateTenderAuditEvent {
  id: string
  submissionId: string
  organisationId: string | null
  actorUid: string | null
  actorType: 'organisation_user' | 'founder' | 'system'
  eventType: string
  fromStatus?: string | null
  toStatus?: string | null
  metadata?: Record<string, unknown>
  createdAt: string
}
