import { describe, expect, it } from 'vitest'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const {
  evaluateOpsSla,
  isCompletionEligible,
  briefingMomentSa,
  EXCEPTION_CODES,
  SLA_TRACK,
} = require('../../backend/domain/opsSlaEngine')

describe('opsSlaEngine', () => {
  it('parses briefing moments in Africa/Johannesburg (+02:00)', () => {
    const m = briefingMomentSa({ briefingDate: '2026-10-20', briefingTime: '11:00' })
    expect(m).toBeTruthy()
    // 11:00 SAST = 09:00 UTC
    expect(m.toISOString()).toBe('2026-10-20T09:00:00.000Z')
  })

  it('flags unassigned approaching briefing as due soon / overdue', () => {
    const now = new Date('2026-10-19T10:00:00.000Z') // day before 11:00 SAST briefing
    const sla = evaluateOpsSla(
      {
        paymentStatus: 'paid',
        opsStage: 'assignment_required',
        briefingDate: '2026-10-20',
        briefingTime: '11:00',
      },
      { now }
    )
    expect(sla.exceptionCode).toBe(EXCEPTION_CODES.UNASSIGNED_APPROACHING_BRIEFING)
    expect([SLA_TRACK.DUE_SOON, SLA_TRACK.OVERDUE]).toContain(sla.track)
  })

  it('flags briefing passed with no evidence', () => {
    const now = new Date('2026-10-21T12:00:00.000Z')
    const sla = evaluateOpsSla(
      {
        paymentStatus: 'paid',
        representativeName: 'Rep',
        attended: true,
        opsStage: 'evidence_required',
        briefingDate: '2026-10-20',
        briefingTime: '11:00',
      },
      { now }
    )
    // Phase 16: attended without evidence is the more precise primary exception
    expect(sla.exceptionCode).toBe(EXCEPTION_CODES.ATTENDED_NO_EVIDENCE)
    expect(sla.track).toBe(SLA_TRACK.OVERDUE)
    expect(sla.allExceptionCodes).toContain(EXCEPTION_CODES.ATTENDED_NO_EVIDENCE)
  })

  it('flags report pending and report ready not sent', () => {
    const now = new Date('2026-10-22T12:00:00.000Z')
    const pending = evaluateOpsSla(
      {
        paymentStatus: 'paid',
        representativeName: 'Rep',
        attended: true,
        evidenceOverride: true,
        reportStatus: 'in_progress',
        reportInProgressAt: '2026-10-20T10:00:00.000Z',
        briefingDate: '2026-10-20',
        briefingTime: '11:00',
      },
      { now }
    )
    expect(pending.exceptionCode).toBe(EXCEPTION_CODES.EVIDENCE_RECEIVED_REPORT_PENDING)

    const ready = evaluateOpsSla(
      {
        paymentStatus: 'paid',
        reportStatus: 'ready',
        reportReadyAt: '2026-10-21T10:00:00.000Z',
        briefingDate: '2026-10-20',
        briefingTime: '11:00',
      },
      { now }
    )
    expect(ready.exceptionCode).toBe(EXCEPTION_CODES.REPORT_READY_NOT_SENT)
  })

  it('flags delivery failed/bounced as blocked', () => {
    const failed = evaluateOpsSla({
      paymentStatus: 'paid',
      reportStatus: 'ready',
      clientDeliveryStatus: 'failed',
    })
    expect(failed.exceptionCode).toBe(EXCEPTION_CODES.DELIVERY_FAILED)
    expect(failed.track).toBe(SLA_TRACK.BLOCKED)

    const bounced = evaluateOpsSla({
      paymentStatus: 'paid',
      deliveredAt: '2026-10-16T08:00:00.000Z',
      clientDeliveryStatus: 'bounced',
    })
    expect(bounced.exceptionCode).toBe(EXCEPTION_CODES.DELIVERY_BOUNCED)
  })

  it('completion eligibility requires payment, evidence, report, delivery', () => {
    expect(isCompletionEligible({}).eligible).toBe(false)
    const ok = isCompletionEligible({
      paymentStatus: 'paid',
      evidenceOverride: true,
      reportStatus: 'ready',
      reportReadyAt: '2026-10-16T08:00:00.000Z',
      opsReportId: 'orpt-1',
      clientDeliveryStatus: 'sent',
    })
    expect(ok.eligible).toBe(true)
  })

  it('detects stuck lifecycle for abandoned delivery review', () => {
    const now = new Date('2026-10-18T12:00:00.000Z')
    const sla = evaluateOpsSla(
      {
        paymentStatus: 'paid',
        reportStatus: 'ready',
        reportReadyAt: '2026-10-16T08:00:00.000Z',
        clientDeliveryStatus: 'delivery_review',
        clientDeliveryOpenedAt: '2026-10-16T08:00:00.000Z',
        briefingDate: '2026-10-10',
        briefingTime: '11:00',
      },
      { now }
    )
    expect(sla.exceptionCode).toBe(EXCEPTION_CODES.STUCK_LIFECYCLE)
    expect(sla.track).toBe(SLA_TRACK.BLOCKED)
  })
})
