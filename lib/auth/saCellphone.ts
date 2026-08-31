/**
 * South African cellphone validation / normalisation for NEW registrations.
 * Canonical persisted form: +27XXXXXXXXX (11 digits after +27 for mobile).
 *
 * Does not require existing users to have a number. Empty input → null (invalid for new signup).
 */

export const SA_CELLPHONE_EXAMPLE = '082 123 4567'
export const SA_CELLPHONE_INVALID_MESSAGE =
  'Enter a valid South African cellphone number (e.g. 082 123 4567).'

/** Digits only, no +. */
function digitsOnly(raw: string): string {
  return String(raw || '').replace(/\D/g, '')
}

/**
 * Normalise common SA mobile formats to E.164 (+27…).
 * Accepts: 0821234567, +27821234567, 27821234567, 082 123 4567, etc.
 * Returns null when missing or clearly invalid.
 */
export function normalizeSaCellphone(raw: string | null | undefined): string | null {
  const trimmed = String(raw || '').trim()
  if (!trimmed) return null

  let digits = digitsOnly(trimmed)
  if (!digits) return null

  // 00 27 … international prefix
  if (digits.startsWith('0027')) digits = digits.slice(2)

  if (digits.startsWith('27') && digits.length === 11) {
    // 27 + 9-digit national (leading 0 dropped) → mobile starts with 6/7/8
    const national = digits.slice(2)
    if (!/^[6-8]\d{8}$/.test(national)) return null
    return `+27${national}`
  }

  if (digits.startsWith('0') && digits.length === 10) {
    // 0 + 9 digits; mobile first digit after 0 is 6/7/8
    const national = digits.slice(1)
    if (!/^[6-8]\d{8}$/.test(national)) return null
    return `+27${national}`
  }

  // Bare 9-digit national (no leading 0 / country code)
  if (digits.length === 9 && /^[6-8]\d{8}$/.test(digits)) {
    return `+27${digits}`
  }

  return null
}

export function isValidSaCellphone(raw: string | null | undefined): boolean {
  return normalizeSaCellphone(raw) != null
}
