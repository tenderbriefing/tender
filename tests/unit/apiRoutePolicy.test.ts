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
  })
})
