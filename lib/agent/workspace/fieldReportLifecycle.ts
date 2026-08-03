/**
 * Field report draft → submit → lock lifecycle (assignment-scoped).
 * Does not replace attendance workflow; complements briefingReports.
 */

export const FIELD_REPORT_STATES = [
  'draft',
  'submitted',
  'locked',
  'verified',
  'rejected',
] as const

export type FieldReportState = (typeof FIELD_REPORT_STATES)[number]

export type FieldReportActor = 'youth-agent' | 'sme' | 'admin' | 'system'

const ALLOWED: Record<
  FieldReportState,
  Partial<Record<FieldReportState, FieldReportActor[]>>
> = {
  draft: {
    draft: ['youth-agent', 'admin'],
    submitted: ['youth-agent', 'admin'],
  },
  submitted: {
    locked: ['system', 'admin'],
    draft: ['admin'],
    rejected: ['sme', 'admin'],
    verified: ['sme', 'admin'],
  },
  locked: {
    verified: ['sme', 'admin'],
    rejected: ['sme', 'admin'],
  },
  verified: {},
  rejected: {
    draft: ['youth-agent', 'admin'],
  },
}

export function canTransitionFieldReport(
  fromRaw: string | null | undefined,
  to: FieldReportState,
  role: FieldReportActor
): { ok: boolean; reason?: string; from: FieldReportState; to: FieldReportState } {
  const from = (FIELD_REPORT_STATES as readonly string[]).includes(fromRaw || '')
    ? (fromRaw as FieldReportState)
    : 'draft'
  if (from === to && to === 'draft') return { ok: true, from, to }
  if (from === to) return { ok: true, from, to }
  const roles = ALLOWED[from]?.[to]
  if (!roles) {
    return { ok: false, reason: `Transition ${from} → ${to} is not allowed`, from, to }
  }
  if (!roles.includes(role)) {
    return {
      ok: false,
      reason: `Role ${role} cannot transition ${from} → ${to}`,
      from,
      to,
    }
  }
  return { ok: true, from, to }
}

export function assertFieldReportTransition(
  fromRaw: string | null | undefined,
  to: FieldReportState,
  role: FieldReportActor
): void {
  const result = canTransitionFieldReport(fromRaw, to, role)
  if (!result.ok) throw new Error(result.reason || 'Invalid field report transition')
}

/** Once locked or verified, agent cannot edit content. */
export function isFieldReportEditable(status: string | null | undefined): boolean {
  return status === 'draft' || status === 'rejected' || !status
}
