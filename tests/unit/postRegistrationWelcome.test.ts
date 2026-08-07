import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { dashboardPathForRole } from '@/lib/auth/redirects'
import {
  clearPostRegistrationWelcomePending,
  consumePostRegistrationWelcomePending,
  dashboardPathFromTrustedProfile,
  isWelcomeRole,
  markPostRegistrationWelcomePending,
  POST_REGISTRATION_WELCOME_PATH,
  postRegistrationWelcomeRedirectPath,
  resolveClientPostAuthNavigation,
  welcomeCopyForRole,
} from '@/lib/auth/postRegistrationWelcome'

describe('post-registration welcome', () => {
  beforeEach(() => {
    clearPostRegistrationWelcomePending()
    const store = new Map<string, string>()
    vi.stubGlobal('sessionStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        store.set(k, v)
      },
      removeItem: (k: string) => {
        store.delete(k)
      },
      clear: () => store.clear(),
    })
  })

  afterEach(() => {
    clearPostRegistrationWelcomePending()
    vi.unstubAllGlobals()
  })

  it('SME welcome copy and CTA route to SME dashboard', () => {
    const copy = welcomeCopyForRole('sme')
    expect(copy.title).toBe('Welcome to TenderBriefing')
    expect(copy.body).toMatch(/successfully created/i)
    expect(copy.body).toMatch(/tender opportunities/i)
    expect(copy.ctaLabel).toBe('Go to Dashboard')
    expect(dashboardPathFromTrustedProfile('sme')).toBe('/sme/dashboard')
    expect(dashboardPathFromTrustedProfile('sme')).toBe(dashboardPathForRole('sme'))
  })

  it('Youth Agent welcome copy and CTA route to agent dashboard (not fail-closed workspace)', () => {
    const copy = welcomeCopyForRole('youth-agent')
    expect(copy.title).toBe('Welcome to TenderBriefing')
    expect(copy.body).toMatch(/Youth Agent account has been successfully created/i)
    expect(copy.body).toMatch(/assignments/i)
    expect(copy.ctaLabel).toBe('Go to Dashboard')
    expect(dashboardPathFromTrustedProfile('youth-agent')).toBe('/agent/dashboard')
    expect(dashboardPathFromTrustedProfile('youth-agent')).not.toContain('/workspace')
  })

  it('existing login / non-created flows do not resolve to welcome', () => {
    expect(postRegistrationWelcomeRedirectPath(false)).toBeNull()
    expect(
      resolveClientPostAuthNavigation({
        created: false,
        allowWelcome: true,
        redirectPath: '/sme/dashboard',
        fallbackPath: '/sme/dashboard',
      })
    ).toBe('/sme/dashboard')
    expect(
      resolveClientPostAuthNavigation({
        created: false,
        allowWelcome: false,
        redirectPath: '/agent/dashboard',
        fallbackPath: '/sme/dashboard',
      })
    ).toBe('/agent/dashboard')
  })

  it('missing-profile recovery does not allow welcome even when created', () => {
    expect(
      resolveClientPostAuthNavigation({
        created: true,
        allowWelcome: false,
        redirectPath: POST_REGISTRATION_WELCOME_PATH,
        continuePath: '/sme/onboarding',
        fallbackPath: '/sme/dashboard',
      })
    ).toBe('/sme/onboarding')

    expect(
      resolveClientPostAuthNavigation({
        created: true,
        allowWelcome: false,
        redirectPath: '/agent/onboarding',
        fallbackPath: '/agent/dashboard',
      })
    ).toBe('/agent/onboarding')
  })

  it('Google linking / sign-in style navigation never arms welcome without allowWelcome', () => {
    expect(
      resolveClientPostAuthNavigation({
        created: true,
        allowWelcome: false,
        redirectPath: POST_REGISTRATION_WELCOME_PATH,
        fallbackPath: '/agent/dashboard',
      })
    ).toBe('/agent/dashboard')
  })

  it('role isolation: CTA path comes from trusted profile role, not client-forged role', () => {
    const forged = 'youth-agent' as const
    const trusted = 'sme' as const
    // Simulated attack: client wants agent dashboard while profile is SME
    expect(dashboardPathFromTrustedProfile(trusted)).toBe('/sme/dashboard')
    expect(dashboardPathFromTrustedProfile(trusted)).not.toBe(
      dashboardPathFromTrustedProfile(forged)
    )
    expect(isWelcomeRole('admin')).toBe(false)
    expect(isWelcomeRole(forged)).toBe(true)
  })

  it('one-shot gate: refresh cannot fake re-registration after consume', () => {
    markPostRegistrationWelcomePending('user-1')
    expect(consumePostRegistrationWelcomePending('user-1')).toBe(true)
    // Strict Mode remount still allowed via memory
    expect(consumePostRegistrationWelcomePending('user-1')).toBe(true)

    clearPostRegistrationWelcomePending()
    expect(consumePostRegistrationWelcomePending('user-1')).toBe(false)
  })

  it('gate rejects mismatched uid (role/session isolation)', () => {
    markPostRegistrationWelcomePending('sme-uid')
    expect(consumePostRegistrationWelcomePending('agent-uid')).toBe(false)
  })

  it('registration success resolves to welcome path when allowed', () => {
    expect(postRegistrationWelcomeRedirectPath(true)).toBe(POST_REGISTRATION_WELCOME_PATH)
    expect(
      resolveClientPostAuthNavigation({
        created: true,
        allowWelcome: true,
        redirectPath: '/sme/onboarding',
        fallbackPath: '/sme/dashboard',
      })
    ).toBe(POST_REGISTRATION_WELCOME_PATH)
  })
})

