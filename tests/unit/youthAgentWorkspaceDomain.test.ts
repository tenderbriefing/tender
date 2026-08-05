import { describe, expect, it } from 'vitest'
import {
  canTransitionFieldReport,
  assertFieldReportTransition,
  isFieldReportEditable,
} from '@/lib/agent/workspace/fieldReportLifecycle'
import { explainPerformanceScore } from '@/lib/agent/workspace/explainablePerformance'
import {
  canEditFieldReportDraft,
  canReadEarningsLedger,
  canSendAssignmentMessage,
  canVerifyFieldReport,
} from '@/lib/agent/workspace/access'

describe('field report lifecycle', () => {
  it('allows draft autosave and submit by agent', () => {
    expect(canTransitionFieldReport('draft', 'draft', 'youth-agent').ok).toBe(true)
    expect(canTransitionFieldReport('draft', 'submitted', 'youth-agent').ok).toBe(true)
  })

  it('locks after submit; SME verifies locked', () => {
    expect(canTransitionFieldReport('submitted', 'locked', 'system').ok).toBe(true)
    expect(canTransitionFieldReport('locked', 'verified', 'sme').ok).toBe(true)
    expect(canTransitionFieldReport('locked', 'verified', 'youth-agent').ok).toBe(false)
  })

  it('rejects illegal transitions', () => {
    expect(() => assertFieldReportTransition('verified', 'draft', 'youth-agent')).toThrow()
  })

  it('editable only draft/rejected', () => {
    expect(isFieldReportEditable('draft')).toBe(true)
    expect(isFieldReportEditable('locked')).toBe(false)
  })
})

describe('explainable performance', () => {
  it('returns score, tier, and factors without inventing inputs', () => {
    const r = explainPerformanceScore({
      completionRate: 1,
      missedBriefings: 0,
      smeRating: 5,
      reportingQuality: 80,
      verified: true,
    })
    expect(r.score).toBeGreaterThanOrEqual(70)
    expect(r.factors.length).toBeGreaterThan(2)
    expect(r.factors.every((f) => typeof f.detail === 'string')).toBe(true)
  })
})

describe('workspace access helpers', () => {
  const agent = { uid: 'agent-a', userType: 'youth-agent' as const }
  const sme = { uid: 'sme-a', userType: 'sme' as const }
  const attendance = {
    smeId: 'sme-a',
    agentId: 'agent-a',
    assignedAgentId: 'agent-a',
  }

  it('scopes messaging and drafts to assignment parties', () => {
    expect(canSendAssignmentMessage(agent, attendance)).toBe(true)
    expect(canSendAssignmentMessage(sme, attendance)).toBe(true)
    expect(
      canSendAssignmentMessage(agent, { ...attendance, agentId: 'other', assignedAgentId: 'other' })
    ).toBe(false)
    expect(
      canEditFieldReportDraft(agent, { agentId: 'agent-a', status: 'draft' }, attendance)
    ).toBe(true)
    expect(
      canEditFieldReportDraft(agent, { agentId: 'agent-a', status: 'locked' }, attendance)
    ).toBe(false)
    expect(canVerifyFieldReport(sme, attendance)).toBe(true)
    expect(canVerifyFieldReport(agent, attendance)).toBe(false)
    expect(canReadEarningsLedger(agent, 'agent-a')).toBe(true)
    expect(canReadEarningsLedger(agent, 'agent-b')).toBe(false)
  })
})
