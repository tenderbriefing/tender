import {

  createUserWithEmailAndPassword,

  signInWithEmailAndPassword,

  sendPasswordResetEmail,

  confirmPasswordReset,

  verifyPasswordResetCode,

  signOut,

  onAuthStateChanged,

  User,

  updateProfile,

  deleteUser,

} from 'firebase/auth';

import { doc, getDoc } from 'firebase/firestore';

import { auth, db } from './firebase';

import { normalizeAuthEmail } from './auth/errors';

import { sanitizeClientData } from './auth/sanitize';



export type AgentVerificationStatus = 'pending' | 'verified' | 'suspended';



export interface UserProfile {

  uid: string;

  email: string;

  displayName: string;

  userType: 'sme' | 'youth-agent' | 'admin';

  /** Explicit founder console access (in addition to email allowlist). */
  founderAccess?: boolean;

  photoURL?: string | null;

  /** e.g. password | google — informational only; not an authorization source. */
  authenticationProvider?: string;

  providerIds?: string[];

  lastLoginAt?: string;

  lastSeenAt?: string;

  /** Soft suspension flag (agents may also use verificationStatus). */
  suspended?: boolean;

  companyName?: string;

  contactPerson?: string;

  phoneNumber?: string;

  location?: string;

  province?: string;

  city?: string;

  csdNumber?: string;

  skills?: string[];

  categories?: string[];

  commodities?: string[];

  matchingKeywords?: string[];

  sectors?: string[];

  provincesOfInterest?: string[];

  preferredDepartments?: string[];

  tenderInterests?: string;

  whatsAppNumber?: string;

  onboardingCompleted?: boolean;

  onboardingCompletedAt?: string;

  idVerificationNote?: string;

  codeOfConductAccepted?: boolean;

  codeOfConductAcceptedAt?: string;

  availabilityRadiusKm?: number;

  transportAvailable?: boolean;

  preferredServiceAreas?: string[];

  verificationStatus?: AgentVerificationStatus;

  reliabilityScore?: number;

  missedBriefingCount?: number;

  completedBriefingCount?: number;

  acceptedBriefingCount?: number;

  rating?: number;

  totalJobs?: number;

  createdAt: string;

  updatedAt: string;

  /** Set server-side after a one-time welcome email is sent (Resend). */
  welcomeEmailSentAt?: string;

}



function nowIso() {

  return new Date().toISOString();

}

function waitForAuthSession(expectedUser: User): Promise<void> {
  if (auth.currentUser?.uid === expectedUser.uid) {
    return Promise.resolve()
  }
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      unsubscribe()
      reject(new Error('auth/session-timeout'))
    }, 10000)
    const unsubscribe = onAuthStateChanged(auth, (sessionUser) => {
      if (sessionUser?.uid === expectedUser.uid) {
        clearTimeout(timeout)
        unsubscribe()
        resolve()
      }
    })
  })
}



async function completeRegistrationProfile(
  user: User,
  displayName: string,
  userType: 'sme' | 'youth-agent',
  additionalData?: Partial<UserProfile>
): Promise<{ userProfile: UserProfile; created: boolean }> {
  await user.getIdToken(true)
  await waitForAuthSession(user)
  const token = await user.getIdToken()

  const res = await fetch('/api/auth/bootstrap-profile', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      displayName: displayName.trim(),
      intendedRole: userType,
      registrationJourney: userType,
      additionalData: sanitizeClientData({
        onboardingCompleted: true,
        onboardingCompletedAt: nowIso(),
        ...additionalData,
      }),
    }),
  })

  const payload = (await res.json().catch(() => null)) as {
    success?: boolean
    error?: string
    data?: {
      created?: boolean
      userProfile?: UserProfile
      profile?: UserProfile
    }
  } | null

  const profile = payload?.data?.userProfile || payload?.data?.profile
  if (!res.ok || !payload?.success || !profile?.userType) {
    console.error(
      JSON.stringify({
        event: 'profile_setup_failed',
        context: 'client-signup',
        status: res.status,
        error: payload?.error || null,
        uid: user.uid,
      })
    )
    const err = new Error(
      payload?.error ||
        'Your account was created but profile setup failed. Try signing in, or contact support if this continues.'
    ) as Error & { code?: string }
    err.code = 'permission-denied'
    throw err
  }

  return {
    userProfile: profile as UserProfile,
    created: payload?.data?.created === true,
  }
}

