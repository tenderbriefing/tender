import { describe, expect, it } from 'vitest'
import fs from 'fs'
import path from 'path'
import { parseRecipientFields } from '@/lib/founder/outreach/parseRecipients'
import { applySuppressionToParsed } from '@/lib/founder/outreach/resolveComposerRecipients'
import {
  individualEmailConfirmCopy,
  suppressionExclusionCopy,
} from '@/lib/founder/outreach/statusLabels'

const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), 'utf8')

describe('Composer preview sendable = create sendable (suppression)', () => {
  it('no suppression: preview confirmCount equals parsed unique sendable', () => {
    const parsed = parseRecipientFields({
      to: 'a@gmail.com, b@gmail.com',
      cc: 'c@gmail.com',
    })
    const r = applySuppressionToParsed(parsed, new Set())
    expect(r.sendableRecipients).toBe(3)
    expect(r.confirmCount).toBe(3)
    expect(r.suppressedRecipients).toEqual([])
    expect(individualEmailConfirmCopy(r.confirmCount)).toBe(
      'You are about to send 3 individual emails.'
    )
    expect(suppressionExclusionCopy(r.suppressedRecipients.length)).toBeNull()
  })

  it('one suppressed recipient: confirm says 4 not 5', () => {
    const parsed = parseRecipientFields({
      to: [
        'chapter28csd@gmail.com',
        'orisoncsd@gmail.com',
        'kmgcsd@gmail.com',
        'makhubela.ct@gmail.com',
        'matlacsd@gmail.com',
      ].join(', '),
    })
    expect(parsed.totalSendable).toBe(5)
    const r = applySuppressionToParsed(parsed, new Set(['makhubela.ct@gmail.com']))
    expect(r.rawRecipients).toBe(5)
    expect(r.sendableRecipients).toBe(4)
    expect(r.confirmCount).toBe(4)
    expect(r.suppressedRecipients).toEqual(['makhubela.ct@gmail.com'])
    expect(individualEmailConfirmCopy(r.confirmCount)).toBe(
      'You are about to send 4 individual emails.'
    )
    expect(individualEmailConfirmCopy(r.confirmCount)).not.toContain('5 individual')
    expect(suppressionExclusionCopy(1)).toMatch(/excluded because of suppression/)
  })

  it('multiple suppressed recipients', () => {
    const parsed = parseRecipientFields({
      to: 'a@x.co.za, b@x.co.za, c@x.co.za, d@x.co.za',
    })
    const r = applySuppressionToParsed(parsed, new Set(['a@x.co.za', 'c@x.co.za']))
    expect(r.sendableRecipients).toBe(2)
    expect(r.suppressedRecipients.sort()).toEqual(['a@x.co.za', 'c@x.co.za'])
    expect(r.confirmCount).toBe(2)
  })

  it('duplicate + suppressed recipient: dedupe then suppress', () => {
    const parsed = parseRecipientFields({
      to: 'a@x.co.za, b@x.co.za',
      cc: 'a@x.co.za',
      bcc: 'c@x.co.za',
    })
    // a appears in To and Cc → 1 sendable for a; suppress a → sendable b,c
    expect(parsed.totalSendable).toBe(3)
    expect(parsed.invalid.some((x) => x.reason === 'duplicate_to')).toBe(true)
    const r = applySuppressionToParsed(parsed, new Set(['a@x.co.za']))
    expect(r.duplicatesRemoved).toBe(1)
    expect(r.sendableRecipients).toBe(2)
    expect(r.sendable.map((s) => s.normalisedEmail).sort()).toEqual([
      'b@x.co.za',
      'c@x.co.za',
    ])
    expect(r.confirmCount).toBe(2)
  })

  it('all recipients suppressed → confirmCount 0', () => {
    const parsed = parseRecipientFields({ to: 'a@x.co.za, b@x.co.za' })
    const r = applySuppressionToParsed(parsed, new Set(['a@x.co.za', 'b@x.co.za']))
    expect(r.sendableRecipients).toBe(0)
    expect(r.confirmCount).toBe(0)
    expect(individualEmailConfirmCopy(0)).toBe('You are about to send 0 individual emails.')
  })

  it('To/Cc/Bcc dedupe combined with suppression preserves To precedence among sendable', () => {
    const parsed = parseRecipientFields({
      to: 'keep@x.co.za, drop@x.co.za',
      cc: 'keep@x.co.za, other@x.co.za',
      bcc: 'drop@x.co.za, last@x.co.za',
    })
    // unique before suppress: keep(to), drop(to), other(cc), last(bcc)
    expect(parsed.totalSendable).toBe(4)
    const r = applySuppressionToParsed(parsed, new Set(['drop@x.co.za']))
    expect(r.sendableRecipients).toBe(3)
    expect(r.toCount).toBe(1)
    expect(r.ccCount).toBe(1)
    expect(r.bccCount).toBe(1)
    expect(r.sendable.find((s) => s.normalisedEmail === 'keep@x.co.za')?.field).toBe('to')
  })

  it('compose route wires resolveComposerRecipients + confirmCount from sendable', () => {
    const compose = read('app/api/founder/outreach/compose/route.ts')
    expect(compose).toContain('resolveComposerRecipients')
    expect(compose).toContain('resolution.confirmCount')
    expect(compose).toContain('suppressedRecipients')
    expect(compose).toContain('all_suppressed')
    expect(compose).toContain('suppressionExclusionCopy')
    // Must not confirm from pre-suppression parsed.totalSendable
    expect(compose).not.toMatch(
      /confirmCopy:\s*individualEmailConfirmCopy\(parsed\.totalSendable\)/
    )
  })

  it('UI confirmation uses server preview confirmCount (not local parse total)', () => {
    const page = read('app/founder/outreach/page.tsx')
    expect(page).toContain('confirmCount: preview.confirmCount')
    expect(page).toContain('suppressionCopy')
    expect(page).toMatch(/cannot be overridden/)
    expect(page).not.toMatch(/confirmCount:\s*parsed\.totalSendable/)
  })
})
