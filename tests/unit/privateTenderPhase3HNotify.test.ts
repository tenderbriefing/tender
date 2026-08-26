/**
 * Phase 3H notification + financial invariant + client trust unit coverage.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { BRIEFING_PRICE_CENTS, YOUTH_AGENT_PAYOUT_CENTS, GROSS_CONTRIBUTION_CENTS } from '@/lib/domain/briefingPricing'
import { buildPrivateTenderBookingSnapshot } from '@/lib/privateTenders/privateBookingSnapshot'

const lifeNotify = require('../../backend/services/briefingLifecycleNotificationService.js')

describe('Phase 3H briefing lifecycle notifications', () => {
  it('builds audience-correct founder ops templates without secrets', () => {
    const summary = lifeNotify.buildOpsSummary({
      eventType: 'ai_report_failed',
      headline: 'Briefing report generation needs attention',
      subject: '[AI retry] Test',
      entityId: 'rep-1',
      requestId: 'req-1',
      reportId: 'rep-1',
      tenderTitle: 'Test tender',
      detail: 'openai timeout — do not expose stack to SME',
      smeSafeDetail: 'Briefing report generation needs operational retry.',
      idempotencyKey: lifeNotify.IdempotencyKeys.aiFailed('rep-1', 1),
    })
    const tpl = lifeNotify.buildOpsEmailTemplate(summary)
    expect(tpl.subject).toMatch(/AI retry/)
    expect(tpl.html).toMatch(/Founder ops/)
    expect(tpl.text).not.toMatch(/api[_-]?key/i)
    expect(summary.idempotencyKey).toBe('bi-ai-failed:rep-1:1')
  })

  it('fail-soft Safe wrappers never throw', async () => {
    const result = await lifeNotify.notifyDraftReadySafe(
      { reportId: 'rep-x', requestId: 'req-x', version: 1 },
      {
        getFirestore: () => {
          throw new Error('firestore down')
        },
        env: {},
      }
    )
    expect(result).toHaveProperty('notified')
  })
})

describe('Phase 3 financial invariants', () => {
  it('keeps R349 / R200 / R149 cents authoritative', () => {
    expect(BRIEFING_PRICE_CENTS).toBe(34900)
    expect(YOUTH_AGENT_PAYOUT_CENTS).toBe(20000)
    expect(GROSS_CONTRIBUTION_CENTS).toBe(14900)
    expect(BRIEFING_PRICE_CENTS - YOUTH_AGENT_PAYOUT_CENTS).toBe(GROSS_CONTRIBUTION_CENTS)
  })

  it('booking snapshot stamps 34900 and ignores client price spoof conceptually', () => {
    const snap = buildPrivateTenderBookingSnapshot({
      id: 'priv-1',
      sourceType: 'private',
      title: 'T',
      briefingPriceCents: 1,
      paymentAmount: 1,
    })
    expect(snap.briefingPriceCents).toBe(34900)
    expect(snap.paymentAmount).toBe(34900)
  })
})

describe('Phase 3 client trust — follow-up ownership', () => {
  const prev = process.env.BRIEFING_FOLLOW_UP_UPDATES_ENABLED
  beforeEach(() => {
    process.env.BRIEFING_FOLLOW_UP_UPDATES_ENABLED = 'true'
  })
  afterEach(() => {
    if (prev === undefined) delete process.env.BRIEFING_FOLLOW_UP_UPDATES_ENABLED
    else process.env.BRIEFING_FOLLOW_UP_UPDATES_ENABLED = prev
  })

  it('review does not allow rewriting organisationId via merge side effects', async () => {
    const store = new Map()
    const db = {
      collection(name: string) {
        return {
          doc(id: string) {
            return {
              async set(data: Record<string, unknown>, opts?: { merge?: boolean }) {
                const key = `${name}/${id}`
                const prevDoc = store.get(key) || {}
                store.set(key, opts?.merge ? { ...prevDoc, ...data, id } : { ...data, id })
              },
              async get() {
                const data = store.get(`${name}/${id}`)
                return {
                  exists: Boolean(data),
                  id,
                  data: () => (data ? { ...data } : undefined),
                }
              },
            }
          },
          where() {
            return this
          },
          orderBy() {
            return this
          },
          limit() {
            return this
          },
          async get() {
            return { docs: [], empty: true }
          },
        }
      },
    }
    const svc = require('../../backend/services/briefingFollowUpUpdateService.js')
    const created = await svc.createFollowUpUpdate(
      {
        organisationId: 'porg-A',
        smeId: 'sme-A',
        briefingRequestId: 'req-A',
        title: 'Need gate info',
        content: 'Which gate?',
        updateType: 'clarification_request',
      },
      { actorUid: 'sme-A', actorEmail: 'sme@a.test', actorType: 'sme' },
      { db }
    )
    expect(created.organisationId).toBe('porg-A')
    const approved = await svc.reviewFollowUpUpdate(
      created.id,
      'approve',
      { actorUid: 'founder', actorEmail: 'info@tenderbriefing.co.za' },
      { db }
    )
    expect(approved.organisationId).toBe('porg-A')
    expect(approved.smeId).toBe('sme-A')
  })
})
