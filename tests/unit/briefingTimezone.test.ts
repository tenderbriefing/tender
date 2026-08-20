import { afterEach, describe, expect, it } from 'vitest'
import {
  formatBriefingTime,
  hasUpcomingBriefing,
  isBriefingPast,
  resolveBriefingDateTime,
  toSastIsoString,
} from '../../lib/procurement/dates'
import { buildGoogleCalendarUrl, buildIcsContent } from '../../lib/procurement/calendarLinks'
import { buildTenderBriefingEventJsonLd } from '../../lib/seo/tenderSeo'
import { filterPlatformVisible } from '../../lib/security/publicTender'
import type { TenderBriefing } from '../../lib/tenderBriefing/types'

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { parseOcdsRelease } = require('../../backend/services/incrementalSyncService')

const ORIGINAL_TZ = process.env.TZ

afterEach(() => {
  process.env.TZ = ORIGINAL_TZ
})

function withTimeZone<T>(timeZone: string, run: () => T): T {
  process.env.TZ = timeZone
  try {
    return run()
  } finally {
    process.env.TZ = ORIGINAL_TZ
  }
}

function baseTender(overrides: Partial<TenderBriefing> = {}): TenderBriefing {
  return {
    id: 'tb-1',
    ocid: 'ocid-1',
    tenderNumber: 'T-1',
    title: 'Sample',
    description: '',
    department: 'Test Dept',
    buyer: 'Buyer',
    province: 'Gauteng',
    category: '',
    industrySector: '',
    industryConfidence: 0,
    procurementMethod: 'RFQ',
    status: 'active',
    publishedDate: '2026-01-01T00:00:00+02:00',
    closingDate: '2026-12-31T11:00:00Z',
    briefingDate: '2026-08-12T11:00:00Z',
    briefingTime: '11:00',
    briefingVenue: 'Pretoria',
    briefingCompulsory: true,
    briefingConfidence: 0.9,
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
    source: 'test',
    visibility: 'public',
    lastSyncedAt: '2026-08-01T00:00:00Z',
    scrapedAt: '2026-08-01T00:00:00Z',
    ...overrides,
  } as TenderBriefing
}

/**
 * eTenders OCDS publishes SA wall-clock times with a `Z` designator, so
 * `2026-08-12T11:00:00Z` is an 11:00 SAST briefing (09:00 UTC), not 13:00 SAST.
 */
describe('resolveBriefingDateTime — eTenders SA wall-clock-as-Z feed', () => {
  it('reads a Z-stamped briefing time as SAST, not UTC', () => {
    const instant = resolveBriefingDateTime('2026-08-12T11:00:00Z', '11:00')
    expect(instant?.toISOString()).toBe('2026-08-12T09:00:00.000Z')
  })

  it('resolves the same instant when no briefingTime is stored', () => {
    const instant = resolveBriefingDateTime('2026-08-12T11:00:00Z', '')
    expect(instant?.toISOString()).toBe('2026-08-12T09:00:00.000Z')
  })

  it('keeps the wall-clock calendar day for late-evening stamps', () => {
    const instant = resolveBriefingDateTime('2026-08-12T23:30:00Z', '23:30')
    expect(instant?.toISOString()).toBe('2026-08-12T21:30:00.000Z')
  })

  it('trusts an explicit offset as a real instant', () => {
    const instant = resolveBriefingDateTime('2026-08-12T11:00:00+02:00', '11:00')
    expect(instant?.toISOString()).toBe('2026-08-12T09:00:00.000Z')
  })

  it('still interprets date-only values in Africa/Johannesburg', () => {
    expect(resolveBriefingDateTime('2026-08-10', '14:30')?.toISOString()).toBe(
      new Date('2026-08-10T14:30:00+02:00').toISOString()
    )
    expect(resolveBriefingDateTime('2026-08-10', null)?.toISOString()).toBe(
      new Date('2026-08-10T23:59:59+02:00').toISOString()
    )
  })

  it('resolves identically regardless of the runtime timezone', () => {
    const utc = withTimeZone('UTC', () =>
      resolveBriefingDateTime('2026-08-12T11:00:00Z', '11:00')?.toISOString()
    )
    const sast = withTimeZone('Africa/Johannesburg', () =>
      resolveBriefingDateTime('2026-08-12T11:00:00Z', '11:00')?.toISOString()
    )
    const newYork = withTimeZone('America/New_York', () =>
      resolveBriefingDateTime('2026-08-12T11:00:00Z', '11:00')?.toISOString()
    )
    expect(utc).toBe('2026-08-12T09:00:00.000Z')
    expect(sast).toBe(utc)
    expect(newYork).toBe(utc)
  })
})

