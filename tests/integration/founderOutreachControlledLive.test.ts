/**
 * Live controlled Outreach Composer V2 test — Founder-approved 2–3 recipients only.
 * Enable with: CONTROLLED_OUTREACH_LIVE=1
 *
 * Covers: authorized From, confirmation count, To/Cc/Bcc privacy, cross-field
 * dedupe, HTML sanitization, Resend Idempotency-Key crash boundary, partial resume.
 */
import { describe, expect, it } from 'vitest'
import { execSync } from 'child_process'
import { readFileSync } from 'fs'
import { join } from 'path'
import { parseRecipientFields } from '@/lib/founder/outreach/parseRecipients'
import { resolveAuthorizedSender } from '@/lib/founder/outreach/authorizedSenders'
import {
  individualEmailConfirmCopy,
  labelDeliveryStatus,
} from '@/lib/founder/outreach/statusLabels'
import { sanitizeComposerHtml } from '@/lib/founder/outreach/sanitizeComposerHtml'
import {
  createComposerCampaign,
  listDeliveries,
  getCampaign,
} from '@/lib/founder/outreach/campaignStore'
import {
  confirmAndStartCampaign,
  processCampaignSends,
} from '@/lib/founder/outreach/sendEngine'
import {
  sendFounderOutreachEmail,
  fromAddress,
} from '@/lib/services/founderOutreachEmail'
import { getFirebaseAdmin } from '@/lib/backend/firebaseAdmin'
import { OUTREACH_CAMPAIGNS } from '@/lib/founder/outreach/types'

const RUN = process.env.CONTROLLED_OUTREACH_LIVE === '1'

/** Founder-controlled inboxes that are NOT on emailSuppressions. */
const R1 = 'support@tenderbriefing.co.za'
const R2 = 'hello@tenderbriefing.co.za'
const R3 = 'ops@tenderbriefing.co.za'

function loadSecret(name: string) {
  return execSync(
    `gcloud secrets versions access latest --secret=${name} --project=tenderbriefing-34679`,
    { encoding: 'utf8' }
  ).trim()
}

async function fetchResendEmail(messageId: string) {
  const key = process.env.RESEND_API_KEY
  if (!key || !messageId) return null
  const res = await fetch(`https://api.resend.com/emails/${messageId}`, {
    headers: { Authorization: `Bearer ${key}` },
  })
  if (!res.ok) {
    return { ok: false as const, status: res.status, body: await res.text() }
  }
  return { ok: true as const, body: (await res.json()) as Record<string, unknown> }
}

function asAddressList(value: unknown): string[] {
  if (value == null) return []
  if (Array.isArray(value)) return value.map((v) => String(v).toLowerCase())
  return [String(value).toLowerCase()]
}

