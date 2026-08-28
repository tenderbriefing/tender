import { describe, expect, it, vi, beforeEach } from 'vitest'
import * as XLSX from 'xlsx'
import {
  isFounderSmeOutreachEnabled,
  OUTREACH_MAX_RECIPIENTS,
  OUTREACH_SUBJECT,
  OUTREACH_CTA_LABEL,
  OUTREACH_CTA_PATH,
  OUTREACH_TEMPLATE_VERSION,
} from '@/lib/founder/outreach/featureFlag'
import {
  parseOutreachXlsx,
  isValidOutreachEmail,
  normaliseOutreachEmail,
} from '@/lib/founder/outreach/parseSpreadsheet'
import { renderSmeInvitationV1 } from '@/lib/founder/outreach/emailTemplate'
import {
  buildUnsubscribeToken,
  verifyUnsubscribeToken,
} from '@/lib/founder/outreach/unsubscribeToken'
import { isRetryableOutreachError, sendFounderOutreachEmail } from '@/lib/services/founderOutreachEmail'
import { readFileSync } from 'fs'
import { join } from 'path'

function workbookBuffer(rows: (string | number)[][]): Buffer {
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet(rows)
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
  return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }))
}

describe('FOUNDER_SME_OUTREACH feature flag (fail-closed)', () => {
  it('absent / false / garbage = disabled; only explicit true enables', () => {
    expect(isFounderSmeOutreachEnabled(undefined)).toBe(false)
    expect(isFounderSmeOutreachEnabled(null)).toBe(false)
    expect(isFounderSmeOutreachEnabled('')).toBe(false)
    expect(isFounderSmeOutreachEnabled('false')).toBe(false)
    expect(isFounderSmeOutreachEnabled('0')).toBe(false)
    expect(isFounderSmeOutreachEnabled('no')).toBe(false)
    expect(isFounderSmeOutreachEnabled('maybe')).toBe(false)
    expect(isFounderSmeOutreachEnabled('true')).toBe(true)
    expect(isFounderSmeOutreachEnabled('TRUE')).toBe(true)
    expect(isFounderSmeOutreachEnabled('1')).toBe(true)
    expect(isFounderSmeOutreachEnabled('yes')).toBe(true)
    expect(isFounderSmeOutreachEnabled('on')).toBe(true)
  })
})

describe('outreach spreadsheet parse', () => {
  it('accepts valid .xlsx with Name / Company Name / Email', () => {
    const buf = workbookBuffer([
      ['Name', 'Company Name', 'Email'],
      ['Ada Lovelace', 'Analytical Engines', 'ada@example.com'],
      ['  Bob Smith  ', 'Acme Pty', '  BOB@Example.COM '],
    ])
    const result = parseOutreachXlsx(buf, { fileName: 'smes.xlsx' })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.validRows).toBe(2)
    expect(result.sendableCandidates).toBe(2)
    expect(result.rows[0].name).toBe('Ada Lovelace')
    expect(result.rows[1].normalisedEmail).toBe('bob@example.com')
    expect(result.rows[1].companyName).toBe('Acme Pty')
  })

  it('rejects wrong extension', () => {
    const buf = workbookBuffer([['Name', 'Company Name', 'Email'], ['A', 'B', 'a@b.com']])
    const result = parseOutreachXlsx(buf, { fileName: 'smes.csv' })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.code).toBe('invalid_extension')
  })

  it('rejects missing headers', () => {
    expect(parseOutreachXlsx(workbookBuffer([['Name', 'Email'], ['A', 'a@b.com']]), { fileName: 'a.xlsx' }).ok).toBe(
      false
    )
    expect(
      parseOutreachXlsx(workbookBuffer([['Name', 'Company Name'], ['A', 'Co']]), { fileName: 'a.xlsx' }).ok
    ).toBe(false)
  })

  it('rejects blank workbook / zero valid recipients', () => {
    expect(parseOutreachXlsx(workbookBuffer([['Name', 'Company Name', 'Email']]), { fileName: 'a.xlsx' }).ok).toBe(
      false
    )
  })

  it('ignores blank rows and flags invalid / duplicate', () => {
    const buf = workbookBuffer([
      ['Name', 'Company Name', 'Email'],
      ['', '', ''],
      ['Ada', 'Co', 'ada@example.com'],
      ['', 'Co', 'x@example.com'],
      ['Bob', 'Co', 'not-an-email'],
      ['Dup', 'Co', 'ADA@example.com'],
    ])
    const result = parseOutreachXlsx(buf, { fileName: 'a.xlsx' })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.validRows).toBe(1)
    expect(result.invalidRows).toBe(2)
    expect(result.duplicateRows).toBe(1)
  })

  it('rejects over-limit sendable recipients without truncating', () => {
    const rows: string[][] = [['Name', 'Company Name', 'Email']]
    for (let i = 0; i < OUTREACH_MAX_RECIPIENTS + 1; i++) {
      rows.push([`N${i}`, `C${i}`, `user${i}@example.com`])
    }
    const result = parseOutreachXlsx(workbookBuffer(rows), { fileName: 'big.xlsx' })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.code).toBe('over_recipient_limit')
  })

  it('validates emails', () => {
    expect(isValidOutreachEmail('a@b.com')).toBe(true)
    expect(isValidOutreachEmail('bad')).toBe(false)
    expect(normaliseOutreachEmail('  A@B.COM ')).toBe('a@b.com')
  })
})

