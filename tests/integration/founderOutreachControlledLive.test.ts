/**
 * Live controlled Outreach Composer V2 test — Founder-approved 2-recipient only.
 * Enable with: CONTROLLED_OUTREACH_LIVE=1
 */
import { describe, expect, it } from 'vitest'
import { execSync } from 'child_process'
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

const RUN = process.env.CONTROLLED_OUTREACH_LIVE === '1'

function loadSecret(name: string) {
  return execSync(
    `gcloud secrets versions access latest --secret=${name} --project=tenderbriefing-34679`,
    { encoding: 'utf8' }
  ).trim()
}

describe.runIf(RUN)('Founder Outreach controlled live test (2 recipients)', () => {
  it(
    'sends 2 individual emails with privacy, dedupe, sanitization, idempotency',
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
      expect(sha.startsWith('bd390b9') || sha.includes('bd390b9')).toBe(true)

      expect(resolveAuthorizedSender('spoofed-attacker')).toBeNull()
      const authorized = resolveAuthorizedSender('primary')
      expect(authorized?.email).toBeTruthy()

      const parsed = parseRecipientFields({
        to: 'info@tenderbriefing.co.za',
        cc: 'support@tenderbriefing.co.za',
        bcc: 'info@tenderbriefing.co.za',
      })
      expect(parsed.totalSendable).toBe(2)
      expect(parsed.toCount).toBe(1)
      expect(parsed.ccCount).toBe(1)
      expect(parsed.bccCount).toBe(0)
      expect(individualEmailConfirmCopy(2)).toBe('You are about to send 2 individual emails.')

      const clean = sanitizeComposerHtml(
        '<p>Hi</p><script>alert(1)</script><a href="javascript:x">x</a>'
      )
      expect(clean).not.toContain('<script')
      expect(clean.toLowerCase()).not.toContain('javascript:')

      const idemKey = `outreach-controlled-test:${Date.now()}:info@tenderbriefing.co.za`
      const probe = {
        to: 'info@tenderbriefing.co.za',
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
      const founderUser = await getFirebaseAdmin()
        .auth()
        .getUserByEmail('info@tenderbriefing.co.za')

      const campaign = await createComposerCampaign({
        db,
        createdByUid: founderUser.uid,
        createdByEmail: 'info@tenderbriefing.co.za',
        campaignType: 'blank_email',
        templateKey: 'blank',
        subject: '[CONTROLLED TEST] Outreach Composer V2 — privacy + To/Cc check',
        composerHtml: sanitizeComposerHtml(`
          <h2>Controlled Outreach Composer V2 test</h2>
          <p>Founder-approved controlled test (2 unique recipients).</p>
          <p>SHA: ${sha}</p>
          <script>alert(1)</script>
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

      await confirmAndStartCampaign({
        db,
        campaignId: campaign.id,
        founderUid: founderUser.uid,
      })

      const tick = await processCampaignSends({
        db,
        campaignId: campaign.id,
        maxToProcess: 50,
      })
      expect(tick.sent + tick.failed).toBeGreaterThan(0)

      const deliveries = await listDeliveries(db, campaign.id, { limit: 50 })
      const fresh = await getCampaign(db, campaign.id)
      expect(deliveries).toHaveLength(2)

      const rows = deliveries.map((d) => ({
        email: d.normalisedEmail,
        deliveryId: d.id,
        field: d.recipientField,
        resendMessageId: d.resendMessageId,
        internal: d.status,
        ui: labelDeliveryStatus(d.status),
        acceptance: (d as { providerAcceptance?: string }).providerAcceptance,
      }))

      // eslint-disable-next-line no-console
      console.log(
        JSON.stringify(
          {
            from: fromAddress(),
            campaignId: campaign.id,
            confirmation: individualEmailConfirmCopy(2),
            rows,
            campaignStatus: fresh?.status,
            sentCount: fresh?.sentCount,
            failedCount: fresh?.failedCount,
            idempotency: { firstId: first.id, secondId: second.id },
          },
          null,
          2
        )
      )

      expect(rows.every((r) => r.ui !== 'DELIVERED')).toBe(true)
      const submitted = rows.filter((r) => r.internal === 'sent')
      expect(submitted.length).toBe(2)
      expect(submitted.every((r) => r.ui === 'SUBMITTED')).toBe(true)
      expect(submitted.every((r) => r.resendMessageId)).toBe(true)
      expect(new Set(submitted.map((r) => r.email)).size).toBe(2)
      expect(fresh?.composerHtml || '').not.toContain('<script')

      const tick2 = await processCampaignSends({
        db,
        campaignId: campaign.id,
        maxToProcess: 50,
      })
      expect(tick2.sent).toBe(0)
    },
    180_000
  )
})

describe.runIf(!RUN)('Founder Outreach controlled live test (skipped)', () => {
  it('set CONTROLLED_OUTREACH_LIVE=1 to run', () => {
    expect(RUN).toBe(false)
  })
})
