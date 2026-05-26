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
  'auth/invalid-login-credentials': 'Invalid email or password. Please try again.',
  'auth/user-disabled': 'This account has been disabled. Contact support.',
  'auth/operation-not-allowed': 'Email/password sign-in is not enabled for this project.',
  'auth/unauthorized-domain':
    'This site is not authorized for sign-in. Add www.tenderbriefing.co.za in Firebase Auth → Settings → Authorized domains.',
  'auth/configuration-not-found': 'Authentication is not configured correctly. Contact support.',
  'auth/invalid-api-key': 'Sign-in is misconfigured (API key). Contact support.',
  'auth/internal-error': 'Sign-in temporarily unavailable. Please try again in a moment.',
  'permission-denied':
    'Your account was created but profile setup failed. Try signing in, or contact support if this continues.',
  'failed-precondition':
    'Database is not ready. Please refresh and try again.',
  'unavailable': 'Service temporarily unavailable. Please try again.',
}

export function normalizeAuthEmail(email: string): string {
  return email.trim().toLowerCase()
}

function codeFromUnknown(error: unknown): string | null {
  if (error instanceof FirebaseError) return error.code
  if (error && typeof error === 'object' && 'code' in error) {
    const code = (error as { code?: string }).code
    if (typeof code === 'string' && code) return code
  }
  if (error instanceof Error) {
    const withCode = error as Error & { code?: string }
    if (withCode.code) return withCode.code
    const paren = error.message.match(/\(auth\/[^)]+\)/)
    if (paren) return paren[0].slice(1, -1)
    if (/INVALID_LOGIN_CREDENTIALS/i.test(error.message)) {
      return 'auth/invalid-credential'
    }
    if (/EMAIL_NOT_FOUND/i.test(error.message)) return 'auth/user-not-found'
    if (/INVALID_PASSWORD/i.test(error.message)) return 'auth/wrong-password'
  }
  return null
}

export function getAuthErrorMessage(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  const code = codeFromUnknown(error)
  if (code && AUTH_ERROR_MESSAGES[code]) return AUTH_ERROR_MESSAGES[code]
  if (error instanceof Error && error.message && !error.message.includes('Firebase: Error')) {
    return error.message
  }
  return fallback
}
