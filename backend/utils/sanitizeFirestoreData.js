/**
 * Recursively remove `undefined` values before Firestore writes.
 * Preserves null, false, 0, empty strings, and empty arrays.
 */

function isFirestoreTimestamp(value) {
  return (
    value &&
    typeof value === 'object' &&
    typeof value.toDate === 'function' &&
    typeof value.seconds === 'number'
  )
}

function isPlainObject(value) {
  if (!value || typeof value !== 'object') return false
  if (Array.isArray(value)) return false
  if (value instanceof Date) return false
  if (isFirestoreTimestamp(value)) return false
  const proto = Object.getPrototypeOf(value)
  return proto === Object.prototype || proto === null
}

function sanitizeFirestoreData(value) {
  if (value === undefined) {
    return undefined
  }

  if (value === null) {
    return null
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => sanitizeFirestoreData(item))
      .filter((item) => item !== undefined)
  }

  if (value instanceof Date || isFirestoreTimestamp(value)) {
    return value
  }

  if (isPlainObject(value)) {
    const result = {}
    for (const [key, nested] of Object.entries(value)) {
      if (nested === undefined) continue
      const sanitized = sanitizeFirestoreData(nested)
      if (sanitized !== undefined) {
        result[key] = sanitized
      }
    }
    return result
  }

  return value
}

module.exports = {
  sanitizeFirestoreData,
}
