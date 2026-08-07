import { describe, expect, it } from 'vitest'
import {
  explainPayFastUserError,
  isPayFastSameAccountError,
  PAYFAST_SAME_ACCOUNT_HINT,
} from '@/lib/payments/payfastUserErrors'

describe('payfastUserErrors', () => {
  it('detects PayFast same-account hosted error copy', () => {
    expect(
      isPayFastSameAccountError(
        'Merchant is unable to receive payments from the same account'
      )
    ).toBe(true)
    expect(isPayFastSameAccountError('Payment cancelled by user')).toBe(false)
  })

  it('explains same-account failures with actionable guidance', () => {
    expect(
      explainPayFastUserError(
        'Error 400: Merchant is unable to receive payments from the same account'
      )
    ).toBe(PAYFAST_SAME_ACCOUNT_HINT)
    expect(explainPayFastUserError('network timeout')).toBeNull()
  })
})
