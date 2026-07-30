'use client'

import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  linkWithCredential,
  fetchSignInMethodsForEmail,
  signInWithEmailAndPassword,
  type AuthCredential,
  type User,
  type UserCredential,
} from 'firebase/auth'
import { FirebaseError } from 'firebase/app'
import { auth } from '@/lib/firebase'
import { getAuthErrorMessage, normalizeAuthEmail } from '@/lib/auth/errors'
import { sanitizeAuthErrorCode } from '@/lib/auth/googleAuthFlow'

const PENDING_CRED_KEY = 'tb_pending_google_credential'
const PENDING_EMAIL_KEY = 'tb_pending_link_email'

function createGoogleProvider() {
  const provider = new GoogleAuthProvider()
  provider.setCustomParameters({ prompt: 'select_account' })
  provider.addScope('email')
  provider.addScope('profile')
  return provider
}

function isMobileUserAgent(): boolean {
  if (typeof navigator === 'undefined') return false
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
}

export type GoogleSignInResult =
  | { ok: true; user: User; credential: UserCredential; usedRedirect: boolean }
  | {
      ok: false
      code: string
      message: string
      needsAccountLink?: boolean
      email?: string
    }

/**
 * Sign in with Google via popup (desktop) with redirect fallback for mobile / blocked popups.
 */
export async function signInWithGoogle(options?: {
  preferRedirect?: boolean
}): Promise<GoogleSignInResult> {
  const provider = createGoogleProvider()
  const preferRedirect = options?.preferRedirect === true || isMobileUserAgent()

  try {
    if (preferRedirect) {
      await signInWithRedirect(auth, provider)
      // Navigation away — caller should treat as pending redirect.
      return {
        ok: false,
        code: 'auth/redirect-pending',
        message: 'Redirecting to Google…',
      }
    }

    const credential = await signInWithPopup(auth, provider)
    return { ok: true, user: credential.user, credential, usedRedirect: false }
  } catch (error: unknown) {
    const code =
      error instanceof FirebaseError
        ? error.code
        : error && typeof error === 'object' && 'code' in error
          ? String((error as { code?: string }).code || 'unknown')
          : 'unknown'

    if (code === 'auth/popup-blocked' || code === 'auth/cancelled-popup-request') {
      try {
        await signInWithRedirect(auth, provider)
        return {
          ok: false,
          code: 'auth/redirect-pending',
          message: 'Popup was blocked — redirecting to Google…',
        }
      } catch (redirectError) {
        return {
          ok: false,
          code: sanitizeAuthErrorCode(
            redirectError instanceof FirebaseError ? redirectError.code : code
          ),
          message: getAuthErrorMessage(redirectError, 'Could not start Google sign-in.'),
        }
      }
    }

    if (code === 'auth/account-exists-with-different-credential' && error instanceof FirebaseError) {
      const email =
        typeof error.customData?.email === 'string'
          ? normalizeAuthEmail(error.customData.email)
          : undefined
      const pending = GoogleAuthProvider.credentialFromError(error)
      if (email && pending) {
        storePendingGoogleCredential(email, pending)
      }
      return {
        ok: false,
        code,
        message:
          'An account already exists with this email using a different sign-in method. Sign in with your password to link Google.',
        needsAccountLink: true,
        email,
      }
    }

    if (code === 'auth/popup-closed-by-user') {
      return {
        ok: false,
        code,
        message: 'Google sign-in was cancelled.',
      }
    }

    return {
      ok: false,
      code: sanitizeAuthErrorCode(code),
      message: getAuthErrorMessage(error, 'Google sign-in failed. Please try again.'),
    }
  }
}

/** Complete a Google redirect sign-in if one is pending. */
export async function completeGoogleRedirectIfPresent(): Promise<GoogleSignInResult | null> {
  try {
    const result = await getRedirectResult(auth)
    if (!result) return null
    return { ok: true, user: result.user, credential: result, usedRedirect: true }
  } catch (error: unknown) {
    const code = error instanceof FirebaseError ? error.code : 'unknown'
    if (code === 'auth/account-exists-with-different-credential' && error instanceof FirebaseError) {
      const email =
        typeof error.customData?.email === 'string'
          ? normalizeAuthEmail(error.customData.email)
          : undefined
      const pending = GoogleAuthProvider.credentialFromError(error)
      if (email && pending) storePendingGoogleCredential(email, pending)
      return {
        ok: false,
        code,
        message:
          'An account already exists with this email using a different sign-in method. Sign in with your password to link Google.',
        needsAccountLink: true,
        email,
      }
    }
    return {
      ok: false,
      code: sanitizeAuthErrorCode(code),
      message: getAuthErrorMessage(error, 'Google redirect sign-in failed.'),
    }
  }
}

export function storePendingGoogleCredential(email: string, credential: AuthCredential) {
  if (typeof sessionStorage === 'undefined') return
  try {
    sessionStorage.setItem(PENDING_EMAIL_KEY, normalizeAuthEmail(email))
    sessionStorage.setItem(PENDING_CRED_KEY, JSON.stringify(credential.toJSON()))
  } catch {
    /* ignore quota / private mode */
  }
}

export function clearPendingGoogleCredential() {
  if (typeof sessionStorage === 'undefined') return
  try {
    sessionStorage.removeItem(PENDING_EMAIL_KEY)
    sessionStorage.removeItem(PENDING_CRED_KEY)
  } catch {
    /* ignore */
  }
}

export function getPendingLinkEmail(): string | null {
  if (typeof sessionStorage === 'undefined') return null
  try {
    return sessionStorage.getItem(PENDING_EMAIL_KEY)
  } catch {
    return null
  }
}

/**
 * After Email/Password sign-in, link the pending Google credential if present.
 * Proves ownership of the password account before merging providers.
 */
export async function linkPendingGoogleCredential(user: User): Promise<{
  linked: boolean
  message?: string
}> {
  if (typeof sessionStorage === 'undefined') return { linked: false }
  let raw: string | null = null
  try {
    raw = sessionStorage.getItem(PENDING_CRED_KEY)
  } catch {
    return { linked: false }
  }
  if (!raw) return { linked: false }

  try {
    const data = JSON.parse(raw) as Record<string, unknown>
    const credential = GoogleAuthProvider.credential(
      typeof data.oauthIdToken === 'string' ? data.oauthIdToken : undefined,
      typeof data.oauthAccessToken === 'string' ? data.oauthAccessToken : undefined
    )
    await linkWithCredential(user, credential)
    clearPendingGoogleCredential()
    return { linked: true }
  } catch (error: unknown) {
    clearPendingGoogleCredential()
    return {
      linked: false,
      message: getAuthErrorMessage(error, 'Could not link Google to this account.'),
    }
  }
}

/**
 * Password sign-in then link pending Google credential (account-exists recovery).
 */
export async function signInWithPasswordAndLinkGoogle(
  email: string,
  password: string
): Promise<{ user: User; linked: boolean; linkMessage?: string }> {
  const normalized = normalizeAuthEmail(email)
  const methods = await fetchSignInMethodsForEmail(auth, normalized)
  if (methods.length && !methods.includes('password')) {
    throw Object.assign(new Error('This email does not use password sign-in.'), {
      code: 'auth/account-exists-with-different-credential',
    })
  }
  const { user } = await signInWithEmailAndPassword(auth, normalized, password)
  const link = await linkPendingGoogleCredential(user)
  return { user, linked: link.linked, linkMessage: link.message }
}

export function providerIdsFromUser(user: User): string[] {
  return (user.providerData || []).map((p) => p.providerId).filter(Boolean)
}
