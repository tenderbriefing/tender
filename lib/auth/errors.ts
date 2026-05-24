import { FirebaseError } from 'firebase/app'

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  'auth/email-already-in-use':
    'This email is already registered. Sign in instead or use a different email.',
  'auth/invalid-email': 'Please enter a valid email address.',
  'auth/weak-password': 'Password must be at least 6 characters.',
  'auth/network-request-failed':
    'Network error. Check your connection and try again.',
  'auth/too-many-requests': 'Too many attempts. Please wait a moment and try again.',
  'auth/user-not-found': 'No account found with this email. Check the address or register.',
  'auth/wrong-password': 'Incorrect password. Try again or reset your password.',
  'auth/invalid-credential': 'Invalid email or password. Please try again.',
  'auth/user-disabled': 'This account has been disabled. Contact support.',
  'auth/operation-not-allowed': 'Email/password sign-in is not enabled for this project.',
  'auth/unauthorized-domain':
    'This domain is not authorized for sign-in. Contact support if this persists.',
  'auth/configuration-not-found': 'Authentication is not configured correctly. Contact support.',
  'permission-denied':
    'Could not save your profile. Please try again or contact support.',
}

export function normalizeAuthEmail(email: string): string {
  return email.trim().toLowerCase()
}

export function getAuthErrorMessage(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (error instanceof FirebaseError) {
    return AUTH_ERROR_MESSAGES[error.code] || fallback
  }
  if (error instanceof Error) {
    const code = (error as Error & { code?: string }).code
    if (code && AUTH_ERROR_MESSAGES[code]) return AUTH_ERROR_MESSAGES[code]
    if (error.message.includes('Firebase: Error')) {
      const match = error.message.match(/\(auth\/[^)]+\)/)
      if (match) {
        const firebaseCode = match[0].slice(1, -1)
        if (AUTH_ERROR_MESSAGES[firebaseCode]) return AUTH_ERROR_MESSAGES[firebaseCode]
      }
    }
  }
  return fallback
}
