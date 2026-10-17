import { describe, expect, it, vi, beforeEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import { analyseComposerContent } from '@/lib/founder/outreach/deliverability/contentWarnings'
import { buildStaticAuthAudit } from '@/lib/founder/outreach/deliverability/authAudit'
import {
  isOutreachBulkAuthorized,
  controlledRecipientCap,
  shouldPauseForRates,
  assertOutreachSendAllowed,
} from '@/lib/founder/outreach/deliverability/reputation'
import {
  applyOutreachResendEvent,
  mapLifecycleToUiLabel,
} from '@/lib/founder/outreach/deliverability/webhookReconcile'
import { labelDeliveryStatus, providerAcceptanceDisclaimer } from '@/lib/founder/outreach/statusLabels'

const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), 'utf8')

describe('Outreach deliverability protection', () => {
  it('auth audit preserves Microsoft 365 and does not auto-change DNS', () => {
    const audit = buildStaticAuthAudit({
      resendDomainStatus: 'verified',
      fromAddress: 'TenderBriefing <hello@tenderbriefing.co.za>',
    })
    expect(audit.microsoft365Preserved).toBe(true)
    expect(audit.fromIdentity).toContain('hello@tenderbriefing.co.za')
    expect(audit.checks.some((c) => c.id === 'spf_apex' && c.status === 'pass')).toBe(true)
    expect(audit.dnsChangeRecommendations.every((r) => r.riskIfChanged.length > 10)).toBe(true)
  })

  it('content warnings advise without rewriting; blocks dangerous schemes', () => {
    const ok = analyseComposerContent({
      subject: 'Compulsory briefings, without the travel',
      html: '<p>Hello</p><p><a href="https://www.tenderbriefing.co.za">Link</a></p>',
      text: 'Hello',
    })
    expect(ok.hasBlocking).toBe(false)

    const bad = analyseComposerContent({
      subject: 'Re: FREE MONEY act now',
      html: '<p><a href="javascript:alert(1)">x</a><script>bad</script></p>',
    })
    expect(bad.hasBlocking).toBe(true)
    expect(bad.warnings.some((w) => w.code === 'dangerous_url_scheme')).toBe(true)
    expect(bad.warnings.some((w) => w.severity === 'warn' && w.code === 'risky_subject')).toBe(true)
  })

  it('bulk outreach is fail-closed; controlled cap defaults to 5', () => {
    expect(isOutreachBulkAuthorized({ OUTREACH_BULK_AUTHORIZED: undefined } as NodeJS.ProcessEnv)).toBe(
      false
    )
    expect(isOutreachBulkAuthorized({ OUTREACH_BULK_AUTHORIZED: 'true' } as NodeJS.ProcessEnv)).toBe(
      true
    )
    expect(controlledRecipientCap({} as NodeJS.ProcessEnv)).toBe(5)
  })

  it('reputation pause thresholds fire on bounce/complaint spikes', () => {
    expect(
      shouldPauseForRates({ sampleSize: 10, bounced: 5, complained: 0 }).pause
    ).toBe(false)
    expect(
      shouldPauseForRates({ sampleSize: 50, bounced: 10, complained: 0 }).pause
    ).toBe(true)
    expect(
      shouldPauseForRates({ sampleSize: 50, bounced: 0, complained: 1 }).pause
    ).toBe(true)
  })

  it('assertOutreachSendAllowed blocks bulk when unauthorized', async () => {
    const db = {
      collection: () => ({
        doc: () => ({
          get: async () => ({ exists: false, data: () => ({}) }),
        }),
      }),
    } as any
    const blocked = await assertOutreachSendAllowed(db, 10, {
      OUTREACH_BULK_AUTHORIZED: 'false',
    } as NodeJS.ProcessEnv)
    expect(blocked.ok).toBe(false)
    expect(blocked.code).toBe('bulk_blocked')

    const ok = await assertOutreachSendAllowed(db, 3, {
      OUTREACH_BULK_AUTHORIZED: 'false',
    } as NodeJS.ProcessEnv)
    expect(ok.ok).toBe(true)
  })

  it('status labels distinguish SUBMITTED vs PROVIDER_DELIVERED vs bounce', () => {
    expect(labelDeliveryStatus('sent')).toBe('SUBMITTED')
    expect(labelDeliveryStatus('sent', 'delivered')).toBe('PROVIDER_DELIVERED')
    expect(labelDeliveryStatus('sent', 'bounced')).toBe('BOUNCED')
    expect(labelDeliveryStatus('sent', 'complained')).toBe('COMPLAINED')
    expect(providerAcceptanceDisclaimer()).toMatch(/not prove|not.*Primary|not mailbox/i)
    expect(mapLifecycleToUiLabel('delivered')).toBe('PROVIDER_DELIVERED')
  })

  it('webhook reconcile advances lifecycle idempotently and suppresses on bounce', async () => {
    const deliveryState: Record<string, any> = {
      status: 'sent',
      providerLifecycle: 'accepted',
      normalisedEmail: 'user@gmail.com',
    }
    const suppressionCalls: any[] = []
    const indexDoc = {
      campaignId: 'camp1',
      deliveryId: 'del1',
      normalisedEmail: 'user@gmail.com',
    }

    const deliveryRef = {
      get: async () => ({ exists: true, data: () => ({ ...deliveryState }) }),
      set: async (patch: any) => {
        Object.assign(deliveryState, patch)
      },
    }

    const db = {
      collection: (name: string) => {
        if (name === 'founderOutreachByProviderId') {
          return {
            doc: () => ({
              get: async () => ({ exists: true, data: () => indexDoc }),
            }),
          }
        }
        if (name === 'founderOutreachCampaigns') {
          return {
            doc: () => ({
              collection: () => ({
                doc: () => deliveryRef,
              }),
            }),
          }
        }
        if (name === 'emailSuppressions') {
          return {
            doc: () => ({
              get: async () => ({ exists: false }),
              set: async (data: any) => {
                suppressionCalls.push(data)
              },
            }),
          }
        }
        if (name === 'founderOutreachRuntime') {
          return {
            doc: () => ({
              set: async () => undefined,
              get: async () => ({ exists: false, data: () => ({}) }),
            }),
          }
        }
        return {
          doc: () => ({ get: async () => ({ exists: false }), set: async () => undefined }),
        }
      },
      collectionGroup: () => ({
        orderBy: () => ({
          limit: () => ({
            get: async () => ({ docs: [] }),
          }),
        }),
      }),
      runTransaction: async (fn: any) =>
        fn({
          get: async () => ({ exists: true, data: () => ({ ...deliveryState }) }),
          set: (_ref: any, patch: any) => {
            Object.assign(deliveryState, patch)
          },
        }),
    } as any

    // Mock upsert via real module path — suppression uses emailSuppressions collection
    const r1 = await applyOutreachResendEvent(db, {
      providerMessageId: 're_1',
      eventType: 'email.delivered',
      providerEventId: 'evt_1',
    })
    expect(r1.applied).toBe(true)
    expect(deliveryState.providerLifecycle).toBe('delivered')

    const r2 = await applyOutreachResendEvent(db, {
      providerMessageId: 're_1',
      eventType: 'email.delivered',
      providerEventId: 'evt_1b',
    })
    expect(r2.applied).toBe(false)

    const r3 = await applyOutreachResendEvent(db, {
      providerMessageId: 're_1',
      eventType: 'email.bounced',
      providerEventId: 'evt_2',
    })
    expect(r3.applied).toBe(true)
    expect(deliveryState.providerLifecycle).toBe('bounced')
  })

  it('wires compose reputation/content gates and webhook outreach reconcile', () => {
    const compose = read('app/api/founder/outreach/compose/route.ts')
    expect(compose).toContain('analyseComposerContent')
    expect(compose).toContain('assertOutreachSendAllowed')
    expect(compose).toContain('content_blocked')
    expect(compose).toContain('reputationGate.code')

    const reputation = read('lib/founder/outreach/deliverability/reputation.ts')
    expect(reputation).toContain("code: 'bulk_blocked'")

    const webhook = read('app/api/webhooks/resend/route.ts')
    expect(webhook).toContain('applyOutreachResendEvent')
    expect(webhook).toContain('outreach_webhook_reconciled')

    const engine = read('lib/founder/outreach/sendEngine.ts')
    expect(engine).toContain('indexOutreachProviderMessage')
    expect(engine).toContain("providerLifecycle: 'accepted'")
  })

  it('deliverability dashboard page exists and distinguishes placement', () => {
    const page = read('app/founder/outreach/deliverability/page.tsx')
    expect(page).toContain('Provider delivered')
    expect(page).toContain('Bulk outreach remains BLOCKED')
    expect(page).toContain('record_inbox_placement')
    expect(page).toContain('Primary Inbox')
  })
})