describe('public catalogue cut-off lands on the displayed briefing time', () => {
  it('hides the tender once its 11:00 SAST briefing has started', () => {
    const justBefore = new Date('2026-08-12T10:59:00+02:00')
    const justAfter = new Date('2026-08-12T11:01:00+02:00')

    expect(hasUpcomingBriefing('2026-08-12T11:00:00Z', '11:00', justBefore)).toBe(true)
    expect(isBriefingPast('2026-08-12T11:00:00Z', '11:00', justAfter)).toBe(true)
  })

  it('no longer lists an expired briefing for two extra hours', () => {
    // 12:30 SAST — past an 11:00 briefing, but before the 13:00 SAST instant the
    // previous UTC reading produced.
    const now = new Date('2026-08-12T12:30:00+02:00')
    const expired = baseTender({ id: 'expired' })
    const upcoming = baseTender({
      id: 'upcoming',
      briefingDate: '2026-08-13T10:00:00Z',
      briefingTime: '10:00',
    })

    const visible = filterPlatformVisible([expired, upcoming], null, { now })
    expect(visible.map((t) => t.id)).toEqual(['upcoming'])
  })
})

describe('parseOcdsRelease — briefingTime extraction', () => {
  function release(date: string) {
    return {
      ocid: 'ocds-abc-1',
      date: '2026-08-01T00:00:00Z',
      tender: {
        id: '164657',
        title: 'Sample tender',
        briefingSession: { date, compulsory: true, venue: 'Pretoria' },
      },
    }
  }

  it('stores the SA wall clock carried by the feed', () => {
    expect(parseOcdsRelease(release('2026-08-12T11:00:00Z')).briefingTime).toBe('11:00')
    expect(parseOcdsRelease(release('2026-08-12T09:30:00Z')).briefingTime).toBe('09:30')
  })

  it('extracts the same time no matter which timezone the sync runs in', () => {
    const utc = withTimeZone('UTC', () =>
      parseOcdsRelease(release('2026-08-12T11:00:00Z')).briefingTime
    )
    const sast = withTimeZone('Africa/Johannesburg', () =>
      parseOcdsRelease(release('2026-08-12T11:00:00Z')).briefingTime
    )
    const newYork = withTimeZone('America/New_York', () =>
      parseOcdsRelease(release('2026-08-12T11:00:00Z')).briefingTime
    )
    expect(utc).toBe('11:00')
    expect(sast).toBe('11:00')
    expect(newYork).toBe('11:00')
  })

  it('drops the placeholder date the feed uses for "no briefing"', () => {
    const parsed = parseOcdsRelease(release('0001-01-01T00:00:00Z'))
    expect(parsed.briefingDate).toBe('')
    expect(parsed.briefingTime).toBe('')
  })
})

describe('calendar export is anchored in SAST', () => {
  it('emits the briefing start as 09:00Z for an 11:00 SAST briefing', () => {
    const ics = buildIcsContent(baseTender(), 'briefing')
    expect(ics).toContain('DTSTART:20260812T090000Z')
    expect(ics).toContain('DTEND:20260812T110000Z')
  })

  it('produces the same event regardless of the visitor timezone', () => {
    const tender = baseTender()
    const sast = withTimeZone('Africa/Johannesburg', () =>
      buildGoogleCalendarUrl(tender, 'briefing')
    )
    const london = withTimeZone('Europe/London', () =>
      buildGoogleCalendarUrl(tender, 'briefing')
    )
    expect(sast).toContain('20260812T090000Z')
    expect(london).toBe(sast)
  })

  it('defaults a date-only briefing to 10:00 SAST', () => {
    const ics = buildIcsContent(
      baseTender({ briefingDate: '2026-08-12', briefingTime: '' }),
      'briefing'
    )
    expect(ics).toContain('DTSTART:20260812T080000Z')
  })

  it('anchors the closing reminder to the SA wall clock', () => {
    const ics = buildIcsContent(baseTender(), 'closing')
    expect(ics).toContain('DTSTART:20261231T090000Z')
  })
})

describe('Event JSON-LD', () => {
  it('publishes startDate with an explicit SAST offset for the compulsory briefing', () => {
    const jsonLd = buildTenderBriefingEventJsonLd(baseTender())
    expect(jsonLd?.startDate).toBe('2026-08-12T11:00:00+02:00')
  })

  it('omits Event JSON-LD when the briefing date is unusable', () => {
    const jsonLd = buildTenderBriefingEventJsonLd(baseTender({ briefingDate: 'not-a-date' }))
    expect(jsonLd).toBeNull()
  })
})

describe('toSastIsoString / formatBriefingTime', () => {
  it('renders an instant with the +02:00 offset', () => {
    expect(toSastIsoString(new Date('2026-08-12T09:00:00Z'))).toBe(
      '2026-08-12T11:00:00+02:00'
    )
    expect(toSastIsoString(null)).toBeNull()
  })

  it('prefers the stored wall clock and falls back to the feed clock', () => {
    expect(formatBriefingTime('2026-08-12T11:00:00Z', '11:00')).toBe('11:00')
    expect(formatBriefingTime('2026-08-12T11:00:00Z', '')).toBe('11:00')
    expect(formatBriefingTime('2026-08-12', '')).toBe('')
    expect(formatBriefingTime('2026-08-12T00:00:00Z', '')).toBe('')
  })
})
