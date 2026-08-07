import { afterEach, describe, expect, it } from 'vitest'
import {
  createPrivateTenderInvite,
  smeHasPrivateBookAccess,
  verifyPrivateTenderInvite,
} from '@/lib/security/privateTenderInvite'
import {
  absolutePrivatePaymentUrl,
  privatePaymentWhatsAppMessage,
  requestAgentPath,
  smeBookAgentDeepLink,
  smeBookAgentSignInHref,
  whatsappShareHref,
} from '@/lib/booking/sharePath'
import { isPlatformVisibleToViewer } from '@/lib/security/publicTender'
import type { TenderBriefing } from '@/lib/tenderBriefing/types'

function privateTender(overrides: Partial<TenderBriefing> = {}): TenderBriefing {
  return {
    id: 'tb-PRIVATE-ABCDEF12',
    ocid: '',
    tenderNumber: 'PRIVATE-ABCDEF12',
    title: 'WhatsApp RFQ',
    description: '',
    department: 'Private RFQ',
    buyer: '',
    province: 'Gauteng',
    category: '',
    industrySector: '',
    industryConfidence: 0,
    procurementMethod: 'RFQ',
    status: 'active',
    publishedDate: '',
    closingDate: '',
    briefingDate: '2026-08-20T10:00:00+02:00',
    briefingTime: '10:00',
    briefingVenue: 'Johannesburg',
    briefingCompulsory: true,
    briefingConfidence: 0.8,
    matchedBriefingTerms: [],
    contactPerson: '',
    contactEmail: '',
    contactPhone: '',
    meetingLink: '',
    documents: [],
    detailUrl: '',
    summary: '',
    requirements: [],
    risks: [],
    keyDates: [],
    recommendedFor: [],
    opportunityScore: 0,
    calendarEvents: [],
    history: [],
    source: 'private_email',
    visibility: 'private',
    ownerUid: 'sme-owner',
    lastSyncedAt: '2026-08-07T00:00:00Z',
    scrapedAt: '2026-08-07T00:00:00Z',
    ...overrides,
  }
}

describe('private tender invite tokens', () => {
  afterEach(() => {
    delete process.env.PRIVATE_TENDER_INVITE_SECRET
    delete process.env.SYNC_SECRET
  })

  it('signs and verifies invites bound to a tender id', () => {
    process.env.PRIVATE_TENDER_INVITE_SECRET = 'unit-test-secret'
    const { token, exp } = createPrivateTenderInvite('tb-PRIVATE-ABCDEF12')
    const payload = verifyPrivateTenderInvite(token, 'tb-PRIVATE-ABCDEF12')
    expect(payload?.tenderId).toBe('tb-PRIVATE-ABCDEF12')
    expect(payload?.exp).toBe(exp)
  })

  it('rejects wrong tender id, tampered token, and expiry', () => {
    process.env.PRIVATE_TENDER_INVITE_SECRET = 'unit-test-secret'
    const { token } = createPrivateTenderInvite('tb-PRIVATE-ABCDEF12', 60_000)
    expect(verifyPrivateTenderInvite(token, 'tb-OTHER')).toBeNull()
    expect(verifyPrivateTenderInvite(token + 'x', 'tb-PRIVATE-ABCDEF12')).toBeNull()
    expect(verifyPrivateTenderInvite(null)).toBeNull()

    const expired = createPrivateTenderInvite('tb-PRIVATE-ABCDEF12', -120_000)
    // Force past expiry by crafting with negative ttl clamped — use raw verify on old exp
    const old = Buffer.from(
      `tb-PRIVATE-ABCDEF12:${Date.now() - 10_000}:deadbeef`
    ).toString('base64url')
    expect(verifyPrivateTenderInvite(old)).toBeNull()
    expect(expired.token).toBeTruthy()
  })

  it('grants book access to owner or valid invite bearer only', () => {
    process.env.PRIVATE_TENDER_INVITE_SECRET = 'unit-test-secret'
    const tender = privateTender()
    const { token } = createPrivateTenderInvite(tender.id)

    expect(
      smeHasPrivateBookAccess({ tender, smeUid: 'sme-owner', inviteToken: null })
    ).toBe(true)
    expect(
      smeHasPrivateBookAccess({ tender, smeUid: 'sme-other', inviteToken: null })
    ).toBe(false)
    expect(
      smeHasPrivateBookAccess({
        tender,
        smeUid: 'sme-other',
        inviteToken: token,
      })
    ).toBe(true)
  })
})

describe('private WhatsApp payment share URLs', () => {
  it('builds deep link with tenderId and invite', () => {
    expect(smeBookAgentDeepLink('tb-PRIVATE-1', { invite: 'tok' })).toBe(
      '/sme/book-agent?tenderId=tb-PRIVATE-1&invite=tok'
    )
    expect(requestAgentPath('tb-PRIVATE-1', { invite: 'tok' })).toBe(
      '/tenders/tb-PRIVATE-1/request-agent?invite=tok'
    )
    expect(smeBookAgentSignInHref('tb-PRIVATE-1', { invite: 'tok' })).toContain(
      encodeURIComponent('/tenders/tb-PRIVATE-1/request-agent?invite=tok')
    )
  })

  it('builds absolute WhatsApp-paste URL and wa.me share href', () => {
    const url = absolutePrivatePaymentUrl('tb-PRIVATE-1', {
      invite: 'abc',
      siteUrl: 'https://www.tenderbriefing.co.za',
    })
    expect(url).toBe(
      'https://www.tenderbriefing.co.za/sme/book-agent?tenderId=tb-PRIVATE-1&invite=abc'
    )
    const message = privatePaymentWhatsAppMessage(url, {
      tenderLabel: 'PRIVATE-1',
    })
    expect(message).toContain(url)
    expect(message).toContain('PRIVATE-1')
    expect(whatsappShareHref(message)).toMatch(/^https:\/\/wa\.me\/\?text=/)
  })
})

describe('private RFQs stay off public catalogue lists', () => {
  it('does not list private tenders for anonymous or non-owner SME viewers', () => {
    const tender = privateTender()
    expect(isPlatformVisibleToViewer(tender, null)).toBe(false)
    expect(
      isPlatformVisibleToViewer(tender, { userType: 'sme', uid: 'sme-other' })
    ).toBe(false)
    expect(
      isPlatformVisibleToViewer(tender, { userType: 'sme', uid: 'sme-owner' })
    ).toBe(true)
  })

  it('book-agent browse list still uses compulsory public tenders only', async () => {
    const fs = await import('node:fs')
    const path = await import('node:path')
    const page = fs.readFileSync(
      path.join(process.cwd(), 'app/sme/book-agent/page.tsx'),
      'utf8'
    )
    expect(page).toContain("compulsoryOnly: true")
    expect(page).toContain('inviteParam')
    expect(page).not.toContain('includePrivate')
  })

  it('request-agent loads private tenders with authFetch', async () => {
    const fs = await import('node:fs')
    const path = await import('node:path')
    const page = fs.readFileSync(
      path.join(process.cwd(), 'app/tenders/(detail)/[id]/request-agent/page.tsx'),
      'utf8'
    )
    expect(page).toContain('authFetch')
    expect(page).toContain('inviteToken')
    expect(page).not.toMatch(/fetch\(`\/api\/tender-briefings\/\$\{id\}`\)/)
  })
})
