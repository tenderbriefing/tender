/**
 * Ops evidence routes are admin-only — SME tokens must not authorize.
 */
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/auth/verifyApiUser', () => ({
  verifyApiUser: vi.fn(async (_auth: string | null, roles?: string[]) => {
    // Simulate SME token presented to an admin-only route
    if (roles && roles.length === 1 && roles[0] === 'admin') return null
    return { uid: 'sme-1', email: 'sme@example.test', userType: 'sme' }
  }),
  unauthorizedResponse: (msg?: string) =>
    new Response(JSON.stringify({ success: false, error: msg || 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    }),
}))

describe('ops evidence IDOR / auth', () => {
  it('rejects SME on admin evidence GET', async () => {
    const { GET } = await import('@/app/api/admin/ops/[id]/evidence/route')
    const req = new Request('http://localhost/api/admin/ops/req-1/evidence', {
      headers: { authorization: 'Bearer sme-token' },
    })
    const res = await GET(req as any, { params: Promise.resolve({ id: 'req-1' }) })
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.success).toBe(false)
  })

  it('rejects SME on admin ops board', async () => {
    const { GET } = await import('@/app/api/admin/ops/board/route')
    const req = new Request('http://localhost/api/admin/ops/board', {
      headers: { authorization: 'Bearer sme-token' },
    })
    const res = await GET(req as any)
    expect(res.status).toBe(401)
  })
})
