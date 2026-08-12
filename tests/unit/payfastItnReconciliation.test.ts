/**
 * PayFast ITN + reconciliation regression — JSON storage, no Firebase/PayFast network.
 */
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { createRequire } from 'module'
import path from 'path'
import fs from 'fs'
import crypto from 'crypto'

const require = createRequire(import.meta.url)

function pfEncode(value: string): string {
  return encodeURIComponent(String(value).trim())
    .replace(/%20/g, '+')
    .replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)
}

function signItn(fields: Record<string, string>, passphrase: string): string {
  let paramString = ''
  for (const [key, value] of Object.entries(fields)) {
    paramString += `${key}=${pfEncode(value)}&`
  }
  paramString = paramString.slice(0, -1) + `&passphrase=${pfEncode(passphrase)}`
  return crypto.createHash('md5').update(paramString).digest('hex')
}

describe('PayFast ITN → paid → once dispatch', () => {
  const requestsFile = path.join(
    __dirname,
    '../../backend/data/attendance-requests.json'
  )
  let backup: string | null = null
  let paymentService: any
  let payfastService: any

  beforeEach(() => {
    process.env.STORAGE_ADAPTER = 'json'
    process.env.RATE_LIMIT_BACKEND = 'memory'
    process.env.PAYFAST_MERCHANT_ID = '10000100'
    process.env.PAYFAST_PASSPHRASE = 'test-passphrase-itn'

    if (fs.existsSync(requestsFile)) {
      backup = fs.readFileSync(requestsFile, 'utf8')
    }
    fs.mkdirSync(path.dirname(requestsFile), { recursive: true })
    fs.writeFileSync(requestsFile, '[]\n', 'utf8')

    const keys = Object.keys(require.cache).filter(
      (k) =>
        k.includes('storageAdapter') ||
        k.includes('attendancePaymentService') ||
        k.includes('payfastService') ||
        k.includes('workflowAutomationService') ||
        k.includes('auditLogService') ||
        k.includes('lifecycleEnforcement')
    )
    for (const k of keys) delete require.cache[k]

    const storageMod = require('../../backend/services/storageAdapter')
    if (typeof storageMod.resetStorage === 'function') storageMod.resetStorage()

    const workflow = require('../../backend/services/workflowAutomationService')
    workflow.dispatchWorkflowEvent = vi.fn(async () => ({ status: 'completed' }))
    const audit = require('../../backend/services/auditLogService')
    audit.logEvent = vi.fn(async () => undefined)

    payfastService = require('../../backend/services/integrations/payfastService')
    payfastService.validateItnWithPayfast = vi.fn(async () => ({ ok: true, raw: 'VALID' }))
    payfastService.queryTransactionByPfPaymentId = vi.fn()

    paymentService = require('../../backend/services/payments/attendancePaymentService')

    const seed = {
      id: 'req-1786562638424-6nlcb3',
      smeId: 'sme-1',
      status: 'pending',
      paymentStatus: 'pending',
      paymentAmount: 24900,
      quotedFee: 24900,
      currency: 'ZAR',
      paymentReference: 'TB-REQ-req-1786562638424-6nlcb3',
      payfastPaymentId: null,
      notifiedAgents: ['a1', 'a2'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    fs.writeFileSync(requestsFile, JSON.stringify([seed], null, 2), 'utf8')
  })

  afterEach(() => {
    if (backup != null) fs.writeFileSync(requestsFile, backup, 'utf8')
    else if (fs.existsSync(requestsFile)) fs.writeFileSync(requestsFile, '[]\n', 'utf8')
  })

  function completeItn(overrides: Record<string, string> = {}) {
    const posted: Record<string, string> = {
      m_payment_id: 'TB-REQ-req-1786562638424-6nlcb3',
      pf_payment_id: '320990497',
      payment_status: 'COMPLETE',
      item_name: 'Compulsory briefing attendance support',
      item_description: '',
      amount_gross: '249.00',
      amount_fee: '-11.46',
      amount_net: '237.54',
      custom_str1: 'req-1786562638424-6nlcb3',
      custom_str2: '',
      custom_str3: '',
      name_first: '',
      name_last: '',
      email_address: 'buyer@example.com',
      merchant_id: '10000100',
      ...overrides,
    }
    posted.signature = signItn(
      Object.fromEntries(Object.entries(posted).filter(([k]) => k !== 'signature')),
      process.env.PAYFAST_PASSPHRASE as string
    )
    return posted
  }

  it('COMPLETE ITN with empty fields marks paid and dispatches exactly once', async () => {
    const workflow = require('../../backend/services/workflowAutomationService')
    const first = await paymentService.processPayfastItn(completeItn())
    expect(first.ok).toBe(true)
    expect(first.paymentStatus).toBe('paid')
    expect(workflow.dispatchWorkflowEvent).toHaveBeenCalledTimes(1)
    expect(workflow.dispatchWorkflowEvent).toHaveBeenCalledWith(
      'request_paid',
      expect.objectContaining({ id: 'req-1786562638424-6nlcb3' })
    )

    const second = await paymentService.processPayfastItn(completeItn())
    expect(second.duplicate).toBe(true)
    expect(workflow.dispatchWorkflowEvent).toHaveBeenCalledTimes(1)
  })

  it('rejects invalid signature without marking paid', async () => {
    const posted = completeItn()
    posted.signature = 'deadbeef'
    const result = await paymentService.processPayfastItn(posted)
    expect(result.ok).toBe(false)
    expect(result.reason).toMatch(/Invalid ITN signature/i)
    const stored = JSON.parse(fs.readFileSync(requestsFile, 'utf8'))
    expect(stored[0].paymentStatus).toBe('pending')
  })

  it('rejects wrong amount', async () => {
    const result = await paymentService.processPayfastItn(
      completeItn({ amount_gross: '1.00' })
    )
    expect(result.paymentStatus).toBe('failed')
    const workflow = require('../../backend/services/workflowAutomationService')
    expect(workflow.dispatchWorkflowEvent).not.toHaveBeenCalledWith(
      'request_paid',
      expect.anything()
    )
  })

  it('rejects unknown payment reference', async () => {
    fs.writeFileSync(requestsFile, '[]\n', 'utf8')
    const result = await paymentService.processPayfastItn(
      completeItn({
        m_payment_id: 'TB-REQ-missing',
        custom_str1: 'missing',
      })
    )
    expect(result.handled).toBe(false)
    expect(result.reason).toMatch(/No matching/i)
  })

  it('rejects wrong merchant', async () => {
    const result = await paymentService.processPayfastItn(
      completeItn({ merchant_id: '99999999' })
    )
    expect(result.ok).toBe(false)
    expect(result.reason).toMatch(/Merchant ID mismatch/i)
  })

  it('handles FAILED and CANCELLED without paid transition', async () => {
    const workflow = require('../../backend/services/workflowAutomationService')
    const failed = await paymentService.processPayfastItn(
      completeItn({ payment_status: 'FAILED', pf_payment_id: '1' })
    )
    expect(failed.paymentStatus).toBe('failed')

    const seed2 = {
      id: 'req-2',
      smeId: 'sme-1',
      status: 'pending',
      paymentStatus: 'pending',
      paymentAmount: 24900,
      quotedFee: 24900,
      currency: 'ZAR',
      paymentReference: 'TB-REQ-req-2',
      payfastPaymentId: null,
      notifiedAgents: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    fs.writeFileSync(requestsFile, JSON.stringify([seed2], null, 2), 'utf8')

    const cancelled = await paymentService.processPayfastItn(
      completeItn({
        payment_status: 'CANCELLED',
        pf_payment_id: '2',
        m_payment_id: 'TB-REQ-req-2',
        custom_str1: 'req-2',
      })
    )
    expect(cancelled.paymentStatus).toBe('failed')
    expect(workflow.dispatchWorkflowEvent).not.toHaveBeenCalledWith(
      'request_paid',
      expect.anything()
    )
  })

  it('reconciles when PayFast process/query confirms COMPLETE R249', async () => {
    payfastService.queryTransactionByPfPaymentId.mockResolvedValue({
      ok: true,
      pfPaymentId: '320990497',
      mPaymentId: 'TB-REQ-req-1786562638424-6nlcb3',
      status: 'COMPLETE',
      amountCents: 24900,
    })
    const audit = require('../../backend/services/auditLogService')
    const workflow = require('../../backend/services/workflowAutomationService')

    const result = await paymentService.reconcileAuthoritativePayfastPayment({
      requestId: 'req-1786562638424-6nlcb3',
      pfPaymentId: '320990497',
      reason: 'itn_signature_mismatch_reconciliation',
    })

    expect(result.ok).toBe(true)
    expect(result.paymentStatus).toBe('paid')
    expect(workflow.dispatchWorkflowEvent).toHaveBeenCalledTimes(1)
    expect(audit.logEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'payment_reconciled',
        pfPaymentId: '320990497',
        verificationSource: 'payfast_process_query',
      })
    )
  })

  it('refuses reconcile without COMPLETE evidence', async () => {
    payfastService.queryTransactionByPfPaymentId.mockResolvedValue({
      ok: true,
      status: 'PENDING',
      mPaymentId: 'TB-REQ-req-1786562638424-6nlcb3',
      amountCents: 24900,
      pfPaymentId: '320990497',
    })
    const result = await paymentService.reconcileAuthoritativePayfastPayment({
      requestId: 'req-1786562638424-6nlcb3',
      pfPaymentId: '320990497',
    })
    expect(result.ok).toBe(false)
  })

  it('is idempotent when already paid for same pf_payment_id', async () => {
    const seed = JSON.parse(fs.readFileSync(requestsFile, 'utf8'))
    seed[0].paymentStatus = 'paid'
    seed[0].payfastPaymentId = '320990497'
    fs.writeFileSync(requestsFile, JSON.stringify(seed, null, 2), 'utf8')

    const result = await paymentService.reconcileAuthoritativePayfastPayment({
      requestId: 'req-1786562638424-6nlcb3',
      pfPaymentId: '320990497',
    })
    expect(result.ok).toBe(true)
    expect(result.duplicate).toBe(true)
    expect(payfastService.queryTransactionByPfPaymentId).not.toHaveBeenCalled()
  })
})
