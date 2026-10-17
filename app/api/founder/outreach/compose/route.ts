import { NextRequest, NextResponse } from 'next/server'
import { verifyFounderUser } from '@/lib/founder/verifyFounder'
import {
  isFounderSmeOutreachEnabled,
  OUTREACH_MAX_RECIPIENTS,
  OUTREACH_SEND_TICK_SIZE,
} from '@/lib/founder/outreach/featureFlag'
import { getFirebaseAdmin } from '@/lib/backend/firebaseAdmin'
import {
  createComposerCampaign,
  findCampaignByIdempotencyKey,
  getCampaign,
} from '@/lib/founder/outreach/campaignStore'
import { sanitizeComposerHtml, htmlToPlainText } from '@/lib/founder/outreach/sanitizeComposerHtml'
import { parseOutreachCampaignType } from '@/lib/founder/outreach/campaignTypes'
import { getComposerTemplate } from '@/lib/founder/outreach/composerTemplates'
import {
  resolveAuthorizedSender,
  listAuthorizedOutreachSenders,
} from '@/lib/founder/outreach/authorizedSenders'
import {
  individualEmailConfirmCopy,
  suppressionExclusionCopy,
} from '@/lib/founder/outreach/statusLabels'
import { resolveComposerRecipients } from '@/lib/founder/outreach/resolveComposerRecipients'
import { confirmAndStartCampaign, processCampaignSends } from '@/lib/founder/outreach/sendEngine'
import { analyseComposerContent } from '@/lib/founder/outreach/deliverability/contentWarnings'
import { assertOutreachSendAllowed } from '@/lib/founder/outreach/deliverability/reputation'
import { checkRateLimit } from '@/lib/security/rateLimit'
import { OUTREACH_CAMPAIGNS } from '@/lib/founder/outreach/types'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

const LARGE_SEND_CONFIRM_THRESHOLD = 20

async function enqueueOutreachWorker(campaignId: string) {
  const base = (process.env.APP_URL || process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/$/, '')
  const secret = process.env.SYNC_SECRET || process.env.AUTOMATION_SECRET || ''
  if (!base || !secret) return
  try {
    await fetch(`${base}/api/founder/outreach/worker`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-sync-secret': secret,
      },
      body: JSON.stringify({ campaignId }),
    })
  } catch {
    /* worker continues on next tick / manual retry */
  }
}

export async function GET(request: NextRequest) {
  if (!isFounderSmeOutreachEnabled()) {
    return NextResponse.json(
      { success: false, error: 'Founder Outreach is disabled', code: 'flag_disabled' },
      { status: 403 }
    )
  }
  const auth = await verifyFounderUser(request.headers.get('authorization'))
  if ('error' in auth) return auth.error

  return NextResponse.json({
    success: true,
    data: {
      senders: listAuthorizedOutreachSenders(),
      maxRecipients: OUTREACH_MAX_RECIPIENTS,
      largeSendConfirmThreshold: LARGE_SEND_CONFIRM_THRESHOLD,
    },
  })
}

