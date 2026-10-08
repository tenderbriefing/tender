import { describe, expect, it } from 'vitest'
import fs from 'fs'
import path from 'path'
import { parseRecipientFields } from '@/lib/founder/outreach/parseRecipients'
import { sanitizeComposerHtml } from '@/lib/founder/outreach/sanitizeComposerHtml'
import {
  resolveAuthorizedSender,
  isAuthorizedSenderId,
} from '@/lib/founder/outreach/authorizedSenders'
import {
  OUTREACH_MAX_RECIPIENTS,
  OUTREACH_SEND_CONCURRENCY,
  OUTREACH_SEND_TICK_SIZE,
  OUTREACH_WORKER_MAX_TICKS,
} from '@/lib/founder/outreach/featureFlag'
import {
  individualEmailConfirmCopy,
  labelDeliveryStatus,
  labelCampaignStatus,
  providerAcceptanceDisclaimer,
} from '@/lib/founder/outreach/statusLabels'

const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), 'utf8')

describe('Founder Outreach Composer V2 — Founder amendments', () => {
  it('confirmation copy states individual email count explicitly', () => {
    expect(individualEmailConfirmCopy(437)).toBe(
      'You are about to send 437 individual emails.'
    )
    expect(individualEmailConfirmCopy(1)).toBe('You are about to send 1 individual email.')
    const page = read('app/founder/outreach/page.tsx')
    expect(page).toContain('individualEmailConfirmCopy')
    expect(page).toContain('Final send confirmation')
  })

  it('status terminology never presents API acceptance as DELIVERED', () => {
    expect(labelDeliveryStatus('sent')).toBe('SUBMITTED')
    expect(labelDeliveryStatus('failed')).toBe('FAILED')
    expect(labelDeliveryStatus('queued')).toBe('QUEUED')
    expect(labelCampaignStatus('sending')).toBe('SENDING')
    expect(providerAcceptanceDisclaimer()).not.toMatch(/is delivered/i)
    expect(providerAcceptanceDisclaimer()).toContain('not mailbox delivery')
    const page = read('app/founder/outreach/page.tsx')
    expect(page).toContain('SUBMITTED')
    expect(page).toContain('not DELIVERED')
    // Must not claim mailbox delivery as success
    expect(page).not.toMatch(/mailbox delivery confirmed|email was delivered/i)
  })

  it('2000 recipient ceiling rejects overflow; concurrency/tick prevent blast', () => {
    expect(OUTREACH_MAX_RECIPIENTS).toBe(2000)
    expect(OUTREACH_SEND_CONCURRENCY).toBeLessThanOrEqual(5)
    expect(OUTREACH_SEND_TICK_SIZE).toBeLessThanOrEqual(400)
    expect(OUTREACH_WORKER_MAX_TICKS).toBeGreaterThan(0)
    const many = Array.from({ length: 2001 }, (_, i) => `u${i}@x.co.za`).join(',')
    expect(parseRecipientFields({ to: many }).exceedsMax).toBe(true)
    const engine = read('lib/founder/outreach/sendEngine.ts')
    expect(engine).toContain('OUTREACH_SEND_CONCURRENCY')
    expect(engine).toContain('OUTREACH_SEND_TICK_SIZE')
    const flag = read('lib/founder/outreach/featureFlag.ts')
    expect(flag).toContain('NOT permission to blast')
  })

  it('duplicate-send protection: sent deliveries are never reclaimed', () => {
    const engine = read('lib/founder/outreach/sendEngine.ts')
    expect(engine).toContain("if (data.status === 'sent') return false")
    expect(engine).toContain("if (data.status !== 'queued') return false")
    expect(engine).toContain('Never re-send a provider-accepted delivery after worker restart')
    const compose = read('app/api/founder/outreach/compose/route.ts')
    expect(compose).toContain('idempotencyKey')
    expect(compose).toContain('findCampaignByIdempotencyKey')
  })

  it('partial worker failure/resume retains queued vs submitted vs failed', () => {
    const engine = read('lib/founder/outreach/sendEngine.ts')
    expect(engine).toContain("where('status', '==', 'queued')")
    expect(engine).toContain("status: 'sent'")
    expect(engine).toContain("status: 'failed'")
    expect(engine).toContain("status: 'queued'") // stale reclaim
    expect(engine).toContain('staleCutoff')
    expect(engine).toContain('reconcileCampaignCounts')
  })

  it('cross-field deduplication: To wins over Cc/Bcc', () => {
    const r = parseRecipientFields({
      to: 'a@x.co.za, b@x.co.za',
      cc: 'a@x.co.za, c@x.co.za',
      bcc: 'b@x.co.za, d@x.co.za',
    })
    expect(r.totalSendable).toBe(4)
    expect(r.toCount).toBe(2)
    expect(r.ccCount).toBe(1)
    expect(r.bccCount).toBe(1)
  })

  it('unauthorized From address is rejected', () => {
    expect(
      resolveAuthorizedSender('spoofed-id', {
        ...process.env,
        FOUNDER_OUTREACH_FROM_EMAIL: 'info@tenderbriefing.co.za',
      })
    ).toBeNull()
    expect(
      isAuthorizedSenderId('primary', {
        ...process.env,
        FOUNDER_OUTREACH_FROM_EMAIL: 'info@tenderbriefing.co.za',
      })
    ).toBe(true)
    expect(isAuthorizedSenderId('evil')).toBe(false)
    const compose = read('app/api/founder/outreach/compose/route.ts')
    expect(compose).toContain('unauthorized_from')
    expect(compose).toContain('From address cannot be set by the client')
    expect(compose).toContain('if (!sender)')
  })

  it('HTML/script sanitization strips dangerous content', () => {
    const clean = sanitizeComposerHtml(
      '<p>Hi</p><script>alert(1)</script><img src=x onerror=alert(1)><a href="javascript:void(0)">x</a>'
    )
    expect(clean).toContain('<p>Hi</p>')
    expect(clean).not.toContain('<script')
    expect(clean).not.toContain('onerror')
    expect(clean).not.toContain('javascript:')
  })

  it('recipient privacy: one Resend to[] per delivery; no bulk Cc/Bcc envelope', () => {
    const transport = read('lib/services/founderOutreachEmail.ts')
    expect(transport).toContain('to: [recipient]')
    expect(transport).not.toMatch(/\bcc:\s*\[/)
    expect(transport).not.toMatch(/\bbcc:\s*\[/)
    const engine = read('lib/founder/outreach/sendEngine.ts')
    expect(engine).toContain('to: delivery.normalisedEmail')
    expect(engine).toContain('One recipient per Resend message')
    expect(engine).toContain('Privacy: never attach other campaign recipients')
  })

  it('xlsx validate backend remains; primary UI disconnected from Excel', () => {
    expect(fs.existsSync(path.join(process.cwd(), 'app/api/founder/outreach/validate/route.ts'))).toBe(
      true
    )
    expect(fs.existsSync(path.join(process.cwd(), 'lib/founder/outreach/parseSpreadsheet.ts'))).toBe(
      true
    )
    const page = read('app/founder/outreach/page.tsx')
    expect(page).not.toContain('Upload Excel')
    expect(page).not.toContain('.xlsx')
    expect(page).toContain('Compose Email')
  })
})
