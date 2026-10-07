import { describe, expect, it } from 'vitest'
import {
  isSafeReturnPath,
  signInWithReturnHref,
  withReturnRedirect,
} from '@/lib/auth/safeReturnPath'

describe('safeReturnPath', () => {
  it('allows internal relative paths only', () => {
    expect(isSafeReturnPath('/tenders/tb-1/request-agent')).toBe(true)
    expect(
      isSafeReturnPath('/sme/requests/payment-success?requestId=req-1')
    ).toBe(true)
    expect(isSafeReturnPath('https://evil.example/phish')).toBe(false)
    expect(isSafeReturnPath('//evil.example')).toBe(false)
    expect(isSafeReturnPath('')).toBe(false)
  })

  it('builds sign-in and role-selection links that preserve return path', () => {
    expect(signInWithReturnHref('/tenders/x/request-agent')).toBe(
      `/auth/signin?redirect=${encodeURIComponent('/tenders/x/request-agent')}`
    )
    expect(
      withReturnRedirect('/auth/role-selection?recover=1', '/tenders/x/request-agent')
    ).toBe(
      `/auth/role-selection?recover=1&redirect=${encodeURIComponent('/tenders/x/request-agent')}`
    )
  })
})