export async function POST(request: NextRequest) {
  if (!isFounderSmeOutreachEnabled()) {
    return NextResponse.json(
      { success: false, error: 'Founder Outreach is disabled', code: 'flag_disabled' },
      { status: 403 }
    )
  }

  const auth = await verifyFounderUser(request.headers.get('authorization'))
  if ('error' in auth) return auth.error

  let body: {
    to?: string | string[]
    cc?: string | string[]
    bcc?: string | string[]
    subject?: string
    html?: string
    templateKey?: string
    senderId?: string
    /** Rejected if present — From is server-authorized only */
    from?: string
    fromEmail?: string
    confirmSend?: boolean
    authorisedList?: boolean
    confirmCount?: number
    idempotencyKey?: string
  } = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 })
  }

  if (body.from != null || body.fromEmail != null) {
    return NextResponse.json(
      {
        success: false,
        error: 'From address cannot be set by the client. Use an authorized senderId.',
        code: 'unauthorized_from',
      },
      { status: 400 }
    )
  }

  const rl = checkRateLimit(`founder-outreach-compose:${auth.user.uid}`, 10, 60_000)
  if (!rl.allowed) {
    return NextResponse.json({ success: false, error: 'Compose rate limited' }, { status: 429 })
  }

  const subject = String(body.subject || '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!subject) {
    return NextResponse.json(
      { success: false, error: 'Subject is required.', code: 'empty_subject' },
      { status: 400 }
    )
  }

  const composerHtml = sanitizeComposerHtml(String(body.html || ''))
  if (!htmlToPlainText(composerHtml).trim()) {
    return NextResponse.json(
      { success: false, error: 'Email body is required.', code: 'empty_body' },
      { status: 400 }
    )
  }

  const templateKey = String(body.templateKey || 'blank')
  const template = getComposerTemplate(templateKey)
  let campaignType = parseOutreachCampaignType(templateKey)
  if (!campaignType) {
    campaignType = templateKey === 'blank' ? 'blank_email' : 'composer_custom'
  }
  // Edited template content is still tracked under the template campaign type
  if (template.key === 'sme_invitation') campaignType = 'sme_invitation'
  else if (template.key === 'youth_agent_invitation') campaignType = 'youth_agent_invitation'
  else if (template.key === 'blank') campaignType = 'blank_email'

  const sender = resolveAuthorizedSender(body.senderId)
  if (!sender) {
    return NextResponse.json(
      {
        success: false,
        error: 'Unauthorized sender identity.',
        code: 'unauthorized_from',
      },
      { status: 400 }
    )
  }
  const idempotencyKey = String(body.idempotencyKey || '').trim().slice(0, 200)

  const db = getFirebaseAdmin().firestore()

  // Preview and create share the same parse → dedupe → suppression resolution.
  const { parsed, resolution } = await resolveComposerRecipients(db, {
    to: body.to,
    cc: body.cc,
    bcc: body.bcc,
    maxRecipients: OUTREACH_MAX_RECIPIENTS,
  })

  if (parsed.invalid.some((r) => r.reason === 'invalid_email')) {
    return NextResponse.json(
      {
        success: false,
        error: 'One or more email addresses are invalid.',
        code: 'invalid_recipients',
        data: {
          invalid: parsed.invalid.filter((r) => r.reason === 'invalid_email').slice(0, 50),
        },
      },
      { status: 400 }
    )
  }

  if (parsed.totalSendable === 0) {
    return NextResponse.json(
      { success: false, error: 'At least one valid recipient is required.', code: 'empty_recipients' },
      { status: 400 }
    )
  }

  if (resolution.exceedsMax) {
    return NextResponse.json(
      {
        success: false,
        error: `Maximum ${OUTREACH_MAX_RECIPIENTS} recipients per send.`,
        code: 'recipient_limit',
      },
      { status: 400 }
    )
  }

  if (resolution.sendableRecipients === 0) {
    return NextResponse.json(
      {
        success: false,
        error: 'No sendable recipients after suppression filtering.',
        code: 'all_suppressed',
        data: {
          preview: {
            rawRecipients: resolution.rawRecipients,
            duplicatesRemoved: resolution.duplicatesRemoved,
            suppressedRecipients: resolution.suppressedRecipients,
            sendableRecipients: 0,
            individualEmails: 0,
            confirmCount: 0,
            confirmCopy: individualEmailConfirmCopy(0),
            suppressionCopy: suppressionExclusionCopy(resolution.suppressedRecipients.length),
            to: 0,
            cc: 0,
            bcc: 0,
            subject,
            from: sender.display,
            requiresLargeConfirm: false,
          },
        },
      },
      { status: 400 }
    )
  }

  if (idempotencyKey) {
    const existing = await findCampaignByIdempotencyKey(db, auth.user.uid, idempotencyKey)
    if (existing) {
      return NextResponse.json({
        success: true,
        data: {
          campaignId: existing.id,
          duplicate: true,
          status: existing.status,
          sentCount: existing.sentCount,
          failedCount: existing.failedCount,
          sendableRows: existing.sendableRows,
        },
      })
    }
  }

  const contentAnalysis = analyseComposerContent({
    subject,
    html: composerHtml,
    text: htmlToPlainText(composerHtml),
  })

  if (!body.confirmSend || !body.authorisedList) {
    const reputationPreview = await assertOutreachSendAllowed(db, resolution.sendableRecipients)
    return NextResponse.json(
      {
        success: false,
        error: 'Explicit confirmation required (confirmSend and authorisedList).',
        code: 'confirmation_required',
        data: {
          preview: {
            rawRecipients: resolution.rawRecipients,
            duplicatesRemoved: resolution.duplicatesRemoved,
            suppressedRecipients: resolution.suppressedRecipients,
            sendableRecipients: resolution.sendableRecipients,
            recipients: resolution.sendableRecipients,
            individualEmails: resolution.individualEmails,
            confirmCount: resolution.confirmCount,
            confirmCopy: individualEmailConfirmCopy(resolution.confirmCount),
            suppressionCopy: suppressionExclusionCopy(resolution.suppressedRecipients.length),
            to: resolution.toCount,
            cc: resolution.ccCount,
            bcc: resolution.bccCount,
            subject,
            from: sender.display,
            requiresLargeConfirm: resolution.confirmCount >= LARGE_SEND_CONFIRM_THRESHOLD,
            contentWarnings: contentAnalysis.warnings,
            contentHasBlocking: contentAnalysis.hasBlocking,
            reputation: {
              bulkAuthorized: reputationPreview.bulkAuthorized,
              paused: reputationPreview.paused,
              maxAllowed: reputationPreview.maxAllowed,
              ok: reputationPreview.ok,
              code: reputationPreview.code || null,
              error: reputationPreview.error || null,
            },
            providerVsInboxDisclaimer:
              'Provider delivery is not inbox placement. Bulk outreach remains blocked until Founder authorization.',
          },
        },
      },
      { status: 400 }
    )
  }

  if (
    typeof body.confirmCount === 'number' &&
    body.confirmCount !== resolution.confirmCount
  ) {
    return NextResponse.json(
      {
        success: false,
        error: `Confirmation count mismatch. Expected ${resolution.confirmCount}.`,
        code: 'count_mismatch',
      },
      { status: 400 }
    )
  }

  if (contentAnalysis.hasBlocking) {
    return NextResponse.json(
      {
        success: false,
        error: 'Message content failed deliverability safety checks.',
        code: 'content_blocked',
        data: { contentWarnings: contentAnalysis.warnings },
      },
      { status: 400 }
    )
  }

  const reputationGate = await assertOutreachSendAllowed(db, resolution.sendableRecipients)
  if (!reputationGate.ok) {
    return NextResponse.json(
      {
        success: false,
        error: reputationGate.error || 'Send not allowed.',
        code: reputationGate.code || 'reputation_blocked',
        data: {
          maxAllowed: reputationGate.maxAllowed,
          bulkAuthorized: reputationGate.bulkAuthorized,
          paused: reputationGate.paused,
        },
      },
      { status: 403 }
    )
  }

  try {
    const campaign = await createComposerCampaign({
      db,
      createdByUid: auth.user.uid,
      createdByEmail: auth.user.email || '',
      campaignType,
      templateKey: template.key,
      subject,
      composerHtml,
      fromAddress: sender.display,
      // Pass post-parse valid recipients; create re-applies the same suppression filter.
      recipients: parsed.sendable.map((r) => ({
        email: r.email,
        normalisedEmail: r.normalisedEmail,
        field: r.field,
      })),
      toCount: resolution.toCount,
      ccCount: resolution.ccCount,
      bccCount: resolution.bccCount,
      idempotencyKey: idempotencyKey || `outreach-compose:${Date.now()}`,
    })

    await confirmAndStartCampaign({
      db,
      campaignId: campaign.id,
      founderUid: auth.user.uid,
    })

    const result = await processCampaignSends({
      db,
      campaignId: campaign.id,
      maxToProcess: OUTREACH_SEND_TICK_SIZE,
    })

    const still = await db
      .collection(OUTREACH_CAMPAIGNS)
      .doc(campaign.id)
      .collection('deliveries')
      .where('status', '==', 'queued')
      .limit(1)
      .get()
    if (!still.empty) {
      void enqueueOutreachWorker(campaign.id)
    }

    const fresh = await getCampaign(db, campaign.id)
    const failedDeliveries = await db
      .collection(OUTREACH_CAMPAIGNS)
      .doc(campaign.id)
      .collection('deliveries')
      .where('status', '==', 'failed')
      .limit(50)
      .get()

    return NextResponse.json({
      success: true,
      data: {
        campaignId: campaign.id,
        status: fresh?.status || 'sending',
        submitted: result.sent,
        failed: result.failed,
        processedThisTick: result.processed,
        sendableRows: campaign.sendableRows,
        toCount: campaign.toCount,
        ccCount: campaign.ccCount,
        bccCount: campaign.bccCount,
        subject: campaign.subject,
        from: campaign.fromAddress,
        failures: failedDeliveries.docs.map(
          (d: { data: () => Record<string, unknown> }) => {
            const row = d.data()
            return {
              email: String(row.normalisedEmail || ''),
              errorCode: row.errorCode ? String(row.errorCode) : undefined,
              error: row.errorMessageSafe ? String(row.errorMessageSafe) : undefined,
            }
          }
        ),
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Compose send failed'
    console.error('[founder/outreach/compose]', message.slice(0, 200))
    return NextResponse.json(
      { success: false, error: message.slice(0, 200), code: 'compose_failed' },
      { status: 500 }
    )
  }
}
