import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

describe('GET /api/agent/workspace/assignments auth contract', () => {
  const routePath = path.resolve(
    __dirname,
    '../../app/api/agent/workspace/assignments/route.ts'
  )

  it('uses detailed verify and maps failures via responseFromVerifyFailure', () => {
    const src = fs.readFileSync(routePath, 'utf8')
    expect(src).toContain('verifyApiUserDetailed')
    expect(src).toContain('responseFromVerifyFailure')
    expect(src).toContain("'youth-agent'")
    expect(src).toContain("'admin'")
    // Must not trust query agentId for non-admin (agentId only when admin).
    expect(src).toContain("user.userType === 'admin'")
  })
})
