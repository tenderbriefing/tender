'use client'

import { auth } from '@/lib/firebase'

export async function getAuthHeaders(
  extra: Record<string, string> = {}
): Promise<HeadersInit> {
  const user = auth.currentUser
  if (!user) {
    return { 'Content-Type': 'application/json', ...extra }
  }
  const token = await user.getIdToken()
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    ...extra,
  }
}

export async function authFetch(
  input: RequestInfo | URL,
  init: RequestInit = {}
): Promise<Response> {
  const headers = await getAuthHeaders(
    (init.headers as Record<string, string>) || {}
  )
  return fetch(input, { ...init, headers })
}
