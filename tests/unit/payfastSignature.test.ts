import { describe, expect, it } from 'vitest'
import crypto from 'crypto'

/**
 * Mirrors backend/services/integrations/payfastService.js verifyItnSignature logic
 * for regression coverage without requiring Firebase.
 */
function verifyItnSignature(
  posted: Record<string, string>,
  passphrase = 'test-pass'
): { ok: boolean; reason?: string } {
  const received = String(posted.signature || '').toLowerCase()
  if (!received) return { ok: false, reason: 'Missing ITN signature' }

  const pairs: string[] = []
  for (const key of Object.keys(posted)) {
    if (key === 'signature') continue
    const value = posted[key]
    if (value === undefined || value === null || value === '') continue
    pairs.push(`${key}=${encodeURIComponent(String(value).trim()).replace(/%20/g, '+')}`)
  }
  if (passphrase) {
    pairs.push(`passphrase=${encodeURIComponent(passphrase.trim()).replace(/%20/g, '+')}`)
  }
  const expected = crypto.createHash('md5').update(pairs.join('&')).digest('hex')
  return { ok: expected === received, reason: expected === received ? undefined : 'Invalid ITN signature' }
}

describe('PayFast ITN signature helper', () => {
  it('accepts valid signature', () => {
    const posted: Record<string, string> = {
      merchant_id: '10000100',
      payment_status: 'COMPLETE',
      amount_gross: '249.00',
      m_payment_id: 'TB-REQ-abc',
    }
    const pairs: string[] = []
    for (const key of Object.keys(posted)) {
      pairs.push(
        `${key}=${encodeURIComponent(String(posted[key]).trim()).replace(/%20/g, '+')}`
      )
    }
    pairs.push(`passphrase=${encodeURIComponent('test-pass').replace(/%20/g, '+')}`)
    posted.signature = crypto.createHash('md5').update(pairs.join('&')).digest('hex')
    expect(verifyItnSignature(posted).ok).toBe(true)
  })

  it('rejects missing and invalid signatures', () => {
    expect(verifyItnSignature({ merchant_id: '1' }).ok).toBe(false)
    expect(
      verifyItnSignature({
        merchant_id: '1',
        signature: 'deadbeef',
      }).ok
    ).toBe(false)
  })
})
