#!/usr/bin/env node
/**
 * Phase 15 synthetic canary — NO PayFast charge.
 * Seeds a PAID attendanceRequest in JSON storage and certifies:
 *   accept path | decline/reassign path | expiry path
 */
const path = require('path')
const fs = require('fs')
const os = require('os')

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'phase15-canary-'))
process.env.STORAGE_ADAPTER = 'json'
process.env.JSON_DATA_DIR = tmpRoot
process.env.NODE_ENV = 'test'
process.env.RESEND_API_KEY = ''

async function seedPaid(label) {
  const storage = require('../backend/services/storageAdapter').getStorage()
  const id = `req-p15-canary-${label}-${Date.now()}`
  const later = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000)
  const doc = {
    id,
    smeId: 'canary-sme',
    smeCompany: 'Phase15 Canary Co',
    smeEmail: 'phase15-canary@example.com',
    tenderNumber: `P15-${label.toUpperCase()}`,
    tenderTitle: `Phase 15 ${label} canary`,
    briefingDate: later.toISOString().slice(0, 10),
    briefingTime: '11:00',
    briefingVenue: 'Canary Venue',
    province: 'Gauteng',
    paymentStatus: 'paid',
    paidAt: new Date().toISOString(),
    opsStage: 'assignment_required',
    status: 'pending',
    briefingPriceCents: 75000,
  }
  await storage.saveAttendanceRequest(doc)
  return doc
}

async function main() {
  const dispatch = require('../backend/services/ops/assignmentDispatchService')
  const { BRIEFING_PRICE_CENTS } = require('../backend/constants/briefingPricing')
  const report = {
    briefingPriceCents: BRIEFING_PRICE_CENTS,
    accept: null,
    declineReassign: null,
    expiry: null,
  }

  // A — accept path
  {
    const paid = await seedPaid('accept')
    const d = await dispatch.dispatchRepresentative(
      paid.id,
      {
        representativeName: 'Canary Acceptor',
        representativeEmail: 'phase15-acceptor@example.com',
        agentPayoutCents: 40000,
      },
      { uid: 'canary-admin', email: 'ops-canary@example.com' }
    )
    const a = await dispatch.acceptDispatch(paid.id, { token: d._testToken })
    report.accept = {
      requestId: paid.id,
      opsStage: a.request.opsStage,
      substate: a.request.assignmentSubstate,
      representativeName: a.request.representativeName,
      pass:
        a.request.opsStage === 'assigned' &&
        a.request.assignmentSubstate === 'accepted' &&
        a.request.representativeName === 'Canary Acceptor',
    }
  }

  // B — decline → reassign → accept
  {
    const paid = await seedPaid('decline')
    const d1 = await dispatch.dispatchRepresentative(
      paid.id,
      {
        representativeName: 'Canary Decliner',
        representativeEmail: 'phase15-decliner@example.com',
        agentPayoutCents: 40000,
      },
      { uid: 'canary-admin' }
    )
    await dispatch.declineDispatch(paid.id, { token: d1._testToken, reason: 'canary decline' })
    const d2 = await dispatch.dispatchRepresentative(
      paid.id,
      {
        representativeName: 'Canary Replacement',
        representativeEmail: 'phase15-replacement@example.com',
        agentPayoutCents: 50000,
      },
      { uid: 'canary-admin' }
    )
    const a = await dispatch.acceptDispatch(paid.id, { token: d2._testToken })
    report.declineReassign = {
      requestId: paid.id,
      opsStage: a.request.opsStage,
      representativeName: a.request.representativeName,
      payoutCents: a.request.agentPayoutCents,
      historyEvents: (a.request.assignmentHistory || []).map((h) => h.event),
      pass:
        a.request.opsStage === 'assigned' &&
        a.request.representativeName === 'Canary Replacement' &&
        a.request.agentPayoutCents === 50000,
    }
  }

  // C — expiry
  {
    const paid = await seedPaid('expiry')
    const d = await dispatch.dispatchRepresentative(
      paid.id,
      {
        representativeName: 'Canary Expirer',
        representativeEmail: 'phase15-expirer@example.com',
        agentPayoutCents: 40000,
      },
      { uid: 'canary-admin' }
    )
    const storage = require('../backend/services/storageAdapter').getStorage()
    const doc = await dispatch.getRequest(paid.id)
    doc.assignmentAcceptanceDeadlineAt = new Date(Date.now() - 120_000).toISOString()
    await storage.saveAttendanceRequest(doc)
    const expired = await dispatch.expireDispatchIfNeeded(paid.id)
    let acceptBlocked = false
    try {
      await dispatch.acceptDispatch(paid.id, { token: d._testToken })
    } catch {
      acceptBlocked = true
    }
    report.expiry = {
      requestId: paid.id,
      opsStage: expired.opsStage,
      substate: expired.assignmentSubstate,
      acceptBlocked,
      pass:
        expired.opsStage === 'assignment_required' &&
        expired.assignmentSubstate === 'reassignment_required' &&
        acceptBlocked,
    }
  }

  report.pass =
    report.briefingPriceCents === 75000 &&
    report.accept.pass &&
    report.declineReassign.pass &&
    report.expiry.pass

  const out = path.join(process.cwd(), 'tmp-phase15-assignment-canary.json')
  fs.writeFileSync(out, JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report, null, 2))
  if (!report.pass) process.exit(1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
