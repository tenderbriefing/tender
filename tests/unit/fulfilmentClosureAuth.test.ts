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

describe('Phase 13 fulfilment IDOR', () => {
  it('rejects SME on complete', async () => {
    const { POST } = await import('@/app/api/admin/ops/[id]/route')
    const req = new Request('http://localhost/api/admin/ops/req-1', {
      method: 'POST',
      headers: {
        authorization: 'Bearer sme',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ action: 'complete' }),
    })
    const res = await POST(req as any, { params: Promise.resolve({ id: 'req-1' }) })
    expect(res.status).toBe(401)
  })

  it('rejects SME on reopen', async () => {
    const { POST } = await import('@/app/api/admin/ops/[id]/route')
    const req = new Request('http://localhost/api/admin/ops/req-1', {
      method: 'POST',
      headers: {
        authorization: 'Bearer sme',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        action: 'reopen',
        confirm: true,
        reason: 'Need correction for site notes',
      }),
    })
    const res = await POST(req as any, { params: Promise.resolve({ id: 'req-1' }) })
    expect(res.status).toBe(401)
  })

  it('rejects SME on ops board exceptions', async () => {
    const { GET } = await import('@/app/api/admin/ops/board/route')
    const req = new Request('http://localhost/api/admin/ops/board?filter=needs_attention', {
      headers: { authorization: 'Bearer sme' },
    })
    const res = await GET(req as any)
    expect(res.status).toBe(401)
  })
})
