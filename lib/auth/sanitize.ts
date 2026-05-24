/** Strip undefined values before Firestore client writes */
export function sanitizeClientData<T extends Record<string, unknown>>(value: T): T {
  const result = {} as T
  for (const [key, nested] of Object.entries(value)) {
    if (nested === undefined) continue
    result[key as keyof T] = nested as T[keyof T]
  }
  return result
}
