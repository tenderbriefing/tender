/**
 * Extended manual briefing request fields + pricing authority.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRequire } from 'module'
import path from 'path'
import fs from 'fs'

const require = createRequire(import.meta.url)

describe('manual briefing request extensions', () => {
  const requestsFile = path.join(
    __dirname,
    '../../backend/data/attendance-requests.json'
  )
  let backup: string | null = null
  let service: any

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
        k.includes('manualPaymentBookingService') ||
        k.includes('briefingPricing') ||
        k.includes('manualBriefingOps') ||
        k.includes('auditLogService')
    )
    for (const k of keys) delete require.cache[k]

    const audit = require('../../backend/services/auditLogService')
    audit.logEvent = async () => {}

    service = require('../../backend/services/payments/manualPaymentBookingService')
  })

  afterEach(() => {
    if (backup != null) fs.writeFileSync(requestsFile, backup, 'utf8')
    else if (fs.existsSync(requestsFile)) fs.writeFileSync(requestsFile, '[]\n', 'utf8')
  })

  it('creates request without catalogue tender + representation + docs + RFQ fields', async () => {
    const result = await service.createManualPaymentRequest(
      {
        companyName: 'Paying SME (Pty) Ltd',
        contactPerson: 'Thabo',
        customerEmail: 'thabo@paying-sme.test',
        customerPhone: '+27820000000',
        representedEntity: 'Bidding Entity Co',
        linkedSmeId: 'sme-existing-1',
        briefings: [
          {
            tenderNumber: 'RFQ-NO-CATALOGUE-001',
            tenderDescription: 'Outside catalogue works',
            procuringEntity: 'City of Tshwane',
            briefingDate: '2026-10-20',
            briefingTime: '10:00',
            briefingVenue: 'Tshwane Civic',
            province: 'Gauteng',
            closingDate: '2026-10-30',
            closingTime: '11:00',
            contactPerson: 'Buyer Contact',
            contactPhone: '+27120000000',
            contactEmail: 'buyer@cot.gov.za',
            notes: 'Compulsory',
          },
        ],
        documents: [
          { kind: 'rfq', name: 'rfq.pdf', url: 'https://files.example/rfq.pdf' },
          { kind: 'loa', name: 'loa.pdf', url: 'https://files.example/loa.pdf' },
        ],
        paymentAmount: 1,
        total: 1,
        unitPrice: 1,
        quantity: 99,
      },
      { uid: 'admin-1', email: 'info@tenderbriefing.co.za' }
    )

    const req = result.request
    expect(req.catalogueTenderRequired).toBe(false)
    expect(req.tenderId).toBeFalsy()
    expect(req.representedEntity).toBe('Bidding Entity Co')
    expect(req.linkedSmeId).toBe('sme-existing-1')
    expect(req.paymentAmount).toBe(75000)
    expect(req.briefingPriceCents).toBe(75000)
    expect(req.loaStatus).toBe('received')
    expect(req.documents).toHaveLength(2)
    expect(req.briefingLines[0].province).toBe('Gauteng')
    expect(req.briefingLines[0].closingDate).toBe('2026-10-30')
    expect(req.briefingLines[0].contactEmail).toBe('buyer@cot.gov.za')
    expect(req.opsStage).toBe('payment_required')
    expect(result.paymentUrl).toMatch(/\/pay\//)
    expect(result.invoiceNumber).toMatch(/^TB-INV-/)
  })

  it('four briefings charge R3,000 server-side', async () => {
    const { resolveRequestChargeCents } = require('../../backend/constants/briefingPricing')

    const briefings = [1, 2, 3, 4].map((n) => ({
      tenderNumber: `RFQ-${n}`,
      tenderDescription: `Line ${n}`,
      briefingDate: `2026-10-${19 + n}`,
      briefingVenue: 'Venue',
      province: 'Gauteng',
    }))

    const result = await service.createManualPaymentRequest(
      {
        companyName: 'Multi SME',
        customerEmail: 'multi@example.test',
        briefings,
      },
      { uid: 'admin-1' }
    )

    expect(result.request.briefingCount).toBe(4)
    expect(result.request.paymentAmount).toBe(300000)
    expect(resolveRequestChargeCents(result.request)).toBe(300000)

    const admin = service.toAdminView(result.request)
    expect(admin.opsStage).toBe('payment_required')
    expect(admin.urgencyFlags).toContain('missing_loa')
  })
})
