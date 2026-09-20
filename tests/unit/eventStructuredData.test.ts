import { describe, expect, it } from 'vitest'
import { formatEventStartDate } from '../../lib/procurement/dates'
import { SITE_URL } from '../../lib/seo/site'
import { buildTenderBriefingEventJsonLd } from '../../lib/seo/tenderSeo'
import type { TenderBriefing } from '../../lib/tenderBriefing/types'

function baseTender(overrides: Partial<TenderBriefing> = {}): TenderBriefing {
  return {
    id: 'tb-event-1',
    ocid: 'ocid-event-1',
    tenderNumber: 'TND-EVT-001',
    title: 'Supply of medical equipment',
    description: 'Official scope for medical equipment supply.',
    department: 'Department of Health',
    buyer: 'National Department of Health',
    province: 'Gauteng',
    category: 'Goods',
    industrySector: 'Health',
    industryConfidence: 0.9,
    procurementMethod: 'Open tender',
    status: 'active',
    publishedDate: '2026-01-15T00:00:00+02:00',
    closingDate: '2026-12-31T16:00:00+02:00',
    briefingDate: '2026-08-12T11:00:00+02:00',
    briefingTime: '11:00',
    briefingVenue: 'Civitas Building, Pretoria',
    briefingCompulsory: true,
    briefingConfidence: 0.9,
    matchedBriefingTerms: ['compulsory briefing'],
    contactPerson: '',
    contactEmail: '',
    contactPhone: '',
    meetingLink: '',
    documents: [],
    detailUrl: 'https://www.etenders.gov.za/Home/opportunity?id=1',
    summary: '',
    requirements: [],
    risks: [],
    keyDates: [],
    recommendedFor: [],
    opportunityScore: 0,
    calendarEvents: [],
    history: [],
    source: 'test',
    visibility: 'public',
    lastSyncedAt: '2026-08-01T00:00:00Z',
    scrapedAt: '2026-08-01T00:00:00Z',
    ...overrides,
  }
}

