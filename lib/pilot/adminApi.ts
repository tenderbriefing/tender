import { auth } from '@/lib/firebase'

export async function adminPilotFetch(path: string, init?: RequestInit) {
  const token = await auth.currentUser?.getIdToken()
  if (!token) throw new Error('Sign in required')
  const res = await fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init?.headers || {}),
    },
  })
  const json = await res.json()
  if (!json.success) throw new Error(json.error || 'Request failed')
  return json.data
}
