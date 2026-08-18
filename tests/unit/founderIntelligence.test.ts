import { describe, expect, it } from 'vitest'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const svc = require('../../backend/services/founderIntelligenceService')

describe('founder intelligence classify', () => {
  it('marks recent incomplete profiles as onboarding', () => {
    expect(
      svc.classify({
        registeredAt: new Date().toISOString(),
        lastMeaningfulAt: null,
        onboardingCompleted: false,
        meaningfulEventCount: 0,
        sessionCount: 0,
      })
    ).toBe('onboarding')
  })

  it('marks 7-day-old completed profiles as new', () => {
    const d = new Date()
    d.setDate(d.getDate() - 3)
    expect(
      svc.classify({
        registeredAt: d.toISOString(),
        lastMeaningfulAt: d.toISOString(),
        onboardingCompleted: true,
        meaningfulEventCount: 1,
        sessionCount: 1,
      })
    ).toBe('new')
  })
})