describe('Event structured data hardening', () => {
  it('1. emits complete Event JSON-LD with start time (no invented endDate)', () => {
    const event = buildTenderBriefingEventJsonLd(baseTender())
    expect(event).not.toBeNull()
    expect(event?.['@type']).toBe('Event')
    expect(event?.startDate).toBe('2026-08-12T11:00:00+02:00')
    expect(event).not.toHaveProperty('endDate')
    expect(JSON.stringify(event)).not.toMatch(/endDate/)
  })

  it('2. omits endDate when start time is known but end is unknown', () => {
    const event = buildTenderBriefingEventJsonLd(
      baseTender({ briefingDate: '2026-09-01', briefingTime: '09:30' })
    )
    expect(event?.startDate).toBe('2026-09-01T09:30:00+02:00')
    expect(event).not.toHaveProperty('endDate')
  })

  it('3. uses date-only startDate when briefing time is unknown (never midnight)', () => {
    expect(formatEventStartDate('2026-08-12', '')).toBe('2026-08-12')
    expect(formatEventStartDate('2026-08-12T00:00:00Z', '')).toBe('2026-08-12')

    const event = buildTenderBriefingEventJsonLd(
      baseTender({ briefingDate: '2026-08-12', briefingTime: '' })
    )
    expect(event?.startDate).toBe('2026-08-12')
    expect(String(event?.startDate)).not.toMatch(/T23:59|T00:00/)
  })

  it('4. organizer has name but omits url when no verified org homepage exists', () => {
    const event = buildTenderBriefingEventJsonLd(baseTender())
    const organizer = event?.organizer as Record<string, unknown>
    expect(organizer?.['@type']).toBe('Organization')
    expect(organizer?.name).toBe('Department of Health')
    expect(organizer).not.toHaveProperty('url')
  })

  it('5. omits organizer entirely when buyer/department unknown', () => {
    const event = buildTenderBriefingEventJsonLd(
      baseTender({ department: '', buyer: '' })
    )
    expect(event).not.toHaveProperty('organizer')
  })

  it('6. never fabricates performer', () => {
    const event = buildTenderBriefingEventJsonLd(baseTender())
    expect(event).not.toHaveProperty('performer')
    expect(JSON.stringify(event)).not.toMatch(/"performer"|Youth Agent/i)
  })

  it('7. never emits R349 / attendance fee as Event offers', () => {
    const event = buildTenderBriefingEventJsonLd(baseTender())
    expect(event).not.toHaveProperty('offers')
    const raw = JSON.stringify(event)
    expect(raw).not.toMatch(/"offers"/)
    expect(raw).not.toMatch(/349/)
  })

  it('8. includes crawlable absolute Event image (brand OG)', () => {
    const event = buildTenderBriefingEventJsonLd(baseTender())
    const images = event?.image as string[]
    expect(Array.isArray(images)).toBe(true)
    expect(images[0]).toBe(`${SITE_URL}/brand/og-logo.png`)
    expect(images[0].startsWith('https://')).toBe(true)
  })

  it('9. Event url is the absolute canonical tender detail leaf URL', () => {
    const event = buildTenderBriefingEventJsonLd(baseTender({ id: 'tb-leaf-9' }))
    expect(event?.url).toBe(`${SITE_URL}/tenders/tb-leaf-9`)
  })

  it('10. preserves South African +02:00 offset for timed briefings', () => {
    const event = buildTenderBriefingEventJsonLd(
      baseTender({
        briefingDate: '2026-08-12T11:00:00Z',
        briefingTime: '11:00',
      })
    )
    expect(event?.startDate).toBe('2026-08-12T11:00:00+02:00')
  })

  it('11. does not emit Event for non-compulsory / missing location (catalogue-safe)', () => {
    expect(
      buildTenderBriefingEventJsonLd(baseTender({ briefingCompulsory: false }))
    ).toBeNull()
    expect(
      buildTenderBriefingEventJsonLd(
        baseTender({ briefingVenue: '', province: '', meetingLink: '' })
      )
    ).toBeNull()
  })

  it('12. does not fabricate venue postal fields or fake organizer names', () => {
    const event = buildTenderBriefingEventJsonLd(
      baseTender({ briefingVenue: 'Boardroom A', province: 'Western Cape' })
    )
    const location = event?.location as Record<string, unknown>
    const address = location?.address as Record<string, unknown>
    expect(location?.['@type']).toBe('Place')
    expect(location?.name).toBe('Boardroom A')
    expect(address?.['@type']).toBe('PostalAddress')
    expect(address?.addressCountry).toBe('ZA')
    expect(address?.addressRegion).toBe('Western Cape')
    expect(address).not.toHaveProperty('postalCode')
    expect(address).not.toHaveProperty('streetAddress')
    expect(JSON.stringify(event)).not.toMatch(/Government procuring entity/)
  })

  it('13. never maps R349 service pricing into Event Offer objects', () => {
    const event = buildTenderBriefingEventJsonLd(baseTender())
    expect(event?.offers).toBeUndefined()
  })

  it('14. Event JSON-LD serialises to valid JSON', () => {
    const event = buildTenderBriefingEventJsonLd(baseTender())
    expect(() => JSON.parse(JSON.stringify(event))).not.toThrow()
  })

  it('15. structured-data fields agree with tender visible briefing fields', () => {
    const tender = baseTender()
    const event = buildTenderBriefingEventJsonLd(tender)!
    expect(String(event.name)).toContain('Compulsory tender briefing')
    expect(String(event.description)).toContain(tender.briefingVenue)
    const organizer = event.organizer as Record<string, unknown>
    expect(organizer.name).toBe(tender.department)
    const location = event.location as Record<string, unknown>
    expect(location.name).toBe(tender.briefingVenue)
    expect(event.url).toBe(`${SITE_URL}/tenders/${tender.id}`)
  })

  it('uses VirtualLocation when a meeting link is present', () => {
    const event = buildTenderBriefingEventJsonLd(
      baseTender({
        meetingLink: 'https://teams.microsoft.com/l/meetup-join/abc',
        briefingVenue: '',
      })
    )
    const location = event?.location as Record<string, unknown>
    expect(location?.['@type']).toBe('VirtualLocation')
    expect(location?.url).toContain('teams.microsoft.com')
  })
})
