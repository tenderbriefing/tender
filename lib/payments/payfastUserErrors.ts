/**
 * User-facing PayFast error copy. PayFast often surfaces same-account
 * failures on their hosted page (HTTP 400); we cannot intercept that response,
 * so cancel / retry surfaces explain how to complete payment.
 */

export const PAYFAST_SAME_ACCOUNT_HINT =
  'PayFast blocks payments when the payer uses the same PayFast login or email as the merchant receiving funds. Complete checkout with a different personal or business email (not the merchant account).'

export const PAYFAST_SAME_ACCOUNT_SHORT =
  'If PayFast said it cannot receive payments from the same account, pay with a different email / PayFast login than the merchant account.'

const SAME_ACCOUNT_RE =
  /unable to receive payments? from the same account|receive payment from the same account|same account/i

export function isPayFastSameAccountError(message: string | null | undefined): boolean {
  if (!message) return false
  return SAME_ACCOUNT_RE.test(String(message))
}

export function explainPayFastUserError(message: string | null | undefined): string | null {
  if (!message) return null
  if (isPayFastSameAccountError(message)) return PAYFAST_SAME_ACCOUNT_HINT
  return null
}