describe('sme-invitation-v1 template', () => {
  it('uses approved subject, CTA, and first-name merge', () => {
    const rendered = renderSmeInvitationV1(
      {
        name: 'Thabo Molefe',
        companyName: 'Molefe Logistics',
        email: 'thabo@example.com',
        unsubscribeUrl: 'https://www.tenderbriefing.co.za/api/outreach/unsubscribe?token=test',
      },
      { ...process.env, NEXT_PUBLIC_SITE_URL: 'https://www.tenderbriefing.co.za' }
    )
    expect(rendered.templateVersion).toBe(OUTREACH_TEMPLATE_VERSION)
    expect(rendered.subject).toBe(OUTREACH_SUBJECT)
    expect(rendered.ctaLabel).toBe(OUTREACH_CTA_LABEL)
    expect(rendered.ctaUrl).toBe(`https://www.tenderbriefing.co.za${OUTREACH_CTA_PATH}`)
    expect(rendered.html).toContain('VIEW TENDER BRIEFINGS')
    expect(rendered.html).toContain('/tenders')
    expect(rendered.html).toContain('Hi Thabo')
    expect(rendered.html).toContain('Unsubscribe')
    expect(rendered.html).not.toContain('<script')
    expect(rendered.text).toContain('VIEW TENDER BRIEFINGS')
    expect(rendered.text).toContain('Unsubscribe from outreach emails')
    // XSS escape
    const xss = renderSmeInvitationV1({
      name: '<img src=x onerror=alert(1)>',
      email: 'x@example.com',
      unsubscribeUrl: 'https://example.com/u',
    })
    expect(xss.html).not.toContain('<img src=x')
    expect(xss.html).toContain('&lt;img')
  })
})

describe('unsubscribe tokens', () => {
  const env = { ...process.env, FOUNDER_OUTREACH_UNSUB_SECRET: 'test-outreach-unsub-secret-v1' }

  it('signs and verifies; rejects tampering', () => {
    const token = buildUnsubscribeToken('Person@Example.com', env)
    expect(token).toBeTruthy()
    const ok = verifyUnsubscribeToken(token!, env)
    expect(ok).toEqual({ ok: true, email: 'person@example.com' })
    expect(verifyUnsubscribeToken(token!.slice(0, -2) + 'aa', env).ok).toBe(false)
    expect(verifyUnsubscribeToken('garbage', env).ok).toBe(false)
  })
})

