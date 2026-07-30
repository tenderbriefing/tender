import type { Firestore } from 'firebase-admin/firestore'
import type { UserProfile } from '@/lib/auth'
import type { GoogleBootstrapRole } from '@/lib/auth/googleAuthFlow'

export function nowIso() {
  return new Date().toISOString()
}

/** Strip client escalation fields before merging into a new profile. */
export function sanitizeRegistrationAdditional(
  data: Partial<UserProfile> | undefined
): Partial<UserProfile> {
  if (!data || typeof data !== 'object') return {}
  const out: Record<string, unknown> = { ...data }
  delete out.uid
  delete out.email
  delete out.userType
  delete out.role
  delete out.founderAccess
  delete out.suspended
  if (out.verificationStatus != null && out.verificationStatus !== 'pending') {
    out.verificationStatus = 'pending'
  }
  for (const [key, value] of Object.entries(out)) {
    if (value === undefined) delete out[key]
  }
  return out as Partial<UserProfile>
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
  /** When omitted, defaults to false (Google-style) unless additionalData sets it. */
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
  const onboardingCompleted =
    input.onboardingCompleted === true || extra.onboardingCompleted === true

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
    onboardingCompletedAt:
      extra.onboardingCompletedAt || (onboardingCompleted ? timestamp : undefined),
  }

  if (input.role === 'youth-agent') {
    userProfile.verificationStatus = userProfile.verificationStatus || 'pending'
    userProfile.reliabilityScore = userProfile.reliabilityScore ?? 100
    userProfile.missedBriefingCount = userProfile.missedBriefingCount ?? 0
    userProfile.completedBriefingCount = userProfile.completedBriefingCount ?? 0
    userProfile.acceptedBriefingCount = userProfile.acceptedBriefingCount ?? 0
    userProfile.rating = userProfile.rating ?? 3
  }

  // Re-assert non-escalatable fields after merge.
  userProfile.uid = input.uid
  userProfile.email = input.email
  userProfile.userType = input.role
  userProfile.founderAccess = false

  const userRef = db.collection('users').doc(input.uid)
  await userRef.set(userProfile)

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
        onboardingCompletedAt: userProfile.onboardingCompletedAt || '',
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
        availabilityRadiusKm: userProfile.availabilityRadiusKm ?? 25,
        transportAvailable: userProfile.transportAvailable !== false,
        preferredServiceAreas: userProfile.preferredServiceAreas || [],
        whatsAppNumber: userProfile.whatsAppNumber || userProfile.phoneNumber || '',
        idVerificationNote: userProfile.idVerificationNote || '',
        codeOfConductAccepted: userProfile.codeOfConductAccepted === true,
        onboardingCompleted,
        onboardingCompletedAt: userProfile.onboardingCompletedAt || '',
        verificationStatus: 'pending',
        verified: false,
        reliabilityScore: userProfile.reliabilityScore ?? 100,
        missedBriefingCount: userProfile.missedBriefingCount ?? 0,
        completedBriefingCount: userProfile.completedBriefingCount ?? 0,
        acceptedBriefingCount: userProfile.acceptedBriefingCount ?? 0,
        rating: userProfile.rating ?? 3,
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

  return userProfile
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
