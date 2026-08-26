/**
 * Immutable private-tender booking snapshot fields for attendance requests (Phase 3A).
 * Historical requests must not change if the underlying tender is later edited.
 */
import { briefingPriceSnapshotFields } from '@/lib/domain/briefingPricing'
import { buildBriefingSnapshot } from '@/lib/privateTenders/briefingFields'

export type PrivateBookingSource = 'private_tender' | 'public_tender' | 'other'

export function buildPrivateTenderBookingSnapshot(tender: Record<string, unknown> | null | undefined) {
  const pricing = briefingPriceSnapshotFields()
  if (!tender) {
    return {
      source: 'other' as PrivateBookingSource,
      privateTenderId: null as string | null,
      privateSubmissionId: null as string | null,
      organisationId: null as string | null,
      tenderNumber: '',
      tenderTitle: '',
      briefingSnapshot: null as ReturnType<typeof buildBriefingSnapshot> | null,
      ...pricing,
    }
  }

  const sourceType = String(tender.sourceType || '')
  const isPrivate =
    sourceType === 'private' ||
    String(tender.source || '') === 'company_submission' ||
    Boolean(tender.privateSubmissionId)

  const privateSubmissionId =
    (typeof tender.privateSubmissionId === 'string' && tender.privateSubmissionId) ||
    (typeof tender.id === 'string' && String(tender.id).startsWith('priv-pts-')
      ? String(tender.id).replace(/^priv-/, '')
      : null)

  return {
    source: (isPrivate ? 'private_tender' : 'public_tender') as PrivateBookingSource,
    privateTenderId: typeof tender.id === 'string' ? tender.id : null,
    privateSubmissionId,
    organisationId:
      typeof tender.organisationId === 'string'
        ? tender.organisationId
        : typeof tender.privateOrganisationId === 'string'
          ? tender.privateOrganisationId
          : null,
    tenderNumber: String(tender.tenderNumber || tender.tenderReference || ''),
    tenderTitle: String(tender.title || ''),
    briefingSnapshot: buildBriefingSnapshot({
      ...tender,
      briefingStartTime: String(tender.briefingStartTime || tender.briefingTime || ''),
      briefingProvince: String(tender.briefingProvince || tender.province || ''),
      briefingMunicipality: String(tender.briefingMunicipality || tender.municipality || ''),
    }),
    ...pricing,
  }
}
