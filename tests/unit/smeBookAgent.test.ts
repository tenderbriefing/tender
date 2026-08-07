import { describe, expect, it } from 'vitest'
import {
  requestAgentPath,
  SME_BOOK_AGENT_PATH,
  smeBookAgentSignInHref,
} from '@/lib/booking/sharePath'

describe('SME book-agent shareable path helpers', () => {
  it('exposes the canonical shareable path', () => {
    expect(SME_BOOK_AGENT_PATH).toBe('/sme/book-agent')
  })

  it('builds request-agent checkout path for a tender', () => {
    expect(requestAgentPath('abc-123')).toBe('/tenders/abc-123/request-agent')
    expect(requestAgentPath('tb-PRIVATE-1', { invite: 'inv' })).toBe(
      '/tenders/tb-PRIVATE-1/request-agent?invite=inv'
    )
  })

  it('preserves return URL for guests (picker or deep-link checkout)', () => {
    expect(smeBookAgentSignInHref()).toBe(
      `/auth/signin?redirect=${encodeURIComponent('/sme/book-agent')}`
    )
    expect(smeBookAgentSignInHref('tender-9')).toBe(
      `/auth/signin?redirect=${encodeURIComponent('/tenders/tender-9/request-agent')}`
    )
    expect(smeBookAgentSignInHref('tb-PRIVATE-1', { invite: 'tok' })).toBe(
      `/auth/signin?redirect=${encodeURIComponent('/tenders/tb-PRIVATE-1/request-agent?invite=tok')}`
    )
  })
})

describe('SME book-agent page auth and selection contracts', () => {
  it('redirects guests to sign-in with return URL; blocks non-SME checkout', async () => {
    const fs = await import('node:fs')
    const path = await import('node:path')
    const page = fs.readFileSync(
      path.join(process.cwd(), 'app/sme/book-agent/page.tsx'),
      'utf8'
    )

    expect(page).toContain('smeBookAgentSignInHref')
    expect(page).toContain("userProfile.userType !== 'sme'")
    expect(page).toContain('SME account required')
    expect(page).not.toMatch(/searchParams.*get\(['"]role['"]\)/)
    // Wrong role must not deep-link into PayFast checkout
    expect(page).toMatch(/wrongRole[\s\S]*Go to my dashboard/)
  })

  it('selection continues into existing request-agent PayFast journey', async () => {
    const fs = await import('node:fs')
    const path = await import('node:path')
    const page = fs.readFileSync(
      path.join(process.cwd(), 'app/sme/book-agent/page.tsx'),
      'utf8'
    )

    expect(page).toContain('requestAgentPath')
    expect(page).toContain("compulsoryOnly: true")
    expect(page).toContain("sortTenders(tenders, 'briefingDate', 'asc')")
    // Links/redirects must use the existing checkout route — no parallel pay system
    expect(page).not.toContain('/api/payments/yoco')
    expect(page).not.toContain('startPayFastFromApiPayload')
    expect(page).toContain('No upcoming compulsory briefings')
  })
})

describe('request-agent duplicate active request UX', () => {
  it('resumes PayFast or redirects to existing request instead of dead-end toast', async () => {
    const fs = await import('node:fs')
    const path = await import('node:path')
    const page = fs.readFileSync(
      path.join(process.cwd(), 'app/tenders/(detail)/[id]/request-agent/page.tsx'),
      'utf8'
    )

    expect(page).toContain("json.code === 'ACTIVE_REQUEST_EXISTS'")
    expect(page).toContain('json.data?.resumeUrl')
    expect(page).toContain('Continuing payment for your existing request')
    expect(page).toContain("json.data?.resumed")
  })
})
