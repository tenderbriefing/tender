/**
 * Founder-only R75 live certification — must not weaken commercial R750.
 */
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { createRequire } from 'module'
import path from 'path'
import fs from 'fs'
import {
  BRIEFING_PRICE_CENTS,
  LIVE_CERTIFICATION_AMOUNT_CENTS,
} from '@/lib/domain/briefingPricing'

const require = createRequire(import.meta.url)

describe('payfastLiveCertificationService', () => {
  const requestsFile = path.join(
    __dirname,
    '../../backend/data/attendance-requests.json'
  )
  const gateFile = path.join(
    __dirname,
    '../../backend/data/payfast-live-certification-gate.json'
  )
  let backup: string | null = null
  let gateBackup: string | null = null
  let service: any

  beforeEach(() => {
    process.env.STORAGE_ADAPTER = 'json'
    process.env.RATE_LIMIT_BACKEND = 'memory'
    delete process.env.ATTENDANCE_FEE_CENTS

    if (fs.existsSync(requestsFile)) {
      backup = fs.readFileSync(requestsFile, 'utf8')
    }
    if (fs.existsSync(gateFile)) {
      gateBackup = fs.readFileSync(gateFile, 'utf8')
    }
    fs.mkdirSync(path.dirname(requestsFile), { recursive: true })
    fs.writeFileSync(requestsFile, '[]\n', 'utf8')
    if (fs.existsSync(gateFile)) fs.unlinkSync(gateFile)

    const keys = Object.keys(require.cache).filter(
      (k) =>
        k.includes('storageAdapter') ||
        k.includes('agentAssignmentService') ||
        k.includes('attendancePaymentService') ||
        k.includes('payfastLiveCertification') ||
        k.includes('briefingPricing') ||
        k.includes('payfastService') ||
        k.includes('auditLogService') ||
        k.includes('lifecycleEnforcement')
    )
    for (const k of keys) delete require.cache[k]

    const audit = require('../../backend/services/auditLogService')
    audit.logEvent = async () => {}

    const payfastService = require('../../backend/services/integrations/payfastService')
    payfastService.createCheckoutPayload = vi.fn(
      ({ amountCents, mPaymentId }: any) => ({
        ok: true,
        skipped: false,
        formAction: 'https://www.payfast.co.za/eng/process',
        fields: {
          amount: (amountCents / 100).toFixed(2),
          m_payment_id: mPaymentId,
          signature: 'test',
        },
        sandbox: false,
      })
    )

    service = require('../../backend/services/payments/payfastLiveCertificationService')
  })

  afterEach(() => {
    if (backup != null) fs.writeFileSync(requestsFile, backup, 'utf8')
    else if (fs.existsSync(requestsFile)) fs.writeFileSync(requestsFile, '[]\n', 'utf8')
    if (gateBackup != null) fs.writeFileSync(gateFile, gateBackup, 'utf8')
    else if (fs.existsSync(gateFile)) fs.unlinkSync(gateFile)
  })

  it('creates a server-locked R75 certification booking without changing R750', async () => {
    expect(BRIEFING_PRICE_CENTS).toBe(75000)
    expect(LIVE_CERTIFICATION_AMOUNT_CENTS).toBe(7500)

    const created = await service.createLiveCertificationBooking({
      uid: 'founder-1',
      email: 'info@tenderbriefing.co.za',
    })

    expect(created.amountCents).toBe(7500)
    expect(created.commercialPriceCents).toBe(75000)
    expect(created.request.serverAuthorizedCertification).toBe(true)
    expect(created.request.paymentAmount).toBe(7500)
    expect(created.request.purpose).toBe('payfast_live_certification')
    expect(created.paymentUrl).toContain('/pay/')

    const checkout = await service.createCheckoutForCertificationToken(
      created.request.paymentToken,
      'https://www.tenderbriefing.co.za'
    )
    expect(checkout.ok).toBe(true)
    expect(checkout.amountCents).toBe(7500)
    expect(checkout.fields.amount).toBe('75.00')
  })

  it('refuses a second certification creation (single-use gate)', async () => {
    await service.createLiveCertificationBooking({
      uid: 'founder-1',
      email: 'info@tenderbriefing.co.za',
    })
    await expect(
      service.createLiveCertificationBooking({
        uid: 'founder-1',
        email: 'info@tenderbriefing.co.za',
      })
    ).rejects.toThrow(/single-use|already created/i)
  })
})
