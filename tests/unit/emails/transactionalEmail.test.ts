import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderEmailTemplate, TEMPLATE_BUILDERS } from '@/lib/emails/templates'
import { FIXTURES, GALLERY } from '@/lib/emails/fixtures'
import {
  resolveReportDueAt,
  resolveBriefingInstant,
  formatMoneyCents,
} from '@/lib/emails/utils'
import { IdempotencyKeys, ensureReportSlaFields } from '@/lib/services/transactionalEmailService'

describe('transactional email templates', () => {
  it('exposes all required template builders', () => {
    const required = [
      'sme_welcome',
      'youth_agent_welcome',
      'attendance_payment_confirmed',
      'agent_assignment',
      'sme_agent_allocated',
      'attendance_proof_available',
      'briefing_report_ready',
      'agent_report_reminder',
      'report_delay_update',
      'admin_report_overdue',
    ] as const
    for (const id of required) {
      expect(typeof (TEMPLATE_BUILDERS as Record<string, unknown>)[id]).toBe('function')
    }
  })

  it('renders every gallery fixture with subject, html, and plaintext', () => {
    for (const entry of GALLERY) {
      const fixture = (FIXTURES as Record<string, Record<string, unknown>>)[entry.fixture]
      const rendered = renderEmailTemplate(entry.templateId, fixture, process.env)
      expect(rendered.subject.length).toBeGreaterThan(5)
      expect(rendered.html).toContain('TenderBriefing')
      expect(rendered.html).toContain('/brand/logo.png')
      expect(rendered.text.length).toBeGreaterThan(20)
      expect(rendered.html).toMatch(/min-height:44px|padding:14px 22px/)
    }
  })

  it('SME and Youth Agent welcome templates differ in tone and CTA', () => {
    const sme = renderEmailTemplate('sme_welcome', FIXTURES.sme_welcome)
    const ya = renderEmailTemplate('youth_agent_welcome', FIXTURES.youth_agent_welcome)
    expect(sme.subject).toBe('Welcome to TenderBriefing')
    expect(ya.subject).toMatch(/Youth Agent/i)
    expect(sme.html).toMatch(/SME dashboard/i)
    expect(ya.html).toMatch(/How assignments work/i)
    expect(ya.text).toMatch(/Capture proof/i)
  })

  it('payment confirmation includes booking card fields and paid status', () => {
    const rendered = renderEmailTemplate(
      'attendance_payment_confirmed',
      FIXTURES.attendance_payment_confirmed
    )
    expect(rendered.html).toMatch(/Payment received/i)
    expect(rendered.html).toContain('RFQ 184/2026')
    expect(rendered.html).toContain('TB-REQ-DEMO-001')
    expect(rendered.text).toMatch(/Paid/i)
  })

  it('handles missing optional fields without throwing', () => {
    const rendered = renderEmailTemplate('sme_agent_allocated', {
      requestId: 'x',
      tenderTitle: 'Only title',
    })
    expect(rendered.html).toContain('Only title')
    expect(rendered.text).toContain('Agent allocated')
  })
})

describe('report SLA helpers', () => {
  it('uses meetingEndedAt + 24h when present', () => {
    const due = resolveReportDueAt({
      meetingEndedAt: '2026-08-18T12:00:00.000Z',
    })
    expect(due?.toISOString()).toBe('2026-08-19T12:00:00.000Z')
  })

  it('falls back to briefing scheduled + 24h when end time unknown', () => {
    const due = resolveReportDueAt({
      briefingDate: '2026-08-18',
      briefingTime: '10:00',
    })
    expect(due).toBeInstanceOf(Date)
    const briefing = resolveBriefingInstant({
      briefingDate: '2026-08-18',
      briefingTime: '10:00',
    })
    expect(briefing).toBeInstanceOf(Date)
    expect(due!.getTime() - briefing!.getTime()).toBe(24 * 60 * 60 * 1000)
  })

  it('ensureReportSlaFields documents fallback policy', () => {
    const stamped = ensureReportSlaFields({
      id: 'r1',
      briefingDate: '2026-08-18',
      briefingTime: '10:00',
    }) as { reportDueAt?: string; reportSlaFallback?: string }
    expect(stamped.reportDueAt).toBeTruthy()
    expect(stamped.reportSlaFallback).toBe('briefing_scheduled_plus_24h')
  })

  it('formats ZAR cents for receipts', () => {
    expect(formatMoneyCents(34900, 'ZAR')).toBe('R349.00')
    expect(formatMoneyCents(24900, 'ZAR')).toBe('R249.00') // historical snapshot formatting
  })
})

