'use client'

import { authFetch } from '@/lib/api/authenticatedFetch'
import type { RegistrationJourney } from '@/lib/auth/googleAuthFlow'
import {
  completeGoogleRedirectIfPresent,
  providerIdsFromUser,
  signInWithGoogle,
  type GoogleSignInResult,
} from '@/lib/auth/googleAuth'
import type { UserProfile } from '@/lib/auth'
import type { ProductEventName } from '@/lib/founder/eventSchema'

export type BootstrapResponse = {
  success: boolean
  error?: string
  code?: string
  data?: {
    created?: boolean
    firstGoogleRegistration?: boolean
    needsRoleSelection?: boolean
    onboardingRequired?: boolean
    redirectPath?: string
    blocked?: boolean
    blockReason?: string
    profile?: Partial<UserProfile> | null
  }
}

function deviceCategory(): string {
  if (typeof window === 'undefined') return 'unknown'
  const w = window.innerWidth
  if (w < 768) return 'mobile'
  if (w < 1024) return 'tablet'
  return 'desktop'
}

async function trackAuthFunnel(
  eventName: 'google_sign_in_started' | 'google_sign_in_failed',
  opts: { registrationJourney: RegistrationJourney; pagePath?: string; errorCode?: string }
) {
  try {
    await fetch('/api/product-events/auth-funnel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventName,
        registrationJourney: opts.registrationJourney,
        pagePath: opts.pagePath,
        deviceCategory: deviceCategory(),
        errorCode: opts.errorCode,
      }),
    })
  } catch {
    /* non-blocking */
  }
}

async function trackAuthed(
  eventName: ProductEventName,
  opts: {
    pagePath?: string
    registrationJourney?: RegistrationJourney
    created?: boolean
  }
) {
  try {
    const { trackProductEvent } = await import('@/lib/founder/trackProductEvent')
    await trackProductEvent(eventName, {
      feature: 'auth',
      pagePath: opts.pagePath,
      metadata: {
        authenticationProvider: 'google',
        ...(opts.registrationJourney
          ? { registrationJourney: opts.registrationJourney }
          : {}),
        deviceCategory: deviceCategory(),
      },
    })
  } catch {
    /* non-blocking */
  }
}

export async function bootstrapGoogleProfile(input: {
  intendedRole?: 'sme' | 'youth-agent'
  registrationJourney: RegistrationJourney
}): Promise<BootstrapResponse> {
  const res = await authFetch('/api/auth/bootstrap-profile', {
    method: 'POST',
    body: JSON.stringify({
      intendedRole: input.intendedRole,
      registrationJourney: input.registrationJourney,
    }),
  })
  return (await res.json()) as BootstrapResponse
}

/**
 * Full Google continue flow for sign-in / registration pages.
 */
export async function continueWithGoogle(input: {
  registrationJourney: RegistrationJourney
  intendedRole?: 'sme' | 'youth-agent'
  pagePath: string
}): Promise<{
  ok: boolean
  message?: string
  needsAccountLink?: boolean
  email?: string
  redirectPath?: string
  profile?: Partial<UserProfile> | null
}> {
  await trackAuthFunnel('google_sign_in_started', {
    registrationJourney: input.registrationJourney,
    pagePath: input.pagePath,
  })

  const result = await signInWithGoogle()
  return finishGoogleResult(result, input)
}

export async function finishGoogleRedirect(input: {
  registrationJourney: RegistrationJourney
  intendedRole?: 'sme' | 'youth-agent'
  pagePath: string
}) {
  const result = await completeGoogleRedirectIfPresent()
  if (!result) return null
  if (!result.ok && result.code !== 'auth/redirect-pending') {
    await trackAuthFunnel('google_sign_in_failed', {
      registrationJourney: input.registrationJourney,
      pagePath: input.pagePath,
      errorCode: result.code,
    })
  }
  return finishGoogleResult(result, input)
}

async function finishGoogleResult(
  result: GoogleSignInResult,
  input: {
    registrationJourney: RegistrationJourney
    intendedRole?: 'sme' | 'youth-agent'
    pagePath: string
  }
) {
  if (!result.ok) {
    if (result.code === 'auth/redirect-pending') {
      return { ok: false, message: result.message }
    }
    await trackAuthFunnel('google_sign_in_failed', {
      registrationJourney: input.registrationJourney,
      pagePath: input.pagePath,
      errorCode: result.code,
    })
    return {
      ok: false,
      message: result.message,
      needsAccountLink: result.needsAccountLink,
      email: result.email,
    }
  }

  // Soft check providers for analytics only
  void providerIdsFromUser(result.user)

  const boot = await bootstrapGoogleProfile({
    intendedRole: input.intendedRole,
    registrationJourney: input.registrationJourney,
  })

  if (!boot.success) {
    await trackAuthFunnel('google_sign_in_failed', {
      registrationJourney: input.registrationJourney,
      pagePath: input.pagePath,
      errorCode: boot.code === 'ACCOUNT_SUSPENDED' ? 'auth/user-disabled' : 'unknown',
    })
    return { ok: false, message: boot.error || 'Could not load your profile.' }
  }

  await trackAuthed('google_sign_in_succeeded', {
    pagePath: input.pagePath,
    registrationJourney: input.registrationJourney,
  })
  await trackAuthed('user_logged_in', {
    pagePath: input.pagePath,
    registrationJourney: input.registrationJourney,
  })

  if (boot.data?.created || boot.data?.firstGoogleRegistration) {
    await trackAuthed('first_google_registration', {
      pagePath: input.pagePath,
      registrationJourney: input.registrationJourney,
      created: true,
    })
  }
  if (boot.data?.onboardingRequired) {
    await trackAuthed('onboarding_started', {
      pagePath: input.pagePath,
      registrationJourney: input.registrationJourney,
    })
  }

  if (boot.data?.blocked) {
    return { ok: false, message: boot.data.blockReason || 'Access denied.' }
  }

  return {
    ok: true,
    redirectPath: boot.data?.redirectPath || '/auth/role-selection?google=1',
    profile: boot.data?.profile || null,
  }
}
