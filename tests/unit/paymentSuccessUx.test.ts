import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

describe('payment-success UX — server paid is authority', () => {
  it('does not claim booking confirmed until paymentStatus=paid', () => {
    const page = fs.readFileSync(
      path.join(process.cwd(), 'app/sme/requests/payment-success/page.tsx'),
      'utf8'
    )

    expect(page).toContain("We're confirming your payment")
    expect(page).toContain("paymentStatus === 'paid'")
    expect(page).toContain('Booking confirmed')
    expect(page).toContain('Confirming payment')
    expect(page).not.toMatch(/You're booked/)
    expect(page).toContain('/api/payments/payfast/confirm')
    expect(page).toContain('does not rely on this page')
  })
})

describe('request-agent conversion CTA', () => {
  it('surfaces Request an Agent — R349 and no pre-pay attendance promise', async () => {
    const { BOOK_AGENT_PAY_CTA, BOOK_AGENT_CTA } = await import('@/lib/booking/labels')
    expect(BOOK_AGENT_CTA).toBe('Request an Agent')
    expect(BOOK_AGENT_PAY_CTA).toMatch(/Request an Agent/)
    expect(BOOK_AGENT_PAY_CTA).toMatch(/R349/)

    const page = fs.readFileSync(
      path.join(process.cwd(), 'app/tenders/(detail)/[id]/request-agent/page.tsx'),
      'utf8'
    )
    expect(page).toContain('compulsory tender briefing')
    expect(page).toContain('assigned only after they accept')
  })
})
