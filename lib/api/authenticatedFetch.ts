'use client'

import { auth } from '@/lib/firebase'

export async function getAuthHeaders(
  extra: Record<string, string> = {},
  options: { json?: boolean } = { json: true }
): Promise<HeadersInit> {
  const user = auth.currentUser
  const headers: Record<string, string> = { ...extra }
  if (options.json !== false && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json'
  }
  if (!user) return headers
  const token = await user.getIdToken()
  headers.Authorization = `Bearer ${token}`
  return headers
}

export async function authFetch(
  input: RequestInfo | URL,
  init: RequestInit = {}
): Promise<Response> {
  const isFormData = typeof FormData !== 'undefined' && init.body instanceof FormData
  const headers = await getAuthHeaders(
    (init.headers as Record<string, string>) || {},
    { json: !isFormData }
  )
  return fetch(input, { ...init, headers })
}
