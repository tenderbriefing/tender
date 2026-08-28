import { describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx'
import {
  YOUTH_AGENT_OUTREACH_CTA_LABEL,
  YOUTH_AGENT_OUTREACH_CTA_PATH,
  YOUTH_AGENT_OUTREACH_SUBJECT,
  YOUTH_AGENT_OUTREACH_TEMPLATE_VERSION,
  OUTREACH_SUBJECT,
  OUTREACH_CTA_LABEL,
  OUTREACH_TEMPLATE_VERSION,
} from '@/lib/founder/outreach/featureFlag'
import {
  parseOutreachCampaignType,
  isOutreachCampaignType,
  templateVersionForCampaignType,
} from '@/lib/founder/outreach/campaignTypes'
import { parseOutreachXlsx } from '@/lib/founder/outreach/parseSpreadsheet'
import { renderYouthAgentInvitationV1 } from '@/lib/founder/outreach/youthAgentEmailTemplate'
import { renderSmeInvitationV1 } from '@/lib/founder/outreach/emailTemplate'
import { renderOutreachEmail, listIdForCampaignType } from '@/lib/founder/outreach/templateRegistry'
import { readFileSync } from 'fs'
import { join } from 'path'

function workbookBuffer(rows: (string | number)[][]): Buffer {
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet(rows)
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
  return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }))
}

const env = { ...process.env, NEXT_PUBLIC_SITE_URL: 'https://www.tenderbriefing.co.za' }

describe('campaign type model', () => {
  it('maps SME campaign to sme-invitation-v1', () => {
    expect(templateVersionForCampaignType('sme_invitation')).toBe(OUTREACH_TEMPLATE_VERSION)
    expect(renderOutreachEmail('sme_invitation', { name: 'Ada' }, env).templateVersion).toBe(
      'sme-invitation-v1'
    )
  })

  it('maps Youth Agent campaign to youth-agent-invitation-v1', () => {
    expect(templateVersionForCampaignType('youth_agent_invitation')).toBe(
      YOUTH_AGENT_OUTREACH_TEMPLATE_VERSION
    )
    expect(
      renderOutreachEmail('youth_agent_invitation', { name: 'Calvin' }, env).templateVersion
    ).toBe('youth-agent-invitation-v1')
  })

  it('parses and validates supported campaign types; rejects unknown', () => {
    expect(parseOutreachCampaignType('sme_invitation')).toBe('sme_invitation')
    expect(parseOutreachCampaignType('youth_agent_invitation')).toBe('youth_agent_invitation')
    expect(parseOutreachCampaignType('youth-agent')).toBe('youth_agent_invitation')
    expect(parseOutreachCampaignType('newsletter')).toBe(null)
    expect(isOutreachCampaignType('youth_agent_invitation')).toBe(true)
    expect(isOutreachCampaignType('invalid')).toBe(false)
  })

  it('uses distinct List-ID headers per audience', () => {
    expect(listIdForCampaignType('sme_invitation')).toContain('sme-invitation')
    expect(listIdForCampaignType('youth_agent_invitation')).toContain('youth-agent-invitation')
  })
})

describe('youth agent spreadsheet parse', () => {
  it('accepts Name + Email only for youth_agent_invitation', () => {
    const buf = workbookBuffer([
      ['Name', 'Email'],
      ['Calvin Makhubela', 'calvin@example.com'],
      ['Thabo', 'thabo@example.com'],
    ])
    const result = parseOutreachXlsx(buf, {
      fileName: 'agents.xlsx',
      campaignType: 'youth_agent_invitation',
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.validRows).toBe(2)
    expect(result.rows[0].companyName).toBe('')
  })

  it('still requires Name and Email for youth agent rows', () => {
    const buf = workbookBuffer([
      ['Name', 'Email'],
      ['', 'bad@example.com'],
      ['NoEmail', ''],
    ])
    const result = parseOutreachXlsx(buf, {
      fileName: 'agents.xlsx',
      campaignType: 'youth_agent_invitation',
    })
    expect(result.ok).toBe(false)
  })

  it('SME parse still requires Company Name', () => {
    const buf = workbookBuffer([
      ['Name', 'Email'],
      ['Ada', 'ada@example.com'],
    ])
    const result = parseOutreachXlsx(buf, { fileName: 'smes.xlsx', campaignType: 'sme_invitation' })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.code).toBe('missing_header_company')
  })
})

