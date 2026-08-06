import type { Firestore } from 'firebase-admin/firestore'
import type { UserProfile } from '@/lib/auth'
import {
  stripPrivilegedFields,
  type GoogleBootstrapRole,
} from '@/lib/auth/googleAuthFlow'

export function nowIso() {
  return new Date().toISOString()
}

/**
 * Strip client escalation / trust / onboarding fields before merging into a new profile.
 * Onboarding completion is decided server-side via createPlatformProfile input, never from
 * a raw client boolean alone.
 */
export function sanitizeRegistrationAdditional(
  data: Partial<UserProfile> | undefined
): Partial<UserProfile> {
  if (!data || typeof data !== 'object') return {}
  const stripped = stripPrivilegedFields({ ...data } as Record<string, unknown>)
  delete stripped.uid
  delete stripped.email
  delete stripped.verified
  delete stripped.onboardingCompleted
  delete stripped.onboardingCompletedAt
  for (const [key, value] of Object.entries(stripped)) {
    if (value === undefined) delete stripped[key]
  }
  return stripped as Partial<UserProfile>
}

/**
 * Structured full email-registration payload (signup form), not a Google minimal bootstrap.
 * Server uses this to decide onboardingCompleted — never trusts client boolean alone.
 */
export function hasFullRegistrationPayload(
  role: GoogleBootstrapRole,
  data: Partial<UserProfile> | undefined
): boolean {
  if (!data || typeof data !== 'object') return false
  const phone =
    typeof data.phoneNumber === 'string' && data.phoneNumber.trim().length > 0
  const province =
    typeof data.province === 'string' && data.province.trim().length > 0
  if (!phone || !province) return false

  if (role === 'sme') {
    const company =
      typeof data.companyName === 'string' && data.companyName.trim().length > 0
    const categories = Array.isArray(data.categories) && data.categories.length > 0
    return company && categories
  }

  const city = typeof data.city === 'string' && data.city.trim().length > 0
  return city
}

export type CreatePlatformProfileInput = {
  uid: string
  email: string
  displayName: string
  role: GoogleBootstrapRole
  authenticationProvider: string
  providerIds: string[]
  photoURL?: string | null
  additionalData?: Partial<UserProfile>
  /**
   * Server-decided onboarding flag only. Client additionalData.onboardingCompleted is stripped.
   * Email full-form registration may pass true; Google minimal bootstrap must pass false/omit.
   */
  onboardingCompleted?: boolean
}

/**
 * Creates users/{uid} + smes|agents + activity summary via Admin SDK.
 * Never sets founderAccess or admin.
 */
