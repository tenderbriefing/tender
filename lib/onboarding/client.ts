import { doc, setDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { sanitizeClientData } from '@/lib/auth/sanitize'
import { stripPrivilegedFields } from '@/lib/auth/googleAuthFlow'
import type { UserProfile } from '@/lib/auth'
import { buildMatchingKeywords } from '@/lib/data/csdProcurementCatalog'

function nowIso() {
  return new Date().toISOString()
}

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
  uid: string,
  email: string,
  existing: Partial<UserProfile>,
  input: SmeOnboardingInput
) {
  const timestamp = nowIso()
  const matchingKeywords = buildMatchingKeywords(input.categories, input.commodities)
  const profilePatch = sanitizeClientData(
    stripPrivilegedFields({
      email,
      displayName: existing.displayName || input.companyName.trim(),
      companyName: input.companyName.trim(),
      csdNumber: input.csdNumber.trim(),
      province: input.province,
      categories: input.categories,
      commodities: input.commodities,
      matchingKeywords,
      sectors: input.categories,
      provincesOfInterest: [input.province],
      phoneNumber: input.whatsAppNumber.trim(),
      whatsAppNumber: input.whatsAppNumber.trim(),
      preferredDepartments: input.preferredDepartments,
      tenderInterests: input.tenderInterests.trim(),
      onboardingCompleted: true,
      onboardingCompletedAt: timestamp,
      updatedAt: timestamp,
    })
  )

  await setDoc(doc(db, 'users', uid), profilePatch, { merge: true })
  await setDoc(
    doc(db, 'smes', uid),
    sanitizeClientData({
      id: uid,
      uid,
      email,
      displayName: existing.displayName || input.companyName,
      companyName: input.companyName.trim(),
      contactPerson: existing.displayName || '',
      csdNumber: input.csdNumber.trim(),
      province: input.province,
      categories: input.categories,
      commodities: input.commodities,
      matchingKeywords,
      sectors: input.categories,
      preferredDepartments: input.preferredDepartments,
      tenderInterests: input.tenderInterests.trim(),
      phoneNumber: input.whatsAppNumber.trim(),
      whatsAppNumber: input.whatsAppNumber.trim(),
      provincesOfInterest: [input.province],
      userType: 'sme',
      onboardingCompleted: true,
      onboardingCompletedAt: timestamp,
      updatedAt: timestamp,
    }),
    { merge: true }
  )
  await trackOnboardingCompleted('sme')
}

export async function saveAgentOnboarding(
  uid: string,
  email: string,
  existing: Partial<UserProfile>,
  input: AgentOnboardingInput
) {
  const timestamp = nowIso()
  const profilePatch = sanitizeClientData(
    stripPrivilegedFields({
      email,
      displayName: input.displayName.trim(),
      province: input.province,
      city: input.city.trim(),
      location: `${input.city.trim()}, ${input.province}`,
      phoneNumber: input.whatsAppNumber.trim(),
      whatsAppNumber: input.whatsAppNumber.trim(),
      transportAvailable: input.transportAvailable,
      preferredServiceAreas: input.preferredServiceAreas.length
        ? input.preferredServiceAreas
        : [input.province],
      idVerificationNote: input.idVerificationNote.trim(),
      codeOfConductAccepted: input.codeOfConductAccepted,
      codeOfConductAcceptedAt: input.codeOfConductAccepted ? timestamp : undefined,
      onboardingCompleted: true,
      onboardingCompletedAt: timestamp,
      updatedAt: timestamp,
    })
  )

  await setDoc(doc(db, 'users', uid), profilePatch, { merge: true })
  await setDoc(
    doc(db, 'agents', uid),
    sanitizeClientData({
      id: uid,
      uid,
      email,
      displayName: input.displayName.trim(),
      name: input.displayName.trim(),
      province: input.province,
      city: input.city.trim(),
      location: `${input.city.trim()}, ${input.province}`,
      phoneNumber: input.whatsAppNumber.trim(),
      whatsAppNumber: input.whatsAppNumber.trim(),
      transportAvailable: input.transportAvailable,
      preferredServiceAreas: input.preferredServiceAreas.length
        ? input.preferredServiceAreas
        : [input.province],
      idVerificationNote: input.idVerificationNote.trim(),
      codeOfConductAccepted: input.codeOfConductAccepted,
      verificationStatus: existing.verificationStatus || 'pending',
      userType: 'youth-agent',
      onboardingCompleted: true,
      onboardingCompletedAt: timestamp,
      updatedAt: timestamp,
    }),
    { merge: true }
  )
  await trackOnboardingCompleted('youth-agent')
}
