/**
 * Phase 12 — delivery routes admin-only (IDOR / SME blocked).
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

describe('ops client delivery IDOR / auth', () => {
  it('rejects SME on delivery GET', async () => {
    const { GET } = await import('@/app/api/admin/ops/[id]/delivery/route')
    const req = new Request('http://localhost/api/admin/ops/req-1/delivery', {
      headers: { authorization: 'Bearer sme-token' },
    })
    const res = await GET(req as any, { params: Promise.resolve({ id: 'req-1' }) })
    expect(res.status).toBe(401)
  })

  it('rejects SME on delivery confirm_send', async () => {
    const { POST } = await import('@/app/api/admin/ops/[id]/delivery/route')
    const req = new Request('http://localhost/api/admin/ops/req-1/delivery', {
      method: 'POST',
      headers: {
        authorization: 'Bearer sme-token',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        action: 'confirm_send',
        deliveryId: 'odel-1',
        confirm: true,
      }),
    })
    const res = await POST(req as any, { params: Promise.resolve({ id: 'req-1' }) })
    expect(res.status).toBe(401)
  })

  it('rejects unauthenticated report download still', async () => {
    const { GET } = await import('@/app/api/admin/ops/[id]/report/download/route')
    const req = new Request('http://localhost/api/admin/ops/req-1/report/download?format=pdf')
    const res = await GET(req as any, { params: Promise.resolve({ id: 'req-1' }) })
    expect(res.status).toBe(401)
  })
})