describe('founder outreach Resend transport isolation', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('classifies retryable errors', () => {
    expect(isRetryableOutreachError('provider_rate_limit')).toBe(true)
    expect(isRetryableOutreachError('provider_server_error')).toBe(true)
    expect(isRetryableOutreachError('invalid_recipient')).toBe(false)
    expect(isRetryableOutreachError('provider_rejected')).toBe(false)
  })

  it('sends via Resend with FOUNDER_OUTREACH channel header', async () => {
    const send = vi.fn().mockResolvedValue({ data: { id: 're_test_1' }, error: null })
    const result = await sendFounderOutreachEmail({
      to: 'sme@example.com',
      subject: OUTREACH_SUBJECT,
      html: '<p>hi</p>',
      text: 'hi',
      env: { ...process.env, RESEND_API_KEY: 're_test_key', RESEND_FROM_EMAIL: 'hello@tenderbriefing.co.za' },
      resendClient: { emails: { send } } as any,
    })
    expect(result.sent).toBe(true)
    expect(result.id).toBe('re_test_1')
    expect(send).toHaveBeenCalledOnce()
    const arg = send.mock.calls[0][0]
    expect(arg.headers['X-TenderBriefing-Channel']).toBe('FOUNDER_OUTREACH')
    expect(arg.from).toContain('hello@tenderbriefing.co.za')
  })

  it('does not consult suppression inside outreach transport (caller responsibility)', async () => {
    const src = readFileSync(join(process.cwd(), 'lib/services/founderOutreachEmail.ts'), 'utf8')
    expect(src).not.toMatch(/from ['"]@\/lib\/founder\/outreach\/suppression['"]/)
    expect(src).not.toMatch(/emailSuppressions/)
    expect(src).not.toMatch(/isEmailSuppressed|listSuppressedAmong|upsertEmailSuppression/)
    const tx = readFileSync(join(process.cwd(), 'lib/services/transactionalEmailService.js'), 'utf8')
    expect(tx).not.toMatch(/emailSuppressions|FOUNDER_OUTREACH|founderOutreach/)
  })
})

describe('Founder outreach API auth + flag contracts', () => {
  const founderRoutes = [
    'app/api/founder/outreach/validate/route.ts',
    'app/api/founder/outreach/campaigns/route.ts',
    'app/api/founder/outreach/campaigns/[campaignId]/route.ts',
    'app/api/founder/outreach/campaigns/[campaignId]/send/route.ts',
  ]

  it('Founder outreach routes require verifyFounderUser and fail-closed flag', () => {
    for (const file of founderRoutes) {
      const src = readFileSync(join(process.cwd(), file), 'utf8')
      expect(src).toMatch(/verifyFounderUser/)
      expect(src).toMatch(/isFounderSmeOutreachEnabled/)
    }
  })

  it('unsubscribe is public and does not use verifyFounderUser', () => {
    const src = readFileSync(join(process.cwd(), 'app/api/outreach/unsubscribe/route.ts'), 'utf8')
    expect(src).not.toMatch(/verifyFounderUser/)
    expect(src).toMatch(/verifyUnsubscribeToken/)
  })

  it('worker requires automation auth', () => {
    const src = readFileSync(join(process.cwd(), 'app/api/founder/outreach/worker/route.ts'), 'utf8')
    expect(src).toMatch(/isAutomationAuthorized/)
    expect(src).toMatch(/isFounderSmeOutreachEnabled/)
  })

  it('Firestore rules deny client access to outreach collections', () => {
    const rules = readFileSync(join(process.cwd(), 'firestore.rules'), 'utf8')
    expect(rules).toMatch(/match \/founderOutreachCampaigns\/\{campaignId\}/)
    expect(rules).toMatch(/match \/emailSuppressions\/\{emailId\}/)
    expect(rules).toMatch(/allow read, write: if false/)
  })
})