describe.runIf(RUN)('Founder Outreach controlled live test (2–3 recipients)', () => {
  it(
    'full controlled certification: privacy, dedupe, sanitize, crash-boundary, partial resume',
    async () => {
      if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
        process.env.FIREBASE_SERVICE_ACCOUNT_JSON = loadSecret('tenderbriefing-firebase-sa')
      }
      if (!process.env.RESEND_API_KEY) {
        process.env.RESEND_API_KEY = loadSecret('TENDERBRIEFING_API')
      }
      process.env.FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'tenderbriefing-34679'
      process.env.STORAGE_ADAPTER = 'firestore'
      process.env.FOUNDER_SME_OUTREACH_ENABLED = 'true'
      process.env.FOUNDER_USER_INTELLIGENCE_ENABLED = 'true'

      const sha = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim()
      expect(sha.length).toBe(40)

      // --- 5. Authorized sender enforcement ---
      expect(resolveAuthorizedSender('spoofed-attacker')).toBeNull()
      expect(resolveAuthorizedSender('evil@attacker.com')).toBeNull()
      const composeSrc = readFileSync(
        join(process.cwd(), 'app/api/founder/outreach/compose/route.ts'),
        'utf8'
      )
      expect(composeSrc).toContain('unauthorized_from')
      expect(composeSrc).toContain('Unauthorized sender identity')
      const authorized = resolveAuthorizedSender('primary')
      expect(authorized?.email).toBeTruthy()
      expect(authorized!.email).toMatch(/tenderbriefing\.co\.za$/)

      // --- 10. Cross-field dedupe To > Cc > Bcc ---
      const parsed = parseRecipientFields({
        to: R1,
        cc: `${R2}, ${R3}`,
        bcc: R1, // duplicate of To — must not generate a 4th individual email
      })
      expect(parsed.totalSendable).toBe(3)
      expect(parsed.toCount).toBe(1)
      expect(parsed.ccCount).toBe(2)
      expect(parsed.bccCount).toBe(0)
      expect(parsed.sendable.map((r) => r.normalisedEmail).sort()).toEqual(
        [R1, R2, R3].sort()
      )
      expect(parsed.sendable.find((r) => r.normalisedEmail === R1)?.field).toBe('to')

      const confirmCopy = individualEmailConfirmCopy(3)
      expect(confirmCopy).toBe('You are about to send 3 individual emails.')

      // --- 11. HTML sanitization ---
      const dirty = `<p>Hi</p><script>alert(1)</script><a href="javascript:evil()">x</a><img src=x onerror=alert(1)>`
      const clean = sanitizeComposerHtml(dirty)
      expect(clean).not.toContain('<script')
      expect(clean.toLowerCase()).not.toContain('javascript:')
      expect(clean.toLowerCase()).not.toContain('onerror')

      // --- Provider idempotency probe (same key → same message id) ---
      const idemKey = `outreach-controlled-test:${Date.now()}:${R1}`
      const probe = {
        to: R1,
        subject: '[CONTROLLED TEST] Outreach Composer V2 idempotency probe',
        html: '<p>Idempotency probe — ignore.</p>',
        text: 'Idempotency probe — ignore.',
        idempotencyKey: idemKey,
      }
      const first = await sendFounderOutreachEmail(probe)
      const second = await sendFounderOutreachEmail(probe)
      expect(first.sent).toBe(true)
      expect(second.sent).toBe(true)
      expect(first.id).toBeTruthy()
      expect(first.id).toBe(second.id)

      const db = getFirebaseAdmin().firestore()
      const founderUser = await getFirebaseAdmin().auth().getUserByEmail('info@tenderbriefing.co.za')
      const campRef = () => db.collection(OUTREACH_CAMPAIGNS)

      const campaign = await createComposerCampaign({
        db,
        createdByUid: founderUser.uid,
        createdByEmail: 'info@tenderbriefing.co.za',
        campaignType: 'blank_email',
        templateKey: 'blank',
        subject: '[CONTROLLED TEST] Outreach Composer V2 — privacy + To/Cc/Bcc',
        composerHtml: sanitizeComposerHtml(`
          <h2>Controlled Outreach Composer V2 test</h2>
          <p>Founder-approved controlled test (3 unique recipients).</p>
          <p>SHA: ${sha}</p>
          <script>alert(1)</script>
          <a href="javascript:x">bad</a>
        `),
        fromAddress: authorized!.display,
        recipients: parsed.sendable.map((r) => ({
          email: r.email,
          normalisedEmail: r.normalisedEmail,
          field: r.field,
        })),
        toCount: parsed.toCount,
        ccCount: parsed.ccCount,
        bccCount: parsed.bccCount,
        idempotencyKey: `controlled-test-${Date.now()}`,
      })

      expect(campaign.sendableRows).toBe(3)
      expect(campaign.composerHtml || '').not.toContain('<script')

      await confirmAndStartCampaign({
        db,
        campaignId: campaign.id,
        founderUid: founderUser.uid,
      })

      // --- 9. Partial resume: process one recipient, leave others queued ---
      const tick1 = await processCampaignSends({
        db,
        campaignId: campaign.id,
        maxToProcess: 1,
      })
      expect(tick1.sent).toBe(1)
      expect(tick1.failed).toBe(0)

      let deliveries = await listDeliveries(db, campaign.id, { limit: 50 })
      expect(deliveries).toHaveLength(3)
      const afterPartial = {
        sent: deliveries.filter((d) => d.status === 'sent').length,
        queued: deliveries.filter((d) => d.status === 'queued').length,
        failed: deliveries.filter((d) => d.status === 'failed').length,
      }
      expect(afterPartial.sent).toBe(1)
      expect(afterPartial.queued).toBe(2)
      expect(afterPartial.failed).toBe(0)

      const submittedFirst = deliveries.find((d) => d.status === 'sent')!
      const firstMessageId = submittedFirst.resendMessageId
      expect(firstMessageId).toBeTruthy()

      // --- 8. Worker restart / accept-before-persist failure boundary ---
      // Simulate: Resend accepted, local persist of status=sent never completed,
      // row stuck in "sending", then stale reclaim resumes with same delivery.id key.
      const deliveryRef = campRef().doc(campaign.id).collection('deliveries')
      // Park remaining queued as non-stale "sending" so crash reclaim only picks the victim
      // (recent "sending" is not reclaimed; campaign stays open for later resume).
      const parked = deliveries.filter((d) => d.status === 'queued')
      const parkIso = new Date().toISOString()
      for (const p of parked) {
        await deliveryRef.doc(p.id).set(
          {
            status: 'sending',
            updatedAt: parkIso,
          },
          { merge: true }
        )
      }

      const staleIso = new Date(Date.now() - 16 * 60 * 1000).toISOString()
      await deliveryRef.doc(submittedFirst.id).set(
        {
          status: 'sending',
          resendMessageId: null,
          sentAt: null,
          providerAcceptance: null,
          updatedAt: staleIso,
        },
        { merge: true }
      )
      // Keep campaign open across the crash simulation
      await campRef().doc(campaign.id).set(
        { status: 'sending', completedAt: null, updatedAt: parkIso },
        { merge: true }
      )

      const crashTick = await processCampaignSends({
        db,
        campaignId: campaign.id,
        maxToProcess: 5,
      })
      expect(crashTick.sent).toBe(1)

      deliveries = await listDeliveries(db, campaign.id, { limit: 50 })
      const afterCrash = deliveries.find((d) => d.id === submittedFirst.id)!
      expect(afterCrash.status).toBe('sent')
      expect(afterCrash.resendMessageId).toBeTruthy()
      // Same provider message id ⇒ Resend did not create a second email
      expect(afterCrash.resendMessageId).toBe(firstMessageId)

      // Restore parked recipients to queued for normal partial resume
      for (const p of parked) {
        await deliveryRef.doc(p.id).set(
          {
            status: 'queued',
            errorCode: null,
            errorMessageSafe: null,
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        )
      }
      await campRef().doc(campaign.id).set(
        { status: 'sending', completedAt: null, updatedAt: new Date().toISOString() },
        { merge: true }
      )

      // Inject one retained FAILED among remaining queued
      deliveries = await listDeliveries(db, campaign.id, { limit: 50 })
      const stillQueued = deliveries.filter((d) => d.status === 'queued')
      expect(stillQueued.length).toBe(2)
      const failTarget = stillQueued[0]
      const continueTarget = stillQueued[1]
      await deliveryRef.doc(failTarget.id).set(
        {
          status: 'failed',
          errorCode: 'controlled_test_retained_failure',
          errorMessageSafe: 'Injected for partial-resume assertion',
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      )

      // Resume: SUBMITTED not resent; FAILED retained; remaining QUEUED continues
      const tickResume = await processCampaignSends({
        db,
        campaignId: campaign.id,
        maxToProcess: 50,
      })
      expect(tickResume.sent).toBe(1)

      deliveries = await listDeliveries(db, campaign.id, { limit: 50 })
      const fresh = await getCampaign(db, campaign.id)

      // SUBMITTED recipient unchanged message id after resume
      const stillFirst = deliveries.find((d) => d.id === submittedFirst.id)!
      expect(stillFirst.status).toBe('sent')
      expect(stillFirst.resendMessageId).toBe(firstMessageId)

      const retainedFailed = deliveries.find((d) => d.id === failTarget.id)!
      expect(retainedFailed.status).toBe('failed')
      expect(retainedFailed.errorCode).toBe('controlled_test_retained_failure')

      const continued = deliveries.find((d) => d.id === continueTarget.id)!
      expect(continued.status).toBe('sent')
      expect(continued.resendMessageId).toBeTruthy()

      const rows = deliveries.map((d) => ({
        email: d.normalisedEmail,
        deliveryId: d.id,
        field: d.recipientField,
        resendMessageId: d.resendMessageId,
        internal: d.status,
        ui: labelDeliveryStatus(d.status),
        acceptance: (d as { providerAcceptance?: string }).providerAcceptance,
      }))

      const submitted = rows.filter((r) => r.internal === 'sent')
      expect(submitted.length).toBe(2)
      // Provider acceptance is SUBMITTED only — labelDeliveryStatus never returns DELIVERED
      expect(submitted.every((r) => r.ui === 'SUBMITTED')).toBe(true)
      expect(submitted.every((r) => r.resendMessageId)).toBe(true)
      expect(new Set(submitted.map((r) => r.email)).size).toBe(2)

      const tickIdle = await processCampaignSends({
        db,
        campaignId: campaign.id,
        maxToProcess: 50,
      })
      expect(tickIdle.sent).toBe(0)

      // --- 6. Privacy: inspect Resend payloads — each message To=[only that recipient] ---
      const privacy: Array<Record<string, unknown>> = []
      for (const row of submitted) {
        const fetched = await fetchResendEmail(String(row.resendMessageId))
        expect(fetched?.ok).toBe(true)
        const body = fetched!.ok ? fetched!.body : {}
        const toList = asAddressList(body.to)
        const ccList = asAddressList(body.cc)
        const bccList = asAddressList(body.bcc)
        privacy.push({
          email: row.email,
          messageId: row.resendMessageId,
          to: toList,
          cc: ccList,
          bcc: bccList,
          from: body.from ?? null,
        })
        expect(toList).toEqual([row.email])
        expect(ccList).toEqual([])
        expect(bccList).toEqual([])
        for (const peer of [R1, R2, R3]) {
          if (peer === row.email) continue
          expect(toList).not.toContain(peer)
          expect(ccList).not.toContain(peer)
          expect(bccList).not.toContain(peer)
        }
      }

      const engineSrc = readFileSync(
        join(process.cwd(), 'lib/founder/outreach/sendEngine.ts'),
        'utf8'
      )
      expect(engineSrc).toContain('idempotencyKey: `outreach-delivery:${delivery.id}`')

      const report = {
        verdictInputs: {
          sha,
          from: fromAddress(),
          authorizedFrom: authorized!.display,
          campaignId: campaign.id,
          confirmation: confirmCopy,
          uniqueRecipients: 3,
          resendSubmissionsSubmitted: submitted.length,
          campaignStatus: fresh?.status,
          sentCount: fresh?.sentCount,
          failedCount: fresh?.failedCount,
          queuedCount: fresh?.queuedCount,
        },
        rows,
        privacy,
        idempotency: {
          probeFirstId: first.id,
          probeSecondId: second.id,
          crashBoundarySameMessageId: afterCrash.resendMessageId === firstMessageId,
          firstMessageId,
          afterCrashMessageId: afterCrash.resendMessageId,
        },
        partialResume: afterPartial,
        sanitization: {
          scriptStripped: !clean.includes('<script'),
          javascriptStripped: !clean.toLowerCase().includes('javascript:'),
          campaignHtmlClean: !(fresh?.composerHtml || '').includes('<script'),
        },
        dedupe: {
          totalSendable: parsed.totalSendable,
          toCount: parsed.toCount,
          ccCount: parsed.ccCount,
          bccCount: parsed.bccCount,
          precedence: 'To > Cc > Bcc',
        },
      }

      // eslint-disable-next-line no-console
      console.log(JSON.stringify(report, null, 2))

      expect(report.idempotency.crashBoundarySameMessageId).toBe(true)
      expect(fresh?.status).toBe('completed_with_failures')
      expect(fresh?.failedCount).toBe(1)
      expect(fresh?.sentCount).toBe(2)
    },
    240_000
  )
})

describe.runIf(!RUN)('Founder Outreach controlled live test (skipped)', () => {
  it('set CONTROLLED_OUTREACH_LIVE=1 to run', () => {
    expect(RUN).toBe(false)
  })
})
