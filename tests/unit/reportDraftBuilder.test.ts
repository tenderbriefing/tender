/**
 * Phase 11 — deterministic draft builder: third-person, conflicts, privacy, edits.
 */
import { describe, expect, it } from 'vitest'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const {
  buildReportDraft,
  applySectionEdits,
  regenerateSection,
  detectSourceConflicts,
  thirdPersonAttendance,
  assertNoInternalLeakage,
} = require('../../backend/services/ops/reportDraftBuilder')

function baseRequest(overrides: Record<string, unknown> = {}) {
  return {
    id: 'req-report-1',
    tenderNumber: 'RFQ-TB-100',
    tenderTitle: 'Supply of laboratory consumables',
    smeCompany: 'Ingenuity Engineers & Constructors',
    representedEntity: 'Ingenuity Engineers & Constructors',
    briefingDate: '2026-10-20',
    briefingTime: '11:00',
    briefingVenue: 'NHLS Head Office',
    province: 'Gauteng',
    department: 'National Health Laboratory Service',
    attended: true,
    attendedAt: '2026-10-20T11:30:00Z',
    agentPayoutCents: 45000,
    representativePayoutCents: 45000,
    representativeInternalNotes: 'SECRET payout travel note',
    internalNotes: 'Do not leak',
    evidenceItems: [],
    briefingLines: [],
    ...overrides,
  }
}

describe('reportDraftBuilder', () => {
  it('builds a draft from valid metadata (sparse evidence)', () => {
    const draft = buildReportDraft(baseRequest())
    expect(draft.cover.tenderNumber).toBe('RFQ-TB-100')
    expect(draft.cover.preparedBy).toBe('TenderBriefing')
    expect(draft.sections.some((s: any) => s.id === 'executive_brief')).toBe(true)
    expect(draft.sections.some((s: any) => s.id === 'disclaimer')).toBe(true)
    expect(draft.voice).toBe('third_person')
    assertNoInternalLeakage(draft)
  })

  it('uses third-person attendance language by default', () => {
    const sentence = thirdPersonAttendance(baseRequest())
    expect(sentence).toMatch(/^A TenderBriefing representative attended/)
    expect(sentence).not.toMatch(/\bI attended\b/i)
    expect(sentence).toContain('Ingenuity Engineers & Constructors')
  })

  it('excludes internal payout and notes from draft JSON', () => {
    const draft = buildReportDraft(baseRequest())
    const blob = JSON.stringify(draft)
    expect(blob).not.toMatch(/45000/)
    expect(blob).not.toMatch(/SECRET payout/)
    expect(blob).not.toMatch(/Do not leak/)
    expect(blob).not.toMatch(/agentPayoutCents/)
    expect(() => assertNoInternalLeakage(draft)).not.toThrow()
  })

  it('includes attendance proof once and site photos without inventing captions freely', () => {
    const draft = buildReportDraft(
      baseRequest({
        evidenceItems: [
          {
            id: 'ev-att-1',
            category: 'attendance_proof',
            fileName: 'register.jpg',
            contentType: 'image/jpeg',
          },
          {
            id: 'ev-att-2',
            category: 'attendance_proof',
            fileName: 'register-dup.jpg',
            contentType: 'image/jpeg',
          },
          {
            id: 'ev-site-1',
            category: 'site_photos',
            fileName: 'gate.jpg',
            contentType: 'image/jpeg',
          },
        ],
      })
    )
    const attendance = draft.sections.find((s: any) => s.id === 'proof_of_attendance')
    expect(attendance.imageRefs).toHaveLength(1)
    expect(attendance.imageRefs[0].evidenceId).toBe('ev-att-1')
    const site = draft.sections.find((s: any) => s.id === 'site_observations')
    expect(site.imageRefs).toHaveLength(1)
  })

  it('detects source conflicts without silently choosing a value', () => {
    const req = baseRequest({
      briefingTime: '11:00',
      briefingLines: [{ lineNumber: 1, briefingTime: '11:30', closingDate: '2026-11-01' }],
    })
    const conflicts = detectSourceConflicts(req)
    expect(conflicts.length).toBeGreaterThan(0)
    expect(conflicts[0].message).toMatch(/SOURCE CONFLICT/)
    const draft = buildReportDraft(req)
    expect(draft.sourceConflicts.length).toBeGreaterThan(0)
    const actions = draft.sections.find((s: any) => s.id === 'key_actions')
    expect(actions.bullets.some((b: string) => /SOURCE CONFLICT/i.test(b))).toBe(true)
  })

  it('does not invent CIDB grades or certificates from empty evidence', () => {
    const draft = buildReportDraft(baseRequest({ evidenceItems: [] }))
    const blob = JSON.stringify(draft).toLowerCase()
    expect(blob).not.toMatch(/cidb grade/)
    expect(blob).not.toMatch(/bbbee level 1/)
  })

  it('preserves human edits and blocks silent regenerate overwrite', () => {
    const req = baseRequest()
    let draft = buildReportDraft(req)
    draft = applySectionEdits(draft, {
      sections: [
        {
          id: 'executive_brief',
          title: 'Executive Brief (edited)',
          paragraphs: ['Human-corrected overview for Ingenuity.'],
        },
      ],
    })
    const edited = draft.sections.find((s: any) => s.id === 'executive_brief')
    expect(edited.humanEdited).toBe(true)
    expect(edited.paragraphs[0]).toContain('Human-corrected')

    expect(() => regenerateSection(draft, req, 'executive_brief', { force: false })).toThrow(
      /human edits/i
    )

    const forced = regenerateSection(draft, req, 'executive_brief', { force: true })
    const section = forced.sections.find((s: any) => s.id === 'executive_brief')
    expect(section.humanEdited).toBe(false)
    expect(section.paragraphs[0]).toMatch(/TenderBriefing representative/)
  })
})
