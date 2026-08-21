'use client'

import { auth } from '@/lib/firebase'
import { onAuthStateChanged, type User } from 'firebase/auth'

const AUTH_WAIT_MS = 8_000

/**
 * Wait briefly for Firebase Auth to restore a session before attaching a Bearer token.
 * Avoids racing workspace fetches ahead of onAuthStateChanged.
 */
export async function waitForAuthUser(timeoutMs = AUTH_WAIT_MS): Promise<User | null> {
  if (auth.currentUser) return auth.currentUser

  return new Promise((resolve) => {
    let settled = false
    const finish = (user: User | null) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      unsub()
      resolve(user)
    }
    const unsub = onAuthStateChanged(auth, (user) => finish(user))
    const timer = setTimeout(() => finish(auth.currentUser), timeoutMs)
  })
}

export async function getAuthHeaders(
  extra: Record<string, string> = {},
  options: { json?: boolean; forceRefresh?: boolean; waitForAuth?: boolean } = {
    json: true,
  }
): Promise<HeadersInit> {
  const headers: Record<string, string> = { ...extra }
  if (options.json !== false && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json'
  }

  const user =
    options.waitForAuth === false
      ? auth.currentUser
      : (await waitForAuthUser()) || auth.currentUser

  if (!user) return headers

  const token = await user.getIdToken(Boolean(options.forceRefresh))
  headers.Authorization = `Bearer ${token}`
  return headers
}

/**
 * Authenticated fetch with at most one forced token refresh after a 401.
 * Does not loop; does not invent credentials.
 */
export async function authFetch(
  input: RequestInfo | URL,
  init: RequestInit = {}
): Promise<Response> {
  const isFormData = typeof FormData !== 'undefined' && init.body instanceof FormData
  const headers = await getAuthHeaders(
    (init.headers as Record<string, string>) || {},
    { json: !isFormData }
  )
  const first = await fetch(input, { ...init, headers })

  if (first.status !== 401 || !auth.currentUser) {
    return first
  }

  // One controlled refresh/retry for expired tokens only.
  const retryHeaders = await getAuthHeaders(
    (init.headers as Record<string, string>) || {},
    { json: !isFormData, forceRefresh: true, waitForAuth: false }
  )
  if (!(retryHeaders as Record<string, string>).Authorization) {
    return first
  }
  return fetch(input, { ...init, headers: retryHeaders })
}
