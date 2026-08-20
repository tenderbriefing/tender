import { describe, it, expect } from 'vitest'

import {
  generateBriefingIntelligenceReportId,
  generateRandomBriefingIntelligenceReportId,
} from '../../../lib/briefing-intelligence/reportId'

describe('Briefing Intelligence reportId', () => {
  it('matches TB-BR-XXXXXX format', () => {
    const id = generateRandomBriefingIntelligenceReportId()
    expect(id).toMatch(/^TB-BR-[A-Z0-9]{6}$/)
  })

  it('IDs are unique across 1000 generations', () => {
    const ids = new Set<string>()
    for (let i = 0; i < 1000; i++) {
      ids.add(generateRandomBriefingIntelligenceReportId())
    }
    expect(ids.size).toBe(1000)
  })

  it('suffix is only uppercase alphanumeric', () => {
    // Deterministic path too (not part of the uniqueness guarantee).
    const deterministic = generateBriefingIntelligenceReportId({
      requestId: 'req-1',
      agentId: 'agent-1',
      salt: 'tender-1',
    })
    const suffix = deterministic.replace('TB-BR-', '')
    expect(suffix).toMatch(/^[A-Z0-9]{6}$/)
  })
})

