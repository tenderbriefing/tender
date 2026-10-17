import { describe, expect, it } from 'vitest'
import {
  isValidSaCellphone,
  normalizeSaCellphone,
} from '@/lib/auth/saCellphone'
import {
  applyRegistrationCellphone,
  hasFullRegistrationPayload,
} from '@/lib/auth/serverProfileBootstrap'
import { resolvePostAuthDestination } from '@/lib/auth/googleAuthFlow'

describe('SA cellphone normalisation', () => {
  it('normalises common SA formats to +27…', () => {
    expect(normalizeSaCellphone('0821234567')).toBe('+27821234567')
    expect(normalizeSaCellphone('+27821234567')).toBe('+27821234567')
    expect(normalizeSaCellphone('27821234567')).toBe('+27821234567')
    expect(normalizeSaCellphone('082 123 4567')).toBe('+27821234567')
    expect(normalizeSaCellphone('083-987-6543')).toBe('+27839876543')
  })

  it('rejects missing and clearly invalid values', () => {
    expect(normalizeSaCellphone('')).toBeNull()
    expect(normalizeSaCellphone('123')).toBeNull()
    expect(normalizeSaCellphone('0111234567')).toBeNull() // landline-style 011
    expect(normalizeSaCellphone('abcdefghij')).toBeNull()
    expect(isValidSaCellphone('0821234567')).toBe(true)
    expect(isValidSaCellphone('')).toBe(false)
  })
})

describe('new SME registration cellphone', () => {
  const smeBase = {
    companyName: 'Acme Trading',
    province: 'Gauteng',
    categories: ['Cleaning Services'],
  }

  it('rejects registration without cellphone (full payload incomplete)', () => {
    expect(hasFullRegistrationPayload('sme', { ...smeBase })).toBe(false)
    expect(hasFullRegistrationPayload('sme', { ...smeBase, phoneNumber: '' })).toBe(false)
    expect(hasFullRegistrationPayload('sme', { ...smeBase, phoneNumber: '   ' })).toBe(false)
  })

  it('rejects invalid cellphone on applyRegistrationCellphone', () => {
    const bad = applyRegistrationCellphone({
      ...smeBase,
      phoneNumber: '0111234567',
    })
    expect(bad.ok).toBe(false)
    if (!bad.ok) expect(bad.error).toMatch(/cellphone/i)
  })

  it('accepts valid cellphone and normalises before persistence shape', () => {
    const applied = applyRegistrationCellphone({
      ...smeBase,
      phoneNumber: '0821234567',
    })
    expect(applied.ok).toBe(true)
    if (!applied.ok) return
    expect(applied.data.phoneNumber).toBe('+27821234567')
    expect(applied.data.whatsAppNumber).toBe('+27821234567')
    expect(hasFullRegistrationPayload('sme', applied.data)).toBe(true)
  })
})

describe('new Youth Agent registration cellphone', () => {
  const yaBase = {
    province: 'Western Cape',
    city: 'Cape Town',
  }

  it('rejects registration without cellphone', () => {
    expect(hasFullRegistrationPayload('youth-agent', { ...yaBase })).toBe(false)
    expect(
      hasFullRegistrationPayload('youth-agent', { ...yaBase, phoneNumber: 'not-a-number' })
    ).toBe(false)
  })

  it('accepts valid cellphone and normalises', () => {
    const applied = applyRegistrationCellphone({
      ...yaBase,
      phoneNumber: '+27821234567',
    })
    expect(applied.ok).toBe(true)
    if (!applied.ok) return
    expect(applied.data.phoneNumber).toBe('+27821234567')
    expect(hasFullRegistrationPayload('youth-agent', applied.data)).toBe(true)
  })

  it('normalises 27… prefix for agents', () => {
    const applied = applyRegistrationCellphone({
      ...yaBase,
      whatsAppNumber: '27839876543',
    })
    expect(applied.ok).toBe(true)
    if (!applied.ok) return
    expect(applied.data.phoneNumber).toBe('+27839876543')
  })
})

describe('legacy compatibility — existing users without cellphone', () => {
  it('allows empty phone on Google-style minimal bootstrap payload', () => {
    const applied = applyRegistrationCellphone({})
    expect(applied.ok).toBe(true)
    if (!applied.ok) return
    expect(applied.data.phoneNumber).toBeUndefined()
    expect(hasFullRegistrationPayload('sme', applied.data)).toBe(false)
    expect(hasFullRegistrationPayload('youth-agent', applied.data)).toBe(false)
  })

  it('does not treat missing phone as a login block for completed SME profiles', () => {
    const dest = resolvePostAuthDestination({
      userType: 'sme',
      onboardingCompleted: true,
      // no phoneNumber on profile
    } as any)
    expect(dest.blocked).toBeFalsy()
    expect(dest.path).toMatch(/sme\/dashboard/)
  })

  it('does not treat missing phone as a login block for completed Youth Agent profiles', () => {
    const dest = resolvePostAuthDestination({
      userType: 'youth-agent',
      onboardingCompleted: true,
    } as any)
    expect(dest.blocked).toBeFalsy()
    expect(dest.path).toMatch(/agent\/dashboard/)
  })

  it('does not introduce a migration requirement for incomplete onboarding without phone', () => {
    // Incomplete profiles still go to onboarding — same as today — not a separate phone migration.
    const dest = resolvePostAuthDestination({
      userType: 'sme',
      onboardingCompleted: false,
    } as any)
    expect(dest.path).toMatch(/sme\/onboarding/)
  })
})
