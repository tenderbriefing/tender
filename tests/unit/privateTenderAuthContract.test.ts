import { readFileSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'

describe('private tender Founder API auth contracts', () => {
  it('Founder list/detail/review routes require verifyFounderUser', () => {
    const files = [
      'app/api/founder/private-tenders/route.ts',
      'app/api/founder/private-tenders/[id]/route.ts',
      'app/api/founder/private-tenders/[id]/review/route.ts',
      'app/api/founder/private-tenders/[id]/document/route.ts',
    ]
    for (const file of files) {
      const src = readFileSync(join(process.cwd(), file), 'utf8')
      expect(src).toMatch(/verifyFounderUser/)
    }
  })

  it('public submit route does not require Founder auth', () => {
    const src = readFileSync(
      join(process.cwd(), 'app/api/private-tenders/submit/route.ts'),
      'utf8'
    )
    expect(src).not.toMatch(/verifyFounderUser/)
    expect(src).toMatch(/checkRateLimit/)
    expect(src).toMatch(/validatePrivateTenderSubmission/)
  })
})
