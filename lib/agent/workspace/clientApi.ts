'use client'

import { authFetch } from '@/lib/api/authenticatedFetch'

export async function workspaceGet<T = unknown>(path: string): Promise<T> {
  const res = await authFetch(path)
  const json = await res.json()
  if (!res.ok || json.success === false) {
    throw new Error(json.error || `Request failed (${res.status})`)
  }
  return json.data as T
}

export async function workspaceMutate<T = unknown>(
  path: string,
  method: 'POST' | 'PUT' | 'PATCH',
  body?: unknown
): Promise<T> {
  const res = await authFetch(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body != null ? JSON.stringify(body) : undefined,
  })
  const json = await res.json()
  if (!res.ok || json.success === false) {
    throw new Error(json.error || `Request failed (${res.status})`)
  }
  return json.data as T
}
