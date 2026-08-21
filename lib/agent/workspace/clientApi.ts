'use client'

import { authFetch } from '@/lib/api/authenticatedFetch'

export class WorkspaceApiError extends Error {
  status: number
  reason?: string

  constructor(message: string, status: number, reason?: string) {
    super(message)
    this.name = 'WorkspaceApiError'
    this.status = status
    this.reason = reason
  }
}

async function parseWorkspaceResponse<T>(res: Response): Promise<T> {
  const json = await res.json().catch(() => ({}))
  if (!res.ok || json.success === false) {
    throw new WorkspaceApiError(
      json.error || `Request failed (${res.status})`,
      res.status,
      typeof json.reason === 'string' ? json.reason : undefined
    )
  }
  return json.data as T
}

export async function workspaceGet<T = unknown>(path: string): Promise<T> {
  const res = await authFetch(path)
  return parseWorkspaceResponse<T>(res)
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
  return parseWorkspaceResponse<T>(res)
}