describe('youth-agent-invitation-v1 template', () => {
  const unsubscribeUrl = 'https://www.tenderbriefing.co.za/api/outreach/unsubscribe?token=test'

  it('uses exact approved subject', () => {
    expect(YOUTH_AGENT_OUTREACH_SUBJECT).toBe('Invitation to become Youth Agents')
    const rendered = renderYouthAgentInvitationV1(
      { name: 'Calvin Makhubela', email: 'calvin@example.com', unsubscribeUrl },
      env
    )
    expect(rendered.subject).toBe('Invitation to become Youth Agents')
    expect(rendered.html).not.toContain('Earn R200 attending tender briefings near you')
  })

  it('personalises greeting from first name only', () => {
    const rendered = renderYouthAgentInvitationV1(
      { name: 'Calvin Makhubela', email: 'calvin@example.com', unsubscribeUrl },
      env
    )
    expect(rendered.html).toContain('Hi Calvin')
    expect(rendered.text).toContain('Hi Calvin,')
  })

  it('contains approved copy blocks and tagline', () => {
    const rendered = renderYouthAgentInvitationV1(
      { name: 'Calvin', email: 'calvin@example.com', unsubscribeUrl },
      env
    )
    expect(rendered.html).toContain('Want to earn R200 for attending a tender briefing?')
    expect(rendered.text).toContain('Want to earn R200 for attending a tender briefing?')
    expect(rendered.html).toContain('Once the briefing is completed, you earn R200')
    expect(rendered.html).toContain('Earn R200 per completed briefing')
    expect(rendered.html).toContain('You don’t need to write tenders.')
    expect(rendered.html).toContain('You don’t need to sell anything.')
    expect(rendered.html).toContain('Show up. Learn. Earn R200.')
    expect(rendered.text).toContain('Show up. Learn. Earn R200.')
  })

  it('uses exact CTA pointing to canonical Youth Agent registration route', () => {
    expect(YOUTH_AGENT_OUTREACH_CTA_PATH).toBe('/auth/signup?type=youth-agent')
    expect(YOUTH_AGENT_OUTREACH_CTA_LABEL).toBe('JOIN AS A YOUTH AGENT')
    const rendered = renderYouthAgentInvitationV1(
      { name: 'Calvin', email: 'calvin@example.com', unsubscribeUrl },
      env
    )
    expect(rendered.ctaLabel).toBe('JOIN AS A YOUTH AGENT')
    expect(rendered.ctaUrl).toBe('https://www.tenderbriefing.co.za/auth/signup?type=youth-agent')
    expect(rendered.html).toContain('JOIN AS A YOUTH AGENT')
    expect(rendered.html).toContain('/auth/signup?type=youth-agent')
    expect(rendered.html).not.toContain('VIEW TENDER BRIEFINGS')
    expect(rendered.html).not.toContain('/tenders')
  })

  it('uses EmailShell, logo, plain text, and unsubscribe', () => {
    const rendered = renderYouthAgentInvitationV1(
      { name: 'Calvin', email: 'calvin@example.com', unsubscribeUrl },
      env
    )
    expect(rendered.html).toMatch(/logo|tenderbriefing/i)
    expect(rendered.html).toContain('Unsubscribe from outreach emails')
    expect(rendered.text).toContain('Unsubscribe from outreach emails')
    expect(rendered.html).not.toContain('<script')
  })

  it('escapes XSS in Name', () => {
    const xss = renderYouthAgentInvitationV1({
      name: '<img src=x onerror=alert(1)>',
      email: 'x@example.com',
      unsubscribeUrl,
    })
    expect(xss.html).not.toContain('<img src=x')
    expect(xss.html).toContain('&lt;img')
  })
})

