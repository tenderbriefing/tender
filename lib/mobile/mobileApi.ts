import { authFetch } from '@/lib/api/authenticatedFetch'

export async function mobileGet<T>(path: string): Promise<T> {
  const res = await authFetch(path)
  const json = await res.json()
  if (!json.success) throw new Error(json.error || 'Request failed')
  return json.data as T
}

export async function mobilePost<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const res = await authFetch(path, {
    method: 'POST',
    body: JSON.stringify(body),
  })
  const json = await res.json()
  if (!json.success) throw new Error(json.error || 'Request failed')
  return json.data as T
}

export async function mobileUpload(path: string, formData: FormData) {
  const res = await authFetch(path, { method: 'POST', body: formData })
  const json = await res.json()
  if (!json.success) throw new Error(json.error || 'Upload failed')
  return json.data
}
