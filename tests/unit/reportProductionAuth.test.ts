/**
 * Phase 11 — report routes are admin-only (IDOR / SME blocked).
 */
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/auth/verifyApiUser', () => ({
  verifyApiUser: vi.fn(async (_auth: string | null, roles?: string[]) => {
    if (roles && roles.length === 1 && roles[0] === 'admin') return null
    return { uid: 'sme-1', email: 'sme@example.test', userType: 'sme' }
  }),
  unauthorizedResponse: (msg?: string) =>
    new Response(JSON.stringify({ success: false, error: msg || 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    }),
}))

describe('ops report IDOR / auth', () => {
  it('rejects SME on report GET', async () => {
    const { GET } = await import('@/app/api/admin/ops/[id]/report/route')
    const req = new Request('http://localhost/api/admin/ops/req-1/report', {
      headers: { authorization: 'Bearer sme-token' },
    })
    const res = await GET(req as any, { params: Promise.resolve({ id: 'req-1' }) })
    expect(res.status).toBe(401)
  })

  it('rejects SME on report POST generate', async () => {
    const { POST } = await import('@/app/api/admin/ops/[id]/report/route')
    const req = new Request('http://localhost/api/admin/ops/req-1/report', {
      method: 'POST',
      headers: {
        authorization: 'Bearer sme-token',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ action: 'generate' }),
    })
    const res = await POST(req as any, { params: Promise.resolve({ id: 'req-1' }) })
    expect(res.status).toBe(401)
  })

  it('rejects SME on report download', async () => {
    const { GET } = await import('@/app/api/admin/ops/[id]/report/download/route')
    const req = new Request('http://localhost/api/admin/ops/req-1/report/download?format=pdf', {
      headers: { authorization: 'Bearer sme-token' },
    })
    const res = await GET(req as any, { params: Promise.resolve({ id: 'req-1' }) })
    expect(res.status).toBe(401)
  })
})
