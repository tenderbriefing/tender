import { describe, expect, it } from 'vitest'
import {
  isDevOnlyPage,
  isProductionBlockedApiRoute,
  isPublicApiRoute,
} from '@/lib/security/apiRoutePolicy'

describe('apiRoutePolicy', () => {
  it('hides QA and /dev surfaces in production', () => {
    expect(isDevOnlyPage('/dev/emails')).toBe(true)
    expect(isDevOnlyPage('/dev')).toBe(true)
    expect(isDevOnlyPage('/gmail-test')).toBe(true)
    expect(isDevOnlyPage('/founder')).toBe(false)
  })

  it('keeps PayFast ITN public and blocks retired bookings in production', () => {
    expect(isPublicApiRoute('/api/webhooks/payfast', 'POST')).toBe(true)
    expect(isProductionBlockedApiRoute('/api/bookings')).toBe(true)
    expect(isPublicApiRoute('/api/founder/dashboard', 'GET')).toBe(false)
    expect(isPublicApiRoute('/api/private-tenders/submit', 'POST')).toBe(true)
    expect(isPublicApiRoute('/api/private-tenders/upload', 'POST')).toBe(true)
    expect(isPublicApiRoute('/api/private-tenders/status/abc123token', 'GET')).toBe(true)
    expect(isPublicApiRoute('/api/founder/private-tenders', 'GET')).toBe(false)
  })

  it('allows briefing workers through middleware; handlers still require sync secret', () => {
    expect(isPublicApiRoute('/api/briefing-intelligence/transcription/worker', 'POST')).toBe(true)
    expect(isPublicApiRoute('/api/briefing-intelligence/report/worker', 'POST')).toBe(true)
    expect(isPublicApiRoute('/api/briefing-intelligence/transcription/worker', 'GET')).toBe(false)
    expect(isPublicApiRoute('/api/briefing-intelligence/evidence', 'POST')).toBe(false)
    expect(isPublicApiRoute('/api/outreach/unsubscribe', 'GET')).toBe(true)
    expect(isPublicApiRoute('/api/outreach/unsubscribe', 'POST')).toBe(true)
  })
})
