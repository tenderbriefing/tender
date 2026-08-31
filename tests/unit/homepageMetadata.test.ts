import { describe, expect, it } from 'vitest'
import { HOMEPAGE_SEO_DESCRIPTION, HOMEPAGE_SEO_TITLE } from '@/lib/seo/homepageMetadata'

describe('homepageMetadata', () => {
  it('exports the preferred homepage SEO title', () => {
    expect(HOMEPAGE_SEO_TITLE).toBe('Tender Briefing South Africa | Compulsory Tender Briefings')
  })

  it('exports the preferred homepage SEO description with R349', () => {
    expect(HOMEPAGE_SEO_DESCRIPTION).toBe(
      'TenderBriefing helps South African SMEs discover compulsory tender briefings from official eTenders data. Free to browse — book a Youth Agent to attend your briefing for R349.'
    )
    expect(HOMEPAGE_SEO_DESCRIPTION).not.toMatch(/\bR249\b/)
  })
})