describe('SME outreach regression', () => {
  it('SME template, subject, and CTA unchanged', () => {
    expect(OUTREACH_SUBJECT).toBe('Compulsory briefings, without the travel')
    expect(OUTREACH_CTA_LABEL).toBe('VIEW TENDER BRIEFINGS')
    expect(OUTREACH_TEMPLATE_VERSION).toBe('sme-invitation-v1')
    const rendered = renderSmeInvitationV1(
      {
        name: 'Thabo',
        companyName: 'Co',
        email: 't@example.com',
        unsubscribeUrl: 'https://example.com/u',
      },
      env
    )
    expect(rendered.subject).toBe(OUTREACH_SUBJECT)
    expect(rendered.ctaLabel).toBe('VIEW TENDER BRIEFINGS')
    expect(rendered.ctaUrl).toBe('https://www.tenderbriefing.co.za/tenders')
    expect(rendered.html).not.toContain('JOIN AS A YOUTH AGENT')
    expect(rendered.html).not.toContain('Earn R200 attending tender briefings near you')
  })

  it('validate route requires server-side campaignType', () => {
    const src = readFileSync(
      join(process.cwd(), 'app/api/founder/outreach/validate/route.ts'),
      'utf8'
    )
    expect(src).toMatch(/parseOutreachCampaignType/)
    expect(src).toMatch(/invalid_campaign_type/)
    expect(src).toMatch(/renderOutreachEmail/)
    expect(src).not.toMatch(/renderSmeInvitationV1/)
  })

  it('send engine selects template from persisted campaign type', () => {
    const src = readFileSync(join(process.cwd(), 'lib/founder/outreach/sendEngine.ts'), 'utf8')
    expect(src).toMatch(/renderOutreachEmail/)
    expect(src).toMatch(/resolveCampaignType/)
    expect(src).not.toMatch(/renderSmeInvitationV1/)
  })

  it('campaign history includes type field', () => {
    const src = readFileSync(
      join(process.cwd(), 'app/api/founder/outreach/campaigns/route.ts'),
      'utf8'
    )
    expect(src).toMatch(/type: c\.type/)
  })
})

describe('Founder outreach auth + infrastructure (youth agent)', () => {
  const founderRoutes = [
    'app/api/founder/outreach/validate/route.ts',
    'app/api/founder/outreach/campaigns/route.ts',
    'app/api/founder/outreach/campaigns/[campaignId]/route.ts',
    'app/api/founder/outreach/campaigns/[campaignId]/send/route.ts',
  ]

  it('routes still require verifyFounderUser and fail-closed flag', () => {
    for (const file of founderRoutes) {
      const src = readFileSync(join(process.cwd(), file), 'utf8')
      expect(src).toMatch(/verifyFounderUser/)
      expect(src).toMatch(/isFounderSmeOutreachEnabled/)
    }
  })

  it('transactional email service remains isolated from outreach', () => {
    const tx = readFileSync(join(process.cwd(), 'lib/services/transactionalEmailService.js'), 'utf8')
    expect(tx).not.toMatch(/youth-agent-invitation|youth_agent_invitation/)
    expect(tx).not.toMatch(/emailSuppressions|FOUNDER_OUTREACH/)
  })

  it('idempotency delivery key pattern preserved in campaignStore', () => {
    const src = readFileSync(join(process.cwd(), 'lib/founder/outreach/campaignStore.ts'), 'utf8')
    expect(src).toMatch(/deliveryIdFor/)
    expect(src).toMatch(/campaignType/)
  })
})

describe('Founder outreach UI audience selector', () => {
  it('exposes SME and Youth Agent choices with distinct send labels', () => {
    const src = readFileSync(join(process.cwd(), 'app/founder/outreach/page.tsx'), 'utf8')
    expect(src).toContain('SME Invitation')
    expect(src).toContain('Youth Agent Invitation')
    expect(src).toContain('SEND YOUTH AGENT INVITATIONS')
    expect(src).toContain('campaignType')
    expect(src).toContain('I confirm I want to send the Youth Agent invitation')
  })
})
