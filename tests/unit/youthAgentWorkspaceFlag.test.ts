import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import {
  canAccessYouthAgentWorkspace,
  isYouthAgentWorkspaceEnabled,
  isYouthAgentWorkspacePilotUser,
  parseYouthAgentWorkspacePilotUids,
  YOUTH_AGENT_WORKSPACE_FLAG_KEY,
} from '@/lib/agent/workspace/featureFlag'

describe('youth agent workspace feature flag (fail-closed)', () => {
  const env = process.env

  beforeEach(() => {
    delete process.env.YOUTH_AGENT_WORKSPACE_ENABLED
    delete process.env.YOUTH_AGENT_WORKSPACE_PILOT_UIDS
    delete process.env.NEXT_PUBLIC_YOUTH_AGENT_WORKSPACE_ENABLED
  })

  afterEach(() => {
    process.env = env
  })

  it('uses stable flag key', () => {
    expect(YOUTH_AGENT_WORKSPACE_FLAG_KEY).toBe('youth_agent_workspace_v1')
  })

  it('denies when flag off and allow-list empty', () => {
    expect(isYouthAgentWorkspaceEnabled()).toBe(false)
    expect(canAccessYouthAgentWorkspace({ uid: 'agent-1', userType: 'youth-agent' })).toBe(false)
  })

  it('parses pilot UIDs', () => {
    expect(parseYouthAgentWorkspacePilotUids(' a, b , ')).toEqual(['a', 'b'])
  })

  it('allows pilot UID while global disabled', () => {
    process.env.YOUTH_AGENT_WORKSPACE_PILOT_UIDS = 'pilot-uid'
    expect(isYouthAgentWorkspacePilotUser('pilot-uid')).toBe(true)
    expect(
      canAccessYouthAgentWorkspace({ uid: 'pilot-uid', userType: 'youth-agent' })
    ).toBe(true)
    expect(canAccessYouthAgentWorkspace({ uid: 'other', userType: 'youth-agent' })).toBe(false)
  })

  it('never grants SME via workspace flag', () => {
    process.env.YOUTH_AGENT_WORKSPACE_ENABLED = 'true'
    process.env.YOUTH_AGENT_WORKSPACE_PILOT_UIDS = 'sme-1'
    expect(canAccessYouthAgentWorkspace({ uid: 'sme-1', userType: 'sme' })).toBe(false)
  })

  it('allows youth-agent and admin when globally enabled', () => {
    process.env.YOUTH_AGENT_WORKSPACE_ENABLED = 'true'
    expect(
      canAccessYouthAgentWorkspace({ uid: 'a1', userType: 'youth-agent' })
    ).toBe(true)
    expect(canAccessYouthAgentWorkspace({ uid: 'admin1', userType: 'admin' })).toBe(true)
  })
})