describe('bootstrap welcome redirect wiring', () => {
  it('bootstrap-profile module references post-registration welcome path on create', async () => {
    const fs = await import('node:fs')
    const path = await import('node:path')
    const src = fs.readFileSync(
      path.join(process.cwd(), 'app/api/auth/bootstrap-profile/route.ts'),
      'utf8'
    )
    expect(src).toContain('POST_REGISTRATION_WELCOME_PATH')
    expect(src).toContain('continuePath')
    // Existing profile branch must keep created: false
    expect(src).toMatch(/created:\s*false/)
    expect(src).toMatch(/created:\s*true/)
  })

  it('signup arms welcome only for created accounts; role-selection skips welcome', async () => {
    const fs = await import('node:fs')
    const path = await import('node:path')
    const signup = fs.readFileSync(path.join(process.cwd(), 'app/auth/signup/page.tsx'), 'utf8')
    const roleSel = fs.readFileSync(
      path.join(process.cwd(), 'app/auth/role-selection/page.tsx'),
      'utf8'
    )
    const link = fs.readFileSync(path.join(process.cwd(), 'app/auth/link-account/page.tsx'), 'utf8')
    const signin = fs.readFileSync(path.join(process.cwd(), 'app/auth/signin/page.tsx'), 'utf8')

    expect(signup).toContain('markPostRegistrationWelcomePending')
    expect(signup).toContain('allowWelcome: true')
    expect(signup).toContain('POST_REGISTRATION_WELCOME_PATH')

    expect(roleSel).toContain('never show "account created" welcome')
    expect(roleSel).toContain('continuePath')
    expect(roleSel).not.toContain('markPostRegistrationWelcomePending')

    expect(link).not.toContain('markPostRegistrationWelcomePending')
    expect(link).not.toContain('allowWelcome')
    expect(signin).not.toContain('allowWelcome')
    expect(signin).not.toContain('markPostRegistrationWelcomePending')
  })

  it('welcome page uses trusted profile role for CTA only', async () => {
    const fs = await import('node:fs')
    const path = await import('node:path')
    const page = fs.readFileSync(path.join(process.cwd(), 'app/auth/welcome/page.tsx'), 'utf8')
    expect(page).toContain('dashboardPathFromTrustedProfile(userProfile.userType)')
    expect(page).toContain('welcomeCopyForRole(userProfile.userType)')
    expect(page).not.toMatch(/searchParams.*role|get\(['"]role['"]\)/)
  })
})
