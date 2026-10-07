import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

describe('R349 purchase auth return-path contracts', () => {
  it('payment-success preserves requestId through sign-in', () => {
    const page = fs.readFileSync(
      path.join(process.cwd(), 'app/sme/requests/payment-success/page.tsx'),
      'utf8'
    )
    expect(page).toContain('signInWithReturnHref')
    expect(page).toContain('payment-success?requestId=')
    expect(page).not.toMatch(/router\.push\('\/auth\/signin'\)/)
  })

  it('signin hands incomplete profiles to role-selection with redirect', () => {
    const page = fs.readFileSync(
      path.join(process.cwd(), 'app/auth/signin/page.tsx'),
      'utf8'
    )
    expect(page).toContain('withReturnRedirect')
    expect(page).toContain("'/auth/role-selection?recover=1'")
    expect(page).toContain('isSafeReturnPath')
  })

  it('role-selection returns SMEs to purchase path when safe', () => {
    const page = fs.readFileSync(
      path.join(process.cwd(), 'app/auth/role-selection/page.tsx'),
      'utf8'
    )
    expect(page).toContain('isSafeReturnPath(returnTo)')
    expect(page).toContain("role === 'sme'")
  })

  it('tender detail guest CTA encodes request-agent return path', () => {
    const panel = fs.readFileSync(
      path.join(process.cwd(), 'components/procurement/TenderActionPanel.tsx'),
      'utf8'
    )
    expect(panel).toContain('encodeURIComponent')
    expect(panel).toContain('/request-agent')
  })
})
