/**
 * Phase 15 — assignment dispatch → accept/decline/expiry + privacy/IDOR guards.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import path from 'path'
import fs from 'fs'
import os from 'os'
import {
  resolveCustomerBookingStatus,
  customerBookingStatusLabel,
} from '../../lib/domain/customerBookingStatus'
import { isPublicApiRoute } from '../../lib/security/apiRoutePolicy'

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'phase15-assign-'))
process.env.STORAGE_ADAPTER = 'json'
process.env.JSON_DATA_DIR = tmpRoot
;(process.env as { NODE_ENV?: string }).NODE_ENV = 'test'
process.env.RESEND_API_KEY = ''

vi.mock('../../backend/services/auditLogService', () => ({
  logEvent: vi.fn(async () => ({})),
}))

describe('Phase 15 assignment dispatch lifecycle', () => {
  beforeEach(() => {
    for (const f of fs.readdirSync(tmpRoot)) {
      fs.rmSync(path.join(tmpRoot, f), { recursive: true, force: true })
    }
  })

  async function seedPaidRequest(overrides: Record<string, unknown> = {}) {
    const storage = require('../../backend/services/storageAdapter').getStorage()
    const id = `req-phase15-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    // Keep briefing >48h away so assigned does not collapse to briefing_due
    const later = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000)
    const yyyy = later.toISOString().slice(0, 10)
    const doc = {
      id,
      smeId: 'sme-a',
      smeCompany: 'Acme SME',
      smeEmail: 'sme-a@example.com',
      tenderNumber: 'RFQ-15',
      tenderTitle: 'Phase 15 canary',
      briefingDate: yyyy,
      briefingTime: '10:00',
      briefingVenue: 'Cape Town Civic',
      province: 'Western Cape',
      paymentStatus: 'paid',
      paidAt: new Date().toISOString(),
      opsStage: 'assignment_required',
      status: 'pending',
      ...overrides,
    }
    await storage.saveAttendanceRequest(doc)
    return doc
  }

  it('dispatches → assignment_pending, then accept → assigned once', async () => {
    const paid = await seedPaidRequest()
    const dispatch = require('../../backend/services/ops/assignmentDispatchService')
    const { deriveManualOpsStage } = require('../../backend/domain/manualBriefingOps')

    const first = await dispatch.dispatchRepresentative(
      paid.id,
      {
        representativeName: 'Thabo Rep',
        representativeEmail: 'thabo-cert@example.com',
        representativePhone: '0820000001',
        agentPayoutCents: 40000,
      },
      { uid: 'admin-1', email: 'ops@tenderbriefing.co.za' }
    )
    expect(first.alreadyDispatched).toBe(false)
    expect(first.request.opsStage).toBe('assignment_pending')
    expect(first.request.assignmentSubstate).toBe('dispatch_sent')
    expect(first.request.representativeName).toBeNull()
    expect(first._testToken).toBeTruthy()
    expect(deriveManualOpsStage(first.request)).toBe('assignment_pending')

    const again = await dispatch.dispatchRepresentative(
      paid.id,
      {
        representativeName: 'Thabo Rep',
        representativeEmail: 'thabo-cert@example.com',
        agentPayoutCents: 40000,
      },
      { uid: 'admin-1', email: 'ops@tenderbriefing.co.za' }
    )
    expect(again.alreadyDispatched).toBe(true)

    const accepted = await dispatch.acceptDispatch(paid.id, { token: first._testToken })
    expect(accepted.alreadyAccepted).toBe(false)
    expect(accepted.request.opsStage).toBe('assigned')
    expect(accepted.request.assignmentSubstate).toBe('accepted')
    expect(accepted.request.representativeName).toBe('Thabo Rep')
    expect(accepted.request.agentPayoutCents).toBe(40000)

    const replay = await dispatch.acceptDispatch(paid.id, { token: first._testToken })
    expect(replay.alreadyAccepted).toBe(true)
  })

  it('decline returns to assignment_required / reassignment_required', async () => {
    const paid = await seedPaidRequest()
    const dispatch = require('../../backend/services/ops/assignmentDispatchService')

    const first = await dispatch.dispatchRepresentative(
      paid.id,
      {
        representativeName: 'Decliner',
        representativeEmail: 'decline-cert@example.com',
        agentPayoutCents: 45000,
      },
      { uid: 'admin-1', email: 'ops@tenderbriefing.co.za' }
    )

    const declined = await dispatch.declineDispatch(paid.id, {
      token: first._testToken,
      reason: 'Unavailable that morning',
    })
    expect(declined.request.opsStage).toBe('assignment_required')
    expect(declined.request.assignmentSubstate).toBe('reassignment_required')
    expect(declined.request.assignmentDeclineReason).toMatch(/Unavailable/)

    const replay = await dispatch.declineDispatch(paid.id, { token: first._testToken })
    expect(replay.alreadyDeclined).toBe(true)

    // Second representative can be dispatched and accept
    const second = await dispatch.dispatchRepresentative(
      paid.id,
      {
        representativeName: 'Replacement',
        representativeEmail: 'replace-cert@example.com',
        agentPayoutCents: 50000,
      },
      { uid: 'admin-1', email: 'ops@tenderbriefing.co.za' }
    )
    expect(second.alreadyDispatched).toBe(false)
    const accepted = await dispatch.acceptDispatch(paid.id, { token: second._testToken })
    expect(accepted.request.opsStage).toBe('assigned')
    expect(accepted.request.representativeName).toBe('Replacement')
    expect(accepted.request.agentPayoutCents).toBe(50000)
  })

  it('expiry marks reassignment_required without assigning', async () => {
    const paid = await seedPaidRequest()
    const dispatch = require('../../backend/services/ops/assignmentDispatchService')

    const first = await dispatch.dispatchRepresentative(
      paid.id,
      {
        representativeName: 'Slow Rep',
        representativeEmail: 'slow-cert@example.com',
        agentPayoutCents: 40000,
      },
      { uid: 'admin-1', email: 'ops@tenderbriefing.co.za' }
    )

    // Force deadline into the past
    const storage = require('../../backend/services/storageAdapter').getStorage()
    const doc = await dispatch.getRequest(paid.id)
    doc.assignmentAcceptanceDeadlineAt = new Date(Date.now() - 60_000).toISOString()
    await storage.saveAttendanceRequest(doc)

    const expired = await dispatch.expireDispatchIfNeeded(paid.id)
    expect(expired.opsStage).toBe('assignment_required')
    expect(expired.assignmentSubstate).toBe('reassignment_required')
    expect(expired.representativeName).toBeFalsy()

    await expect(
      dispatch.acceptDispatch(paid.id, { token: first._testToken })
    ).rejects.toThrow(/No active dispatch|expired|Invalid/i)
  })

  it('rejects invalid token and cross-request misuse', async () => {
    const a = await seedPaidRequest()
    const b = await seedPaidRequest({ smeId: 'sme-b', smeEmail: 'sme-b@example.com' })
    const dispatch = require('../../backend/services/ops/assignmentDispatchService')

    const da = await dispatch.dispatchRepresentative(
      a.id,
      {
        representativeName: 'A Rep',
        representativeEmail: 'a-rep@example.com',
        agentPayoutCents: 40000,
      },
      { uid: 'admin-1' }
    )
    await dispatch.dispatchRepresentative(
      b.id,
      {
        representativeName: 'B Rep',
        representativeEmail: 'b-rep@example.com',
        agentPayoutCents: 40000,
      },
      { uid: 'admin-1' }
    )

    await expect(dispatch.acceptDispatch(a.id, { token: 'forged-token' })).rejects.toThrow(
      /Invalid|expired/i
    )
    // Token for A must not accept B
    await expect(dispatch.acceptDispatch(b.id, { token: da._testToken })).rejects.toThrow(
      /Invalid|expired/i
    )
  })

  it('customer status never exposes payout; pending maps to arranging', async () => {
    expect(
      resolveCustomerBookingStatus({
        paymentStatus: 'paid',
        opsStage: 'assignment_pending',
      })
    ).toBe('representative_arranging')
    expect(
      resolveCustomerBookingStatus({
        paymentStatus: 'paid',
        opsStage: 'assigned',
        assignedAgentId: 'ya-1',
      })
    ).toBe('representative_confirmed')
    expect(customerBookingStatusLabel('representative_confirmed')).toMatch(/confirmed/i)
    expect(customerBookingStatusLabel('representative_arranging')).not.toMatch(/payout|R400|assignment_pending/i)
  })

  it('SLA surfaces response pending / overdue and keeps UNASSIGNED_APPROACHING', async () => {
    const { evaluateOpsSla, EXCEPTION_CODES } = require('../../backend/domain/opsSlaEngine')
    // Fixed offset from now — avoid UTC hour+2 wrap producing invalid "24:00"/"25:00".
    const approaching = new Date(Date.now() + 6 * 60 * 60 * 1000)
    const date = approaching.toISOString().slice(0, 10)
    const time = `${String(approaching.getUTCHours()).padStart(2, '0')}:${String(approaching.getUTCMinutes()).padStart(2, '0')}`

    const pending = evaluateOpsSla({
      paymentStatus: 'paid',
      opsStage: 'assignment_pending',
      assignmentSubstate: 'dispatch_sent',
      assignmentAcceptanceDeadlineAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
      briefingDate: date,
      briefingTime: '18:00',
    })
    expect(pending.allExceptionCodes).toContain(EXCEPTION_CODES.REPRESENTATIVE_RESPONSE_PENDING)

    const overdue = evaluateOpsSla({
      paymentStatus: 'paid',
      opsStage: 'assignment_pending',
      assignmentSubstate: 'dispatch_sent',
      assignmentAcceptanceDeadlineAt: new Date(Date.now() - 60_000).toISOString(),
      briefingDate: date,
      briefingTime: '18:00',
    })
    expect(overdue.allExceptionCodes).toContain(EXCEPTION_CODES.REPRESENTATIVE_RESPONSE_OVERDUE)

    const unassigned = evaluateOpsSla({
      paymentStatus: 'paid',
      opsStage: 'assignment_required',
      briefingDate: date,
      briefingTime: time,
    })
    expect(unassigned.allExceptionCodes).toContain(EXCEPTION_CODES.UNASSIGNED_APPROACHING_BRIEFING)
  })

  it('force assign still stamps assigned (offline confirm)', async () => {
    const paid = await seedPaidRequest()
    const ops = require('../../backend/services/ops/opsLifecycleService')
    const saved = await ops.assignManualRepresentative(
      paid.id,
      { representativeName: 'Offline Rep', agentPayoutCents: 40000 },
      { uid: 'admin-1', email: 'ops@tenderbriefing.co.za' }
    )
    expect(saved.opsStage).toBe('assigned')
    expect(saved.assignmentSubstate).toBe('accepted')
    expect(ops.deriveManualOpsStage(saved)).toBe('assigned')
  })

  it('acceptance deadline urgency tightens near briefing', () => {
    const { computeAcceptanceDeadline, ACCEPTANCE_URGENCY } = require('../../backend/domain/assignmentDispatch')
    const now = new Date('2026-10-16T10:00:00+02:00')
    const critical = computeAcceptanceDeadline(
      { briefingDate: '2026-10-16', briefingTime: '14:00' },
      now
    )
    expect(critical.urgency).toBe(ACCEPTANCE_URGENCY.CRITICAL)

    const normal = computeAcceptanceDeadline(
      { briefingDate: '2026-10-20', briefingTime: '10:00' },
      now
    )
    expect(normal.urgency).toBe(ACCEPTANCE_URGENCY.NORMAL)
  })

  it('public API allowlists assignment respond', () => {
    expect(isPublicApiRoute('/api/assignments/respond', 'GET')).toBe(true)
    expect(isPublicApiRoute('/api/assignments/respond', 'POST')).toBe(true)
    expect(isPublicApiRoute('/api/admin/ops/board', 'GET')).toBe(false)
  })
})
