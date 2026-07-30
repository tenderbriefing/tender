import { authFetch } from '@/lib/api/authenticatedFetch'
import type { UserProfile } from '@/lib/auth'
import { buildMatchingKeywords } from '@/lib/data/csdProcurementCatalog'

export interface SmeOnboardingInput {
  companyName: string
  csdNumber: string
  province: string
  categories: string[]
  commodities: string[]
  preferredDepartments: string[]
  whatsAppNumber: string
  tenderInterests: string
}

export interface AgentOnboardingInput {
  displayName: string
  province: string
  city: string
  whatsAppNumber: string
  transportAvailable: boolean
  preferredServiceAreas: string[]
  idVerificationNote: string
  codeOfConductAccepted: boolean
}

async function trackOnboardingCompleted(journey: 'sme' | 'youth-agent') {
  try {
    const { trackProductEvent } = await import('@/lib/founder/trackProductEvent')
    await trackProductEvent('onboarding_completed', {
      feature: 'onboarding',
      metadata: {
        authenticationProvider: 'unknown',
        registrationJourney: journey,
        deviceCategory:
          typeof window !== 'undefined' && window.innerWidth < 768 ? 'mobile' : 'desktop',
      },
    })
  } catch {
    /* non-blocking */
  }
}

export async function saveSmeOnboarding(
  _uid: string,
  _email: string,
  _existing: Partial<UserProfile>,
  input: SmeOnboardingInput
) {
  // Ensure keywords are consistent if callers inspect local state later.
  void buildMatchingKeywords(input.categories, input.commodities)

  const res = await authFetch('/api/auth/complete-onboarding', {
    method: 'POST',
    body: JSON.stringify({ journey: 'sme', input }),
  })
  const payload = (await res.json().catch(() => null)) as {
    success?: boolean
    error?: string
  } | null
  if (!res.ok || !payload?.success) {
    throw new Error(payload?.error || 'Could not save onboarding. Please try again.')
  }
  await trackOnboardingCompleted('sme')
}

export async function saveAgentOnboarding(
  _uid: string,
  _email: string,
  _existing: Partial<UserProfile>,
  input: AgentOnboardingInput
) {
  const res = await authFetch('/api/auth/complete-onboarding', {
    method: 'POST',
    body: JSON.stringify({ journey: 'youth-agent', input }),
  })
  const payload = (await res.json().catch(() => null)) as {
    success?: boolean
    error?: string
  } | null
  if (!res.ok || !payload?.success) {
    throw new Error(payload?.error || 'Could not save onboarding. Please try again.')
  }
  await trackOnboardingCompleted('youth-agent')
}
