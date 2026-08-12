import { describe, expect, it } from 'vitest'
import crypto from 'crypto'

/**
 * Mirrors backend/services/integrations/payfastService.js encoding + ITN verify.
 */
function pfEncode(value: string): string {
  return encodeURIComponent(String(value).trim())
    .replace(/%20/g, '+')
    .replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)
}

function verifyItnSignature(
  posted: Record<string, string>,
  passphrase = 'test-pass'
): { ok: boolean; reason?: string } {
  const received = String(posted.signature || '').toLowerCase()
  if (!received) return { ok: false, reason: 'Missing ITN signature' }

  let paramString = ''
  for (const [key, value] of Object.entries(posted)) {
    if (key === 'signature') break
    const raw = value === undefined || value === null ? '' : String(value)
    paramString += `${key}=${pfEncode(raw)}&`
  }
  paramString = paramString.slice(0, -1)
  if (passphrase) {
    paramString += `&passphrase=${pfEncode(passphrase)}`
  }
  const expected = crypto.createHash('md5').update(paramString).digest('hex')
  return { ok: expected === received, reason: expected === received ? undefined : 'Invalid ITN signature' }
}

/** Legacy buggy verifier that skipped empty fields (production incident root cause). */
function verifyItnSignatureSkipEmpty(
  posted: Record<string, string>,
  passphrase = 'test-pass'
): boolean {
  const received = String(posted.signature || '').toLowerCase()
  let paramString = ''
  for (const [key, value] of Object.entries(posted)) {
    if (key === 'signature') continue
    if (value === undefined || value === null || String(value).trim() === '') continue
    paramString += `${key}=${pfEncode(value)}&`
  }
  paramString = paramString.slice(0, -1)
  if (passphrase) paramString += `&passphrase=${pfEncode(passphrase)}`
  return crypto.createHash('md5').update(paramString).digest('hex') === received
}

function signItnIncludingEmpty(
  fields: Record<string, string>,
  passphrase: string
): string {
  let paramString = ''
  for (const [key, value] of Object.entries(fields)) {
    paramString += `${key}=${pfEncode(value)}&`
  }
  paramString = paramString.slice(0, -1) + `&passphrase=${pfEncode(passphrase)}`
  return crypto.createHash('md5').update(paramString).digest('hex')
}

describe('PayFast ITN signature helper', () => {
  it('accepts valid signature with empty ITN fields (PayFast real payload shape)', () => {
    const passphrase = 'test-pass'
    const posted: Record<string, string> = {
      m_payment_id: 'TB-REQ-req-abc',
      pf_payment_id: '320990497',
      payment_status: 'COMPLETE',
      item_name: 'Compulsory briefing attendance support',
      item_description: '',
      amount_gross: '249.00',
      amount_fee: '-11.46',
      amount_net: '237.54',
      custom_str1: 'req-abc',
      custom_str2: '',
      custom_str3: '',
      custom_str4: '',
      custom_str5: '',
      custom_int1: '',
      custom_int2: '',
      custom_int3: '',
      custom_int4: '',
      custom_int5: '',
      name_first: '',
      name_last: '',
      email_address: 'buyer@example.com',
      merchant_id: '10000100',
    }
    posted.signature = signItnIncludingEmpty(posted, passphrase)
    expect(verifyItnSignature(posted, passphrase).ok).toBe(true)
    // Proves the production defect: skipping empties rejects a legitimate ITN.
    expect(verifyItnSignatureSkipEmpty(posted, passphrase)).toBe(false)
  })

  it('accepts compact valid signature without empty fields', () => {
    const posted: Record<string, string> = {
      merchant_id: '10000100',
      payment_status: 'COMPLETE',
      amount_gross: '249.00',
      m_payment_id: 'TB-REQ-abc',
    }
    const pairs: string[] = []
    for (const key of Object.keys(posted)) {
      pairs.push(`${key}=${pfEncode(posted[key])}`)
    }
    pairs.push(`passphrase=${pfEncode('test-pass')}`)
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

  it('stops at signature key (PayFast sample algorithm)', () => {
    const passphrase = 'test-pass'
    const posted: Record<string, string> = {
      merchant_id: '10000100',
      amount_gross: '249.00',
      payment_status: 'COMPLETE',
    }
    posted.signature = signItnIncludingEmpty(posted, passphrase)
    // Trailing junk after signature must not affect verification.
    const withJunk = { ...posted, trailing_noise: 'should-be-ignored' }
    expect(verifyItnSignature(withJunk, passphrase).ok).toBe(true)
  })
})
