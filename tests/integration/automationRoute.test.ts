import { describe, expect, it } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from '../../app/api/automation/run/route'

describe('POST /api/automation/run contract', () => {
  it('returns 400 and the validated registry for an unknown job', async () => {
    const response = await POST(
      new NextRequest('http://localhost/api/automation/run', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ job: 'not-a-real-job' }),
      })
    )
    const body = await response.json()
    expect(response.status).toBe(400)
    expect(body.success).toBe(false)
    expect(body.validJobs).toContain('all')
    expect(body.validJobs).toContain('calendar_intelligence')
  })

  it('rejects a non-string continuation cursor', async () => {
    const response = await POST(
      new NextRequest('http://localhost/api/automation/run', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ job: 'all', continuation: { offset: 5 } }),
      })
    )
    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({
      success: false,
      error: 'continuation must be a string',
    })
  })
})
