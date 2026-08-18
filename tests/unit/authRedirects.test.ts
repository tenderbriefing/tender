import { afterEach, describe, expect, it, vi } from 'vitest'
import { dashboardPathForRole, homePathForProfile } from '@/lib/auth/redirects'

describe('homePathForProfile', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('sends allowlisted founder admins to /founder when the flag is on', () => {
    vi.stubEnv('FOUNDER_USER_INTELLIGENCE_ENABLED', 'true')
    vi.stubEnv('NEXT_PUBLIC_FOUNDER_USER_INTELLIGENCE', 'true')
    vi.stubEnv('FOUNDER_EMAIL_ALLOWLIST', 'info@tenderbriefing.co.za')

    expect(
      homePathForProfile({
        userType: 'admin',
        email: 'info@tenderbriefing.co.za',
      })
    ).toBe('/founder')
  })

  it('keeps non-founder admins on the operations console', () => {
    vi.stubEnv('FOUNDER_USER_INTELLIGENCE_ENABLED', 'true')
    vi.stubEnv('NEXT_PUBLIC_FOUNDER_USER_INTELLIGENCE', 'true')
    vi.stubEnv('FOUNDER_EMAIL_ALLOWLIST', 'info@tenderbriefing.co.za')

    expect(
      homePathForProfile({
        userType: 'admin',
        email: 'ops@example.com',
      })
    ).toBe('/admin/dashboard')
  })

  it('honours explicit founderAccess even off the email allowlist', () => {
    vi.stubEnv('FOUNDER_USER_INTELLIGENCE_ENABLED', 'true')
    vi.stubEnv('NEXT_PUBLIC_FOUNDER_USER_INTELLIGENCE', 'true')
    vi.stubEnv('FOUNDER_EMAIL_ALLOWLIST', 'info@tenderbriefing.co.za')

    expect(
      homePathForProfile({
        userType: 'admin',
        email: 'other@example.com',
        founderAccess: true,
      })
    ).toBe('/founder')
  })

  it('falls back to role dashboards for SME and Youth Agent', () => {
    expect(homePathForProfile({ userType: 'sme', email: 'a@b.com' })).toBe(
      dashboardPathForRole('sme')
    )
    expect(homePathForProfile({ userType: 'youth-agent', email: 'a@b.com' })).toBe(
      dashboardPathForRole('youth-agent')
    )
  })
})
