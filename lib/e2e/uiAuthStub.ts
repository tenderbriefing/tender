/**
 * Browser-only Playwright auth stub.
 *
 * Fail-closed activation requires ALL of:
 * 1. Build-time `NEXT_PUBLIC_E2E_AUTH_STUB_ALLOWED=1` (never set in production deploy builds)
 * 2. Runtime localhost host only (127.0.0.1 / localhost / [::1])
 * 3. `window.__TB_E2E_UI_STUB__` set via Playwright addInitScript before load
 *
 * Not activatable via query params, localStorage, cookies, or client headers.
 * Does not weaken server-side authorization.
 */

export type E2eUiAuthStub = {
  uid: string
  userType: 'youth-agent'
  email?: string
  token?: string
}

declare global {
  interface Window {
    __TB_E2E_UI_STUB__?: E2eUiAuthStub
  }
}

const LOCAL_E2E_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]'])

/** @internal Test-only export for regression coverage. */
export function isE2eAuthStubBuildAllowed(): boolean {
  return process.env.NEXT_PUBLIC_E2E_AUTH_STUB_ALLOWED === '1'
}

/** @internal Test-only export for regression coverage. */
export function isLocalE2eHost(hostname: string): boolean {
  return LOCAL_E2E_HOSTS.has(hostname)
}

function isE2eAuthStubRuntimeAllowed(): boolean {
  if (!isE2eAuthStubBuildAllowed()) return false
  if (typeof window === 'undefined') return false
  return isLocalE2eHost(window.location.hostname)
}

export function readE2eUiAuthStub(): E2eUiAuthStub | null {
  if (!isE2eAuthStubRuntimeAllowed()) return null
  const stub = window.__TB_E2E_UI_STUB__
  if (!stub || stub.userType !== 'youth-agent' || !stub.uid) return null
  return stub
}