export async function createPlatformProfile(
  db: Firestore,
  input: CreatePlatformProfileInput
): Promise<UserProfile> {
  const timestamp = nowIso()
  const extra = sanitizeRegistrationAdditional(input.additionalData)
  // Only the trusted server input — never extra.onboardingCompleted.
  const onboardingCompleted = input.onboardingCompleted === true

  const userProfile: UserProfile = {
    uid: input.uid,
    email: input.email,
    displayName: input.displayName,
    userType: input.role,
    photoURL: input.photoURL ?? null,
    authenticationProvider: input.authenticationProvider,
    providerIds: input.providerIds,
    founderAccess: false,
    createdAt: timestamp,
    updatedAt: timestamp,
    lastLoginAt: timestamp,
    lastSeenAt: timestamp,
    ...extra,
    onboardingCompleted,
  }

  if (onboardingCompleted) {
    userProfile.onboardingCompletedAt = timestamp
  } else {
    delete (userProfile as { onboardingCompletedAt?: string }).onboardingCompletedAt
  }

  if (input.role === 'youth-agent') {
    // Force server defaults for trust metrics — never accept client values.
    userProfile.verificationStatus = 'pending'
    userProfile.reliabilityScore = 100
    userProfile.missedBriefingCount = 0
    userProfile.completedBriefingCount = 0
    userProfile.acceptedBriefingCount = 0
    userProfile.rating = 3
  }

  // Re-assert non-escalatable fields after merge.
  userProfile.uid = input.uid
  userProfile.email = input.email
  userProfile.userType = input.role
  userProfile.founderAccess = false
  userProfile.onboardingCompleted = onboardingCompleted

  // Firestore Admin rejects `undefined` field values.
  const profileDoc = Object.fromEntries(
    Object.entries(userProfile).filter(([, value]) => value !== undefined)
  ) as UserProfile

  const userRef = db.collection('users').doc(input.uid)
  await userRef.set(profileDoc)

  if (input.role === 'sme') {
    await db.collection('smes').doc(input.uid).set(
      {
        id: input.uid,
        uid: input.uid,
        email: input.email,
        displayName: input.displayName,
        companyName: userProfile.companyName || '',
        contactPerson: userProfile.contactPerson || input.displayName,
        phoneNumber: userProfile.phoneNumber || '',
        province: userProfile.province || '',
        location: userProfile.location || '',
        categories: userProfile.categories || [],
        commodities: userProfile.commodities || [],
        matchingKeywords: userProfile.matchingKeywords || [],
        sectors: userProfile.sectors || userProfile.categories || [],
        provincesOfInterest: userProfile.provincesOfInterest || [],
        csdNumber: userProfile.csdNumber || '',
        preferredDepartments: userProfile.preferredDepartments || [],
        tenderInterests: userProfile.tenderInterests || '',
        whatsAppNumber: userProfile.whatsAppNumber || userProfile.phoneNumber || '',
        onboardingCompleted,
        onboardingCompletedAt: profileDoc.onboardingCompletedAt || '',
        userType: 'sme',
        createdAt: timestamp,
        updatedAt: timestamp,
      },
      { merge: true }
    )
  } else {
    await db.collection('agents').doc(input.uid).set(
      {
        id: input.uid,
        uid: input.uid,
        email: input.email,
        displayName: input.displayName,
        name: input.displayName,
        phoneNumber: userProfile.phoneNumber || '',
        province: userProfile.province || '',
        city: userProfile.city || '',
        location: userProfile.location || '',
        ...(userProfile.availabilityRadiusKm != null
          ? { availabilityRadiusKm: userProfile.availabilityRadiusKm }
          : {}),
        ...(typeof userProfile.transportAvailable === 'boolean'
          ? { transportAvailable: userProfile.transportAvailable }
          : {}),
        preferredServiceAreas: userProfile.preferredServiceAreas || [],
        whatsAppNumber: userProfile.whatsAppNumber || userProfile.phoneNumber || '',
        idVerificationNote: userProfile.idVerificationNote || '',
        codeOfConductAccepted: userProfile.codeOfConductAccepted === true,
        onboardingCompleted,
        onboardingCompletedAt: profileDoc.onboardingCompletedAt || '',
        verificationStatus: 'pending',
        verified: false,
        reliabilityScore: 100,
        missedBriefingCount: 0,
        completedBriefingCount: 0,
        acceptedBriefingCount: 0,
        rating: 3,
        userType: 'youth-agent',
        availability: 'available',
        createdAt: timestamp,
        updatedAt: timestamp,
      },
      { merge: true }
    )
  }

  await db.collection('userActivitySummaries').doc(input.uid).set(
    {
      uid: input.uid,
      actorRole: input.role,
      authenticationProvider: input.authenticationProvider,
      registrationDate: timestamp,
      firstSeenAt: timestamp,
      lastLoginAt: timestamp,
      lastSeenAt: timestamp,
      updatedAt: timestamp,
    },
    { merge: true }
  )

  return profileDoc
}

export function logProfileSetupFailure(context: string, details: Record<string, unknown>) {
  console.error(
    JSON.stringify({
      event: 'profile_setup_failed',
      context,
      ...details,
      at: nowIso(),
    })
  )
}
