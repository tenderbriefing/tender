/**
 * Structured briefing fields for private tenders (Phase 3A).
 * Booking CTA primarily applies to physical briefings.
 */

export const BRIEFING_TYPES = ['physical', 'online', 'none'] as const
export type BriefingType = (typeof BRIEFING_TYPES)[number]

export type PrivateTenderBriefingFields = {
  briefingRequired: boolean
  briefingCompulsory: boolean
  briefingType: BriefingType
  briefingDate: string
  briefingStartTime: string
  briefingEndTime: string
  briefingVenue: string
  briefingAddress: string
  briefingProvince: string
  briefingMunicipality: string
  briefingInstructions: string
  briefingContactDetails: string
  briefingRegistrationDeadline: string
  /** Legacy aliases retained for Phase 1/2 compatibility */
  briefingTime?: string
  virtualBriefing?: boolean
  meetingLink?: string
}

export function normalizeBriefingType(value: unknown, fallback: BriefingType = 'physical'): BriefingType {
  const v = String(value || '')
    .trim()
    .toLowerCase()
  if (v === 'physical' || v === 'online' || v === 'none') return v
  return fallback
}

export function isPhysicalBriefingBookable(fields: {
  briefingRequired?: boolean | null
  briefingCompulsory?: boolean | null
  briefingType?: string | null
  virtualBriefing?: boolean | null
}): boolean {
  const type = normalizeBriefingType(
    fields.briefingType,
    fields.virtualBriefing ? 'online' : 'physical'
  )
  if (type !== 'physical') return false
  if (fields.briefingRequired === false && fields.briefingCompulsory === false) return false
  return true
}

export function coerceBriefingFields(
  input: Record<string, unknown> = {},
  defaults: Partial<PrivateTenderBriefingFields> = {}
): PrivateTenderBriefingFields {
  const virtual = Boolean(input.virtualBriefing ?? defaults.virtualBriefing)
  const briefingType = normalizeBriefingType(
    input.briefingType ?? defaults.briefingType,
    virtual ? 'online' : 'physical'
  )
  const start =
    String(input.briefingStartTime || input.briefingTime || defaults.briefingStartTime || defaults.briefingTime || '').trim()
  return {
    briefingRequired:
      input.briefingRequired !== undefined
        ? Boolean(input.briefingRequired)
        : defaults.briefingRequired !== undefined
          ? Boolean(defaults.briefingRequired)
          : briefingType !== 'none',
    briefingCompulsory:
      input.briefingCompulsory !== undefined
        ? Boolean(input.briefingCompulsory)
        : defaults.briefingCompulsory !== undefined
          ? Boolean(defaults.briefingCompulsory)
          : briefingType === 'physical',
    briefingType,
    briefingDate: String(input.briefingDate || defaults.briefingDate || '').trim(),
    briefingStartTime: start,
    briefingEndTime: String(input.briefingEndTime || defaults.briefingEndTime || '').trim(),
    briefingVenue: String(input.briefingVenue || defaults.briefingVenue || '').trim(),
    briefingAddress: String(input.briefingAddress || defaults.briefingAddress || '').trim(),
    briefingProvince: String(
      input.briefingProvince || input.province || defaults.briefingProvince || ''
    ).trim(),
    briefingMunicipality: String(
      input.briefingMunicipality || input.municipality || defaults.briefingMunicipality || ''
    ).trim(),
    briefingInstructions: String(
      input.briefingInstructions || defaults.briefingInstructions || ''
    ).trim(),
    briefingContactDetails: String(
      input.briefingContactDetails || defaults.briefingContactDetails || ''
    ).trim(),
    briefingRegistrationDeadline: String(
      input.briefingRegistrationDeadline || defaults.briefingRegistrationDeadline || ''
    ).trim(),
    briefingTime: start,
    virtualBriefing: briefingType === 'online' || virtual,
    meetingLink: String(input.meetingLink || defaults.meetingLink || '').trim(),
  }
}

/** Immutable briefing snapshot stamped onto attendance requests at booking time. */
export function buildBriefingSnapshot(fields: Partial<PrivateTenderBriefingFields> & Record<string, unknown>) {
  const coerced = coerceBriefingFields(fields)
  return {
    briefingRequired: coerced.briefingRequired,
    briefingCompulsory: coerced.briefingCompulsory,
    briefingType: coerced.briefingType,
    briefingDate: coerced.briefingDate,
    briefingStartTime: coerced.briefingStartTime,
    briefingEndTime: coerced.briefingEndTime,
    briefingVenue: coerced.briefingVenue,
    briefingAddress: coerced.briefingAddress,
    briefingProvince: coerced.briefingProvince,
    briefingMunicipality: coerced.briefingMunicipality,
    briefingInstructions: coerced.briefingInstructions,
    briefingContactDetails: coerced.briefingContactDetails,
    briefingRegistrationDeadline: coerced.briefingRegistrationDeadline,
    meetingLink: coerced.meetingLink || '',
    snapshotAt: new Date().toISOString(),
  }
}
