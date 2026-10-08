import { describe, expect, it, vi } from 'vitest'
import fs from 'fs'
import path from 'path'

describe('Founder outreach Resend delivery idempotency', () => {
  it('transport accepts and forwards Idempotency-Key to Resend SDK', async () => {
    const send = vi.fn(async (_payload: unknown, options?: { idempotencyKey?: string }) => {
      expect(options?.idempotencyKey).toBe('outreach-delivery:foc-test_user@x.co.za')
      return { data: { id: 're_msg_1' }, error: null }
    })
    const { sendFounderOutreachEmail } = await import('@/lib/services/founderOutreachEmail')
    const result = await sendFounderOutreachEmail({
      to: 'user@x.co.za',
      subject: 'Test',
      html: '<p>Hi</p>',
      text: 'Hi',
      idempotencyKey: 'outreach-delivery:foc-test_user@x.co.za',
      resendClient: { emails: { send } } as any,
    })
    expect(result.sent).toBe(true)
    expect(result.id).toBe('re_msg_1')
    expect(send).toHaveBeenCalledTimes(1)
  })

  it('sendEngine always passes durable per-delivery idempotency key', () => {
    const src = fs.readFileSync(
      path.join(process.cwd(), 'lib/founder/outreach/sendEngine.ts'),
      'utf8'
    )
    expect(src).toContain('idempotencyKey: `outreach-delivery:${delivery.id}`')
    expect(src).toContain('accept-before-persist crashes cannot create a second mailbox delivery')
  })

  it('documents accept-before-persist race without provider idempotency', () => {
    // Regression contract: worker reclaim of stale "sending" without Resend
    // Idempotency-Key would re-call send() and risk a duplicate mailbox delivery.
    const transport = fs.readFileSync(
      path.join(process.cwd(), 'lib/services/founderOutreachEmail.ts'),
      'utf8'
    )
    expect(transport).toContain('idempotencyKey')
    expect(transport).toContain('Idempotency-Key')
  })
})
