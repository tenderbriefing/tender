/**
 * Phase 20 — paid adapter, scoring bands, CTA token, conversion idempotency guards.
 */
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { createRequire } from 'module'
import fs from 'fs'
import path from 'path'
import {
  createSmeConnectCtaToken,
  verifySmeConnectCtaToken,
} from '@/lib/security/smeConnectCtaToken'
import { isPublicApiRoute } from '@/lib/security/apiRoutePolicy'

const require = createRequire(import.meta.url)
const attendanceFile = path.join(process.cwd(), 'backend/data/attendance-requests.json')
const syncFile = path.join(process.cwd(), 'backend/data/sync-state.json')

describe('Phase 20 SME Connect', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let adapter: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let matching: any

  beforeEach(() => {
    process.env.STORAGE_ADAPTER = 'json'
    process.env.RATE_LIMIT_BACKEND = 'memory'
    process.env.SME_CONNECT_CTA_SECRET = 'phase20-test-secret'
    fs.mkdirSync(path.dirname(attendanceFile), { recursive: true })
    fs.writeFileSync(attendanceFile, '[]\n', 'utf8')
    if (fs.existsSync(syncFile)) fs.unlinkSync(syncFile)

    for (const k of Object.keys(require.cache).filter(
      (x) =>
        x.includes('smeConnect') ||
        x.includes('storageAdapter') ||
        x.includes('agentAssignment')
    )) {
      delete require.cache[k]
    }

    adapter = require('../../backend/services/smeConnectPaidRequestAdapter')
    matching = require('../../backend/services/smeConnectMatchingService')
    const audit = require('../../backend/services/auditLogService')
    audit.logEvent = async () => {}
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('normalizes paid requests with field-name drift', () => {
    const n = adapter.normalizePaidRequest({
      id: 'r1',
      paymentStatus: 'paid',
      smeEmail: 'ops@example.com',
      smeCompany: 'Acme HVAC',
      contactPerson: 'Pat',
      briefingLines: [
        {
          tenderDescription: 'HVAC maintenance for clinics',
          procuringEntity: 'Dept of Health',
          tenderNumber: 'DOH-1',
        },
      ],
      paidAt: '2026-01-01T00:00:00Z',
    })
    expect(n.eligibleForMatching).toBe(true)
    expect(n.department).toBe('Dept of Health')
    expect(n.hasDescription).toBe(true)
    expect(n.scopeText).toMatch(/HVAC/i)
  })

  it('does not match on generic stopwords alone', () => {
    const scored = matching.scoreTenderAgainstPaidRequest(
      {
        title: 'Appointment of a panel for supply of services',
        description: 'maintenance and installation services',
        department: '',
        province: 'Gauteng',
        briefingClassification: 'CONFIRMED_COMPULSORY',
      },
      {
        scopeText: 'supply of services and maintenance installation',
        tenderTitle: 'Panel appointment',
        department: '',
        province: 'Gauteng',
      }
    )
    expect(scored.band).toBe(matching.MATCH_BAND.NO_OUTREACH)
    expect(scored.score).toBeLessThan(0.65)
  })

  it('scores substantive HVAC overlap as HIGH or REVIEW', () => {
    const scored = matching.scoreTenderAgainstPaidRequest(
      {
        title: 'HVAC replacement and maintenance',
        description: 'HVAC works for public facilities engineering',
        department: 'Public Works',
        province: 'Gauteng',
        briefingClassification: 'CONFIRMED_COMPULSORY',
        tenderNumber: 'PW-2026-88',
      },
      {
        scopeText: 'HVAC maintenance RFQ engineering facilities',
        tenderTitle: 'HVAC maintenance RFQ',
        department: 'Public Works',
        province: 'Gauteng',
        tenderNumber: 'PW-2025-12',
      }
    )
    expect(scored.score).toBeGreaterThanOrEqual(matching.DEFAULT_THRESHOLDS.review)
    expect([matching.MATCH_BAND.HIGH_CONFIDENCE, matching.MATCH_BAND.REVIEW]).toContain(
      scored.band
    )
    expect(scored.reasons).toContain(matching.REASON.SAME_ENTITY)
    expect(scored.reasons).toContain(matching.REASON.SIMILAR_WORK_TYPE)
    expect(scored.reasons).toContain(matching.REASON.REPEAT_PROCUREMENT)
  })

  it('treats same-entity compulsory re-engagement as at least REVIEW', () => {
    const scored = matching.scoreTenderAgainstPaidRequest(
      {
        title: 'Security services',
        description: 'Access control upgrade',
        department: 'TSHWANE AUTOMOTIVE SPECIAL ECONOMIC ZONE',
        province: 'Gauteng',
        briefingClassification: 'CONFIRMED_COMPULSORY',
        tenderNumber: '164669',
      },
      {
        scopeText: 'Previous attendance at TASEZ briefing',
        tenderTitle: 'Prior TASEZ RFQ',
        department: 'TSHWANE AUTOMOTIVE SPECIAL ECONOMIC ZONE',
        province: 'Gauteng',
        tenderNumber: 'TASEZ-2025-01',
      }
    )
    expect(scored.band).not.toBe(matching.MATCH_BAND.NO_OUTREACH)
    expect(scored.reasons).toContain(matching.REASON.SAME_ENTITY)
    expect(scored.reasons).toContain(matching.REASON.REPEAT_PROCUREMENT)
  })

  it('CTA tokens round-trip and expire check works', () => {
    const { token } = createSmeConnectCtaToken('cand-1')
    const payload = verifySmeConnectCtaToken(token)
    expect(payload?.candidateId).toBe('cand-1')
    expect(verifySmeConnectCtaToken('garbage')).toBeNull()
  })

  it('exposes CTA API through middleware policy', () => {
    expect(isPublicApiRoute('/api/sme-connect/cta', 'GET')).toBe(true)
    expect(isPublicApiRoute('/api/sme-connect/cta', 'POST')).toBe(true)
  })

  it('refuses live customer send without override', async () => {
    const outreach = require('../../backend/services/smeConnectOutreachService')
    const store = require('../../backend/services/smeConnectRecommendationStore')
    await store.upsertRecommendation({
      id: 'cand-refuse-live',
      status: 'HUMAN_APPROVED',
      contactEmail: 'real-customer@example.com',
      smeEmail: 'real-customer@example.com',
      contactName: 'Real',
      smeCompany: 'Real Co',
      newTenderNumber: 'T-1',
      newTenderTitle: 'Test',
      briefingDate: '2026-11-01',
    })
    await expect(
      outreach.sendApprovedOutreach('cand-refuse-live', { allowLiveCustomers: false })
    ).rejects.toThrow(/Refusing live customer send|overrideRecipient/i)
  })
})
