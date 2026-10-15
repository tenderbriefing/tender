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
  it('surfaces Book an agent — R750 and no pre-pay attendance promise', async () => {
    const { BOOK_AGENT_PAY_CTA, BOOK_AGENT_CTA } = await import('@/lib/booking/labels')
    expect(BOOK_AGENT_CTA).toBe('Book an agent')
    expect(BOOK_AGENT_PAY_CTA).toMatch(/Continue to pay/)
    expect(BOOK_AGENT_PAY_CTA).toMatch(/R750/)

    const page = fs.readFileSync(
      path.join(process.cwd(), 'app/tenders/(detail)/[id]/request-agent/page.tsx'),
      'utf8'
    )
    expect(page).toContain('Book a Youth Agent for')
    expect(page).toContain('assigned only after they accept')
  })
})
