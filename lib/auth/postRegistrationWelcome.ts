import { dashboardPathForRole } from '@/lib/auth/redirects'
import type { UserProfile } from '@/lib/auth'

/** One-shot client gate so refresh / deep-link cannot fake a new registration. */
export const POST_REGISTRATION_WELCOME_PATH = '/auth/welcome'

const STORAGE_KEY = 'tb:postRegistrationWelcome'
const WELCOME_TTL_MS = 30 * 60 * 1000

type WelcomeGate = { uid: string; at: number }

/** Survives React Strict Mode double-mount within the same JS realm. */
let memoryGate: WelcomeGate | null = null

export type WelcomeRole = 'sme' | 'youth-agent'

export type WelcomeCopy = {
  title: string
  body: string
  ctaLabel: string
}

export function isWelcomeRole(value: unknown): value is WelcomeRole {
  return value === 'sme' || value === 'youth-agent'
}

/**
 * Role-specific welcome copy. CTA destination is never taken from client-forged role —
 * callers must pass the trusted profile userType.
 */
export function welcomeCopyForRole(role: WelcomeRole): WelcomeCopy {
  if (role === 'youth-agent') {
    return {
      title: 'Welcome to TenderBriefing',
      body: 'Your Youth Agent account has been successfully created. You can now access your workspace and view available assignments, briefing requests and account activity.',
      ctaLabel: 'Go to Dashboard',
    }
  }
  return {
    title: 'Welcome to TenderBriefing',
    body: 'Your account has been successfully created. You can now access relevant tender opportunities, briefing information and services available to your business.',
    ctaLabel: 'Go to Dashboard',
  }
}

/**
 * Canonical post-welcome destination from trusted profile role only.
 * Youth Agent workspace is flag-gated (fail-closed) — use live agent dashboard.
 */
export function dashboardPathFromTrustedProfile(
  userType: UserProfile['userType'] | null | undefined
): string {
  return dashboardPathForRole(userType ?? undefined)
}

/**
 * After a real profile create, send users to the welcome page (not onboarding wizard).
 * Existing login / linking must never use this.
 */
export function postRegistrationWelcomeRedirectPath(created: boolean): string | null {
  return created ? POST_REGISTRATION_WELCOME_PATH : null
}

function readStorage(): WelcomeGate | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as WelcomeGate
    if (!parsed?.uid || typeof parsed.at !== 'number') return null
    if (Date.now() - parsed.at > WELCOME_TTL_MS) {
      window.sessionStorage.removeItem(STORAGE_KEY)
      return null
    }
    return parsed
  } catch {
    return null
  }
}

function writeStorage(gate: WelcomeGate | null) {
  if (typeof window === 'undefined') return
  try {
    if (!gate) window.sessionStorage.removeItem(STORAGE_KEY)
    else window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(gate))
  } catch {
    /* private mode / quota — memory gate still works for this navigation */
  }
}

/** Call only after server confirms profile `created: true` (not login / link / recover). */
export function markPostRegistrationWelcomePending(uid: string): void {
  if (!uid) return
  const gate = { uid, at: Date.now() }
  memoryGate = gate
  writeStorage(gate)
}

/**
 * Returns true once for a matching uid after registration.
 * Refresh / direct visit without a pending gate returns false (no fake re-registration).
 */
export function consumePostRegistrationWelcomePending(uid: string): boolean {
  if (!uid) return false

  if (memoryGate?.uid === uid) {
    if (Date.now() - memoryGate.at > WELCOME_TTL_MS) {
      memoryGate = null
      writeStorage(null)
      return false
    }
    // Keep memory for Strict Mode remount; clear durable storage so a full refresh cannot re-show.
    writeStorage(null)
    return true
  }

  const stored = readStorage()
  if (stored?.uid === uid) {
    memoryGate = stored
    writeStorage(null)
    return true
  }

  return false
}

export function clearPostRegistrationWelcomePending(): void {
  memoryGate = null
  writeStorage(null)
}

/**
 * Resolve where a bootstrap/signup client should navigate.
 * Welcome only when `created` and `allowWelcome` (registration journeys — not recover/link/signin).
 */
export function resolveClientPostAuthNavigation(input: {
  created?: boolean
  allowWelcome?: boolean
  redirectPath?: string | null
  continuePath?: string | null
  fallbackPath: string
}): string {
  if (input.created && input.allowWelcome) {
    return POST_REGISTRATION_WELCOME_PATH
  }
  const preferred = input.continuePath || input.redirectPath || input.fallbackPath
  // Never land recover / link / sign-in clients on the welcome page by accident.
  if (preferred === POST_REGISTRATION_WELCOME_PATH && !input.allowWelcome) {
    return input.continuePath || input.fallbackPath
  }
  return preferred
}
