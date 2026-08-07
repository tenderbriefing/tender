import { afterEach, describe, expect, it } from 'vitest'

/**
 * Exercises createCheckoutPayload email omit guard against PAYFAST_MERCHANT_EMAIL.
 */
describe('PayFast checkout email_address same-account guard', () => {
  const prev = {
    id: process.env.PAYFAST_MERCHANT_ID,
    key: process.env.PAYFAST_MERCHANT_KEY,
    pass: process.env.PAYFAST_PASSPHRASE,
    mode: process.env.PAYFAST_MODE,
    merchantEmail: process.env.PAYFAST_MERCHANT_EMAIL,
  }

  afterEach(() => {
    process.env.PAYFAST_MERCHANT_ID = prev.id
    process.env.PAYFAST_MERCHANT_KEY = prev.key
    process.env.PAYFAST_PASSPHRASE = prev.pass
    process.env.PAYFAST_MODE = prev.mode
    if (prev.merchantEmail === undefined) delete process.env.PAYFAST_MERCHANT_EMAIL
    else process.env.PAYFAST_MERCHANT_EMAIL = prev.merchantEmail
    // Clear require cache so env reads refresh
    delete require.cache[
      require.resolve('../../backend/services/integrations/payfastService.js')
    ]
  })

  function loadService() {
    delete require.cache[
      require.resolve('../../backend/services/integrations/payfastService.js')
    ]
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('../../backend/services/integrations/payfastService.js')
  }

  it('includes buyer email when it differs from PAYFAST_MERCHANT_EMAIL', () => {
    process.env.PAYFAST_MERCHANT_ID = '10000100'
    process.env.PAYFAST_MERCHANT_KEY = 'testkey'
    process.env.PAYFAST_PASSPHRASE = 'phrase'
    process.env.PAYFAST_MODE = 'sandbox'
    process.env.PAYFAST_MERCHANT_EMAIL = 'merchant@example.com'

    const payfast = loadService()
    const result = payfast.createCheckoutPayload({
      amountCents: 24900,
      mPaymentId: 'TB-REQ-test',
      itemName: 'Test',
      returnUrl: 'https://example.com/ok',
      cancelUrl: 'https://example.com/cancel',
      notifyUrl: 'https://example.com/itn',
      email: 'buyer@example.com',
    })

    expect(result.ok).toBe(true)
    expect(result.fields.email_address).toBe('buyer@example.com')
    expect(result.fields.signature).toBeTruthy()
  })

  it('omits email_address when buyer matches PAYFAST_MERCHANT_EMAIL', () => {
    process.env.PAYFAST_MERCHANT_ID = '10000100'
    process.env.PAYFAST_MERCHANT_KEY = 'testkey'
    process.env.PAYFAST_PASSPHRASE = 'phrase'
    process.env.PAYFAST_MODE = 'sandbox'
    process.env.PAYFAST_MERCHANT_EMAIL = 'Merchant@Example.com'

    const payfast = loadService()
    const result = payfast.createCheckoutPayload({
      amountCents: 24900,
      mPaymentId: 'TB-REQ-test',
      itemName: 'Test',
      returnUrl: 'https://example.com/ok',
      cancelUrl: 'https://example.com/cancel',
      notifyUrl: 'https://example.com/itn',
      email: 'merchant@example.com',
    })

    expect(result.ok).toBe(true)
    expect(result.fields.email_address).toBeUndefined()
    expect(result.fields.signature).toBeTruthy()
  })
})
