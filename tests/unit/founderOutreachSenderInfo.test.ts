import { describe, expect, it } from 'vitest'
import fs from 'fs'
import path from 'path'
import { fromAddress } from '@/lib/services/founderOutreachEmail'
import {
  listAuthorizedOutreachSenders,
  resolveAuthorizedSender,
} from '@/lib/founder/outreach/authorizedSenders'

describe('Founder Outreach sender = info@tenderbriefing.co.za', () => {
  it('defaults to info@ and ignores transactional RESEND_FROM_EMAIL=hello@', () => {
    const from = fromAddress({
      ...process.env,
      RESEND_FROM_EMAIL: 'TenderBriefing <hello@tenderbriefing.co.za>',
      FOUNDER_OUTREACH_FROM_EMAIL: '',
    })
    expect(from).toBe('TenderBriefing <info@tenderbriefing.co.za>')
    expect(from).not.toContain('hello@')
  })

  it('honours FOUNDER_OUTREACH_FROM_EMAIL override', () => {
    expect(
      fromAddress({
        ...process.env,
        FOUNDER_OUTREACH_FROM_EMAIL: 'info@tenderbriefing.co.za',
        RESEND_FROM_EMAIL: 'hello@tenderbriefing.co.za',
      })
    ).toBe('TenderBriefing <info@tenderbriefing.co.za>')
  })

  it('authorized sender list exposes only info@ primary', () => {
    const env = {
      ...process.env,
      FOUNDER_OUTREACH_FROM_EMAIL: 'info@tenderbriefing.co.za',
      RESEND_FROM_EMAIL: 'hello@tenderbriefing.co.za',
    }
    const senders = listAuthorizedOutreachSenders(env)
    expect(senders.map((s) => s.email)).toEqual(['info@tenderbriefing.co.za'])
    expect(resolveAuthorizedSender('primary', env)?.email).toBe('info@tenderbriefing.co.za')
    expect(resolveAuthorizedSender('spoofed', env)).toBeNull()
  })

  it('cloudbuild mounts FOUNDER_OUTREACH_FROM_EMAIL=info@ without removing transactional hello@', () => {
    const yaml = fs.readFileSync(path.join(process.cwd(), 'cloudbuild.yaml'), 'utf8')
    expect(yaml).toContain('FOUNDER_OUTREACH_FROM_EMAIL=info@tenderbriefing.co.za')
    expect(yaml).toContain('RESEND_FROM_EMAIL=hello@tenderbriefing.co.za')
  })

  it('composer UI default From is info@', () => {
    const page = fs.readFileSync(
      path.join(process.cwd(), 'app/founder/outreach/page.tsx'),
      'utf8'
    )
    expect(page).toContain("useState('TenderBriefing <info@tenderbriefing.co.za>')")
    expect(page).not.toContain("useState('TenderBriefing <hello@tenderbriefing.co.za>')")
  })
})
