/**
 * P0 payment authority — server-side charge + entitlement regression.
 * Covers ATTACK 10–13 beyond Firestore rules (API/Admin SDK path).
 */
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { createRequire } from 'module'
import path from 'path'
import fs from 'fs'
import {
  BRIEFING_PRICE_CENTS,
  resolveRequestChargeCents,
} from '@/lib/domain/briefingPricing'

const require = createRequire(import.meta.url)

describe('payment authority — charge + entitlement', () => {
  const requestsFile = path.join(
    __dirname,
    '../../backend/data/attendance-requests.json'
  )
  let backup: string | null = null
  let agentService: any
  let paymentService: any
  let payfastService: any

  beforeEach(() => {
    process.env.STORAGE_ADAPTER = 'json'
    process.env.RATE_LIMIT_BACKEND = 'memory'
    delete process.env.ATTENDANCE_FEE_CENTS

    if (fs.existsSync(requestsFile)) {
      backup = fs.readFileSync(requestsFile, 'utf8')
    }
    fs.mkdirSync(path.dirname(requestsFile), { recursive: true })
    fs.writeFileSync(requestsFile, '[]\n', 'utf8')

    const keys = Object.keys(require.cache).filter(
      (k) =>
        k.includes('storageAdapter') ||
        k.includes('agentAssignmentService') ||
        k.includes('attendancePaymentService') ||
        k.includes('payfastService') ||
        k.includes('briefingPricing') ||
        k.includes('liveDispatchService') ||
        k.includes('workflowAutomationService') ||
        k.includes('auditLogService') ||
        k.includes('lifecycleEnforcement')
    )
    for (const k of keys) delete require.cache[k]

    const liveDispatch = require('../../backend/services/liveDispatchService')
    liveDispatch.findBestAgentsForRequest = async () => []
    const workflow = require('../../backend/services/workflowAutomationService')
    workflow.dispatchWorkflowEvent = async () => {}
    const audit = require('../../backend/services/auditLogService')
    audit.logEvent = async () => {}

    payfastService = require('../../backend/services/integrations/payfastService')
    payfastService.createCheckoutPayload = vi.fn(({ amountCents }: { amountCents: number }) => ({
      ok: true,
      skipped: false,
      formAction: 'https://sandbox.payfast.co.za/eng/process',
      fields: { amount: (amountCents / 100).toFixed(2) },
      sandbox: true,
    }))

    agentService = require('../../backend/services/agentAssignmentService')
    paymentService = require('../../backend/services/payments/attendancePaymentService')
  })

  afterEach(() => {
    if (backup != null) fs.writeFileSync(requestsFile, backup, 'utf8')
    else if (fs.existsSync(requestsFile)) fs.writeFileSync(requestsFile, '[]\n', 'utf8')
  })

  it('ATTACK 10: legitimate server createRequest stamps pending + R349 snapshot', async () => {
    const { request } = await agentService.createRequest({
      tenderId: `t-auth-${Date.now()}`,
      tenderNumber: 'TN-AUTH',
      tenderTitle: 'Authority',
      smeId: 'sme-auth',
      smeName: 'SME Auth',
      // Attacker-shaped fields — must be ignored
      paymentStatus: 'not_required',
      paymentAmount: 100,
      briefingPriceCents: 100,
      quotedFee: 100,
    })

    expect(request.paymentStatus).toBe('pending')
    expect(request.paymentAmount).toBe(BRIEFING_PRICE_CENTS)
    expect(request.briefingPriceCents).toBe(BRIEFING_PRICE_CENTS)
    expect(request.quotedFee).toBe(BRIEFING_PRICE_CENTS)
    expect(request.paymentExemptionAuthorized).toBeUndefined()
  })

  it('ATTACK 11: PayFast checkout charges canonical 34900 cents', async () => {
    const { request } = await agentService.createRequest({
      tenderId: `t-chk-${Date.now()}`,
      smeId: 'sme-chk',
      smeName: 'SME',
    })

    const checkout = await paymentService.createCheckoutForExistingRequest(
      request.id,
      'sme-chk',
      'http://localhost:3000'
    )

    expect(checkout.ok).toBe(true)
    expect(payfastService.createCheckoutPayload).toHaveBeenCalledWith(
      expect.objectContaining({ amountCents: 34900 })
    )
    expect(checkout.request.briefingPriceCents).toBe(34900)
    expect(checkout.request.paymentAmount).toBe(34900)
  })

  it('ATTACK 12: manipulated stored price 100¢ still charges 34900 on checkout', async () => {
    const storage = require('../../backend/services/storageAdapter').getStorage()
    const id = `req-corrupt-${Date.now()}`
    await storage.saveAttendanceRequest({
      id,
      smeId: 'sme-corrupt',
      status: 'pending',
      paymentStatus: 'pending',
      paymentAmount: 100,
      quotedFee: 100,
      briefingPriceCents: 100,
      currency: 'ZAR',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })

    expect(resolveRequestChargeCents({
      paymentStatus: 'pending',
      briefingPriceCents: 100,
      paymentAmount: 100,
      quotedFee: 100,
    })).toBe(34900)

    const jsPricing = require('../../backend/constants/briefingPricing')
    expect(
      jsPricing.resolveRequestChargeCents({
        paymentStatus: 'pending',
        briefingPriceCents: 100,
        paymentAmount: 100,
      })
    ).toBe(34900)

    const checkout = await paymentService.createCheckoutForExistingRequest(
      id,
      'sme-corrupt',
      'http://localhost:3000'
    )
    expect(checkout.ok).toBe(true)
    expect(payfastService.createCheckoutPayload).toHaveBeenCalledWith(
      expect.objectContaining({ amountCents: 34900 })
    )
    expect(checkout.request.briefingPriceCents).toBe(34900)
  })

  it('ATTACK 13: SME payload cannot manufacture not_required entitlement', async () => {
    const { request } = await agentService.createRequest({
      tenderId: `t-nr-${Date.now()}`,
      smeId: 'sme-nr',
      paymentStatus: 'not_required',
      paymentExemptionAuthorized: true,
      paymentAmount: 0,
    })

    expect(request.paymentStatus).toBe('pending')
    expect(request.paymentExemptionAuthorized).toBeUndefined()
    expect(paymentService.isPaidForAgents(request.paymentStatus)).toBe(false)

    await expect(
      agentService.acceptRequest(request.id, { id: 'agent-x', displayName: 'X' })
    ).rejects.toThrow(/paid/i)
  })

  it('documents that not_required requires options.allowPaymentExemption (not payload)', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '../../backend/services/agentAssignmentService.js'),
      'utf8'
    )
    expect(src).toMatch(/options\.allowPaymentExemption === true/)
    expect(src).toMatch(/paymentExemptionAuthorized: _paymentExemptionAuthorized/)
    expect(src).toMatch(/Strip money/)
  })

  it('paid historical snapshots remain trusted for accounting', () => {
    expect(
      resolveRequestChargeCents({
        paymentStatus: 'paid',
        briefingPriceCents: 34900,
      })
    ).toBe(34900)
  })
})
