import { describe, expect, it } from 'vitest'
import {
  canAgentActOnAttendance,
  canMutateAttendanceAsOwner,
  canReadAttendance,
  canReadBriefing,
} from '../../lib/security/accessControl'

describe('accessControl', () => {
  const smeA = { uid: 'sme-a', userType: 'sme' as const }
  const smeB = { uid: 'sme-b', userType: 'sme' as const }
  const agentA = { uid: 'agent-a', userType: 'youth-agent' as const }
  const agentB = { uid: 'agent-b', userType: 'youth-agent' as const }
  const admin = { uid: 'admin-1', userType: 'admin' as const }

  const request = {
    smeId: 'sme-a',
    agentId: 'agent-a',
    notifiedAgents: ['agent-a'],
  }

  it('allows owner SME and denies other SME', () => {
    expect(canReadAttendance(smeA, request)).toBe(true)
    expect(canReadAttendance(smeB, request)).toBe(false)
    expect(canMutateAttendanceAsOwner(smeB, request)).toBe(false)
  })

  it('allows assigned/notified agent and denies other agent', () => {
    expect(canAgentActOnAttendance(agentA, request)).toBe(true)
    expect(canAgentActOnAttendance(agentB, request)).toBe(false)
  })

  it('allows admin everywhere', () => {
    expect(canReadAttendance(admin, request)).toBe(true)
    expect(canReadBriefing(admin, { smeId: 'sme-a', agentId: 'agent-a' })).toBe(true)
  })

  it('enforces briefing ownership', () => {
    const report = { smeId: 'sme-a', agentId: 'agent-a' }
    expect(canReadBriefing(smeA, report)).toBe(true)
    expect(canReadBriefing(smeB, report)).toBe(false)
    expect(canReadBriefing(agentB, report)).toBe(false)
  })
})