export const signUp = async (
  email: string,
  password: string,
  displayName: string,
  userType: 'sme' | 'youth-agent' | 'admin',
  additionalData?: Partial<UserProfile>
) => {
  if (userType !== 'sme' && userType !== 'youth-agent') {
    const err = new Error('Choose SME or Youth Agent to register.') as Error & { code?: string }
    err.code = 'ROLE_REJECTED'
    throw err
  }

  const normalizedEmail = normalizeAuthEmail(email)
  let user: User
  let createdAuthUser = false

  try {
    const userCredential = await createUserWithEmailAndPassword(auth, normalizedEmail, password)
    user = userCredential.user
    createdAuthUser = true
  } catch (error: unknown) {
    // Recover orphaned Auth accounts from a previous failed profile write.
    const code =
      error && typeof error === 'object' && 'code' in error
        ? String((error as { code?: string }).code || '')
        : ''
    if (code !== 'auth/email-already-in-use') throw error
    const existing = await signInWithEmailAndPassword(auth, normalizedEmail, password)
    user = existing.user
    const existingProfile = await getUserProfile(user.uid)
    if (existingProfile?.userType) {
      return { user, userProfile: existingProfile, created: false }
    }
  }

  try {
    await updateProfile(user, { displayName: displayName.trim() })
    const { userProfile, created } = await completeRegistrationProfile(
      user,
      displayName,
      userType,
      additionalData
    )
    return { user, userProfile, created }
  } catch (error) {
    if (createdAuthUser) {
      try {
        await deleteUser(user)
      } catch {
        /* account may already be removed or require re-auth */
      }
    }
    throw error
  }
}



export const signIn = async (email: string, password: string) => {
  const normalizedEmail = normalizeAuthEmail(email)
  const userCredential = await signInWithEmailAndPassword(auth, normalizedEmail, password)
  const user = userCredential.user

  let userProfile: UserProfile | null = null
  try {
    const userDoc = await getDoc(doc(db, 'users', user.uid))
    if (userDoc.exists()) {
      userProfile = userDoc.data() as UserProfile
    }
  } catch (error) {
    const err = error as Error & { code?: string }
    err.code = err.code || 'permission-denied'
    throw err
  }

  return { user, userProfile }
}

const PRODUCTION_AUTH_CONTINUE_URL = 'https://www.tenderbriefing.co.za/auth/signin'

function passwordResetContinueUrl(): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    const origin = window.location.origin.replace(/\/$/, '')
    if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
      return `${origin}/auth/signin`
    }
    if (origin.includes('tenderbriefing.co.za')) {
      return `${origin}/auth/signin`
    }
  }
  return PRODUCTION_AUTH_CONTINUE_URL
}

/** Sends Firebase password-reset email. Continue URL lands on sign-in after reset. */
export const requestPasswordReset = async (email: string) => {
  const normalizedEmail = normalizeAuthEmail(email)
  await sendPasswordResetEmail(auth, normalizedEmail, {
    url: passwordResetContinueUrl(),
    handleCodeInApp: false,
  })
}

/** Verifies a password-reset oobCode from the email link (custom action handler). */
export const verifyResetCode = async (oobCode: string) => {
  return verifyPasswordResetCode(auth, oobCode)
}

/** Completes password reset when using a custom action handler page. */
export const completePasswordReset = async (oobCode: string, newPassword: string) => {
  await confirmPasswordReset(auth, oobCode, newPassword)
}

export const logout = async () => {

  await signOut(auth);

};



export const getCurrentUser = (): Promise<User | null> => {

  return new Promise((resolve) => {

    const unsubscribe = onAuthStateChanged(auth, (user) => {

      unsubscribe();

      resolve(user);

    });

  });

};



export const getUserProfile = async (uid: string): Promise<UserProfile | null> => {

  try {

    const userDoc = await getDoc(doc(db, 'users', uid));

    if (userDoc.exists()) {

      return userDoc.data() as UserProfile;

    }

    return null;

  } catch (error) {

    console.error('Error getting user profile:', error);

    return null;

  }

};


