import { describe, expect, it } from 'vitest'
import fs from 'fs'
import path from 'path'
import {
  parseRecipientFields,
  splitRecipientTokens,
  isValidEmailSyntax,
} from '@/lib/founder/outreach/parseRecipients'
import { sanitizeComposerHtml, htmlToPlainText } from '@/lib/founder/outreach/sanitizeComposerHtml'
import { getComposerTemplate } from '@/lib/founder/outreach/composerTemplates'
import { listAuthorizedOutreachSenders } from '@/lib/founder/outreach/authorizedSenders'
import { parseOutreachCampaignType } from '@/lib/founder/outreach/campaignTypes'
import { OUTREACH_MAX_RECIPIENTS } from '@/lib/founder/outreach/featureFlag'

describe('Founder Outreach Composer V2', () => {
  it('parses a single pasted email', () => {
    const r = parseRecipientFields({ to: 'person@company.co.za' })
    expect(r.totalSendable).toBe(1)
    expect(r.sendable[0].normalisedEmail).toBe('person@company.co.za')
    expect(r.toCount).toBe(1)
  })

  it('parses newline-separated emails', () => {
    const r = parseRecipientFields({
      to: 'a@x.co.za\nb@x.co.za\nc@gmail.com',
    })
    expect(r.totalSendable).toBe(3)
    expect(r.sendable.map((x) => x.normalisedEmail)).toEqual([
      'a@x.co.za',
      'b@x.co.za',
      'c@gmail.com',
    ])
  })

  it('parses comma-separated emails', () => {
    expect(splitRecipientTokens('a@x.co.za, b@x.co.za').length).toBe(2)
    const r = parseRecipientFields({ to: 'a@x.co.za, b@x.co.za' })
    expect(r.totalSendable).toBe(2)
  })

  it('parses semicolon-separated emails', () => {
    const r = parseRecipientFields({ to: 'a@x.co.za; b@x.co.za' })
    expect(r.totalSendable).toBe(2)
  })

  it('deduplicates across To / CC / BCC with To winning', () => {
    const r = parseRecipientFields({
      to: 'shared@x.co.za',
      cc: 'shared@x.co.za, other@x.co.za',
      bcc: 'shared@x.co.za, secret@x.co.za',
    })
    expect(r.totalSendable).toBe(3)
    expect(r.toCount).toBe(1)
    expect(r.ccCount).toBe(1)
    expect(r.bccCount).toBe(1)
    expect(r.invalid.some((x) => x.reason?.startsWith('duplicate_'))).toBe(true)
  })

  it('flags invalid emails', () => {
    expect(isValidEmailSyntax('not-an-email')).toBe(false)
    const r = parseRecipientFields({ to: 'not-an-email\ngood@x.co.za' })
    expect(r.totalSendable).toBe(1)
    expect(r.invalid.some((x) => x.reason === 'invalid_email')).toBe(true)
  })

  it('rejects empty recipient sets for sendability', () => {
    const r = parseRecipientFields({ to: '', cc: '', bcc: '' })
    expect(r.totalSendable).toBe(0)
  })

  it('enforces recipient maximum', () => {
    const many = Array.from({ length: OUTREACH_MAX_RECIPIENTS + 1 }, (_, i) => `u${i}@x.co.za`).join(
      '\n'
    )
    const r = parseRecipientFields({ to: many })
    expect(r.exceedsMax).toBe(true)
    expect(r.totalSendable).toBe(OUTREACH_MAX_RECIPIENTS + 1)
  })

  it('sanitizes unsafe HTML from composer body', () => {
    const dirty =
      '<p>Hello</p><script>alert(1)</script><a href="javascript:alert(1)">x</a><a href="https://www.tenderbriefing.co.za">ok</a>'
    const clean = sanitizeComposerHtml(dirty)
    expect(clean).toContain('<p>Hello</p>')
    expect(clean).not.toContain('<script')
    expect(clean).not.toContain('javascript:')
    expect(clean).toContain('https://www.tenderbriefing.co.za')
    expect(htmlToPlainText(clean)).toContain('Hello')
  })

  it('prepopulates SME and Youth Agent templates; blank is empty subject', () => {
    const blank = getComposerTemplate('blank')
    expect(blank.subject).toBe('')
    const sme = getComposerTemplate('sme_invitation')
    expect(sme.subject.length).toBeGreaterThan(5)
    expect(sme.html.toLowerCase()).toContain('youth agent')
    const ya = getComposerTemplate('youth_agent_invitation')
    expect(ya.subject.toLowerCase()).toContain('youth')
  })

  it('authorized senders come from Resend fromAddress — no spoofing list', () => {
    const senders = listAuthorizedOutreachSenders({
      ...process.env,
      RESEND_FROM_EMAIL: 'TenderBriefing <info@tenderbriefing.co.za>',
    })
    expect(senders).toHaveLength(1)
    expect(senders[0].display).toContain('info@tenderbriefing.co.za')
    expect(senders[0].email).toBe('info@tenderbriefing.co.za')
  })

  it('campaign type parsing supports blank/composer', () => {
    expect(parseOutreachCampaignType('blank')).toBe('blank_email')
    expect(parseOutreachCampaignType('composer')).toBe('composer_custom')
    expect(parseOutreachCampaignType('sme_invitation')).toBe('sme_invitation')
  })

  it('compose route requires founder auth and confirmation gates', () => {
    const src = fs.readFileSync(
      path.join(process.cwd(), 'app/api/founder/outreach/compose/route.ts'),
      'utf8'
    )
    expect(src).toContain('verifyFounderUser')
    expect(src).toContain('confirmSend')
    expect(src).toContain('authorisedList')
    expect(src).toContain('idempotencyKey')
    expect(src).toContain('resolveComposerRecipients')
    expect(src).not.toContain('parseOutreachXlsx')
  })

  it('sendEngine sends one recipient per message for BCC privacy', () => {
    const src = fs.readFileSync(
      path.join(process.cwd(), 'lib/founder/outreach/sendEngine.ts'),
      'utf8'
    )
    expect(src).toContain('One recipient per Resend message')
    expect(src).toContain('renderComposerEmail')
    expect(src).toContain('to: delivery.normalisedEmail')
  })

  it('primary Outreach UI no longer requires Excel upload', () => {
    const src = fs.readFileSync(
      path.join(process.cwd(), 'app/founder/outreach/page.tsx'),
      'utf8'
    )
    expect(src).toContain('Compose Email')
    expect(src).toContain('RecipientChipInput')
    expect(src).toContain('RichEmailEditor')
    expect(src).not.toContain('Upload Excel')
    expect(src).not.toContain('.xlsx')
    expect(src).not.toContain('Required columns')
  })

  it('founderOutreachEmail still uses Resend channel FOUNDER_OUTREACH', () => {
    const src = fs.readFileSync(
      path.join(process.cwd(), 'lib/services/founderOutreachEmail.ts'),
      'utf8'
    )
    expect(src).toContain('FOUNDER_OUTREACH')
    expect(src).toContain("to: [recipient]")
    expect(src).not.toContain('microsoft')
    expect(src).not.toContain('graph.microsoft')
  })
})
