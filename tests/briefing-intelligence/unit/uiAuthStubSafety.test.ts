import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('E2E UI auth stub safety (fail-closed)', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('does not activate without build-time NEXT_PUBLIC_E2E_AUTH_STUB_ALLOWED=1', async () => {
    vi.stubGlobal('window', {
      location: { hostname: '127.0.0.1' },
      __TB_E2E_UI_STUB__: { uid: 'agent-1', userType: 'youth-agent' },
    })
    const { readE2eUiAuthStub } = await import('@/lib/e2e/uiAuthStub')
    expect(readE2eUiAuthStub()).toBeNull()
  })

  it('does not activate on production hostname even when build flag is set', async () => {
    vi.stubEnv('NEXT_PUBLIC_E2E_AUTH_STUB_ALLOWED', '1')
    vi.stubGlobal('window', {
      location: { hostname: 'www.tenderbriefing.co.za' },
      __TB_E2E_UI_STUB__: { uid: 'agent-1', userType: 'youth-agent' },
    })
    const { readE2eUiAuthStub } = await import('@/lib/e2e/uiAuthStub')
    expect(readE2eUiAuthStub()).toBeNull()
  })

  it('does not activate from invalid stub payloads when gates pass', async () => {
    vi.stubEnv('NEXT_PUBLIC_E2E_AUTH_STUB_ALLOWED', '1')
    vi.stubGlobal('window', {
      location: { hostname: 'localhost' },
      __TB_E2E_UI_STUB__: { uid: '', userType: 'youth-agent' },
    })
    const { readE2eUiAuthStub } = await import('@/lib/e2e/uiAuthStub')
    expect(readE2eUiAuthStub()).toBeNull()
  })

  it('activates only when build flag, localhost, and valid Playwright stub align', async () => {
    vi.stubEnv('NEXT_PUBLIC_E2E_AUTH_STUB_ALLOWED', '1')
    const stub = { uid: 'e2e-agent-a', userType: 'youth-agent' as const, email: 'e2e@test' }
    vi.stubGlobal('window', {
      location: { hostname: '127.0.0.1' },
      __TB_E2E_UI_STUB__: stub,
    })
    const { readE2eUiAuthStub } = await import('@/lib/e2e/uiAuthStub')
    expect(readE2eUiAuthStub()).toEqual(stub)
  })

  it('build flag defaults off in normal production builds', async () => {
    const { isE2eAuthStubBuildAllowed } = await import('@/lib/e2e/uiAuthStub')
    expect(isE2eAuthStubBuildAllowed()).toBe(false)
  })
})