describe('idempotency keys', () => {
  it('builds deterministic keys for lifecycle events', () => {
    expect(IdempotencyKeys.smeWelcome('u1')).toBe('SME_WELCOME:u1')
    expect(IdempotencyKeys.paymentConfirmed('req1')).toBe('ATTENDANCE_PAYMENT_CONFIRMED:req1')
    expect(IdempotencyKeys.agentAssigned('req1', 'a1')).toBe('AGENT_ASSIGNED:req1:a1')
    expect(IdempotencyKeys.reportReminder('req1', 'overdue')).toBe('REPORT_REMINDER:req1:overdue')
  })
})

describe('transactionalEmailService send idempotency', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('skips duplicate sends when ledger already claimed/sent', async () => {
    const send = vi.fn()
    const set = vi.fn(async () => undefined)
    const create = vi.fn(async () => undefined)
    const get = vi.fn(async () => ({
      exists: true,
      data: () => ({ status: 'sent', attempts: 1 }),
    }))
    const ref = { get, set, create }
    const db = {
      collection: () => ({
        doc: () => ref,
      }),
    }

    const tx = await import('@/lib/services/transactionalEmailService')
    const result = await tx.sendAttendancePaymentConfirmation(
      {
        id: 'req-1',
        smeEmail: 'sme@example.com',
        smeId: 'sme-1',
        tenderTitle: 'T',
        paymentAmount: 24900,
      },
      {
        env: { RESEND_API_KEY: 're_test' },
        resendClient: { emails: { send } },
        deps: { db },
      }
    )

    expect((result as { duplicate?: boolean; skipped?: boolean }).duplicate || result.skipped).toBeTruthy()
    expect(send).not.toHaveBeenCalled()
  })

  it('sends payment confirmation once and records provider id', async () => {
    const send = vi.fn(async () => ({ data: { id: 'msg_123' }, error: null }))
    const set = vi.fn(async () => undefined)
    const create = vi.fn(async () => undefined)
    const get = vi.fn(async () => ({ exists: false, data: () => null }))
    const ref = { get, set, create }
    const db = {
      collection: () => ({
        doc: () => ref,
      }),
    }

    const tx = await import('@/lib/services/transactionalEmailService')
    const result = await tx.sendAttendancePaymentConfirmation(
      {
        id: 'req-2',
        smeEmail: 'sme@example.com',
        smeId: 'sme-1',
        tenderTitle: 'ICT Equipment',
        tenderNumber: 'RFQ-1',
        paymentAmount: 24900,
        paymentStatus: 'paid',
      },
      {
        env: { RESEND_API_KEY: 're_test', NEXT_PUBLIC_SITE_URL: 'https://www.tenderbriefing.co.za' },
        resendClient: { emails: { send } },
        deps: { db },
      }
    )

    expect(result.sent).toBe(true)
    expect((result as { id?: string }).id).toBe('msg_123')
    expect(send).toHaveBeenCalledTimes(1)
    const payload = (send.mock.calls[0] as unknown as [{ from: string; to: string[]; html: string; text: string }])[0]
    expect(payload.from).toMatch(/tenderbriefing\.co\.za/i)
    expect(payload.to).toEqual(['sme@example.com'])
    expect(payload.html).toMatch(/Payment received/i)
    expect(payload.text).toMatch(/confirmed/i)
  })

  it('does not send when RESEND_API_KEY missing', async () => {
    const tx = await import('@/lib/services/transactionalEmailService')
    const result = await tx.sendSmeWelcomeEmail(
      { to: 'a@b.com', displayName: 'A', uid: 'u1' },
      { env: {}, deps: { db: null } }
    )
    expect(result.sent).toBe(false)
    expect(result.skipped).toBe(true)
  })
})
