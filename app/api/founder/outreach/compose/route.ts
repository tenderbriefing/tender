import { NextRequest, NextResponse } from 'next/server'
import { verifyFounderUser } from '@/lib/founder/verifyFounder'
import { isFounderSmeOutreachEnabled, OUTREACH_MAX_RECIPIENTS } from '@/lib/founder/outreach/featureFlag'
import { getFirebaseAdmin } from '@/lib/backend/firebaseAdmin'
import {
  createComposerCampaign,
  findCampaignByIdempotencyKey,
  getCampaign,
} from '@/lib/founder/outreach/campaignStore'
import { parseRecipientFields } from '@/lib/founder/outreach/parseRecipients'
import { sanitizeComposerHtml, htmlToPlainText } from '@/lib/founder/outreach/sanitizeComposerHtml'
import { parseOutreachCampaignType } from '@/lib/founder/outreach/campaignTypes'
import { getComposerTemplate } from '@/lib/founder/outreach/composerTemplates'
import { resolveAuthorizedSender, listAuthorizedOutreachSenders } from '@/lib/founder/outreach/authorizedSenders'
import { confirmAndStartCampaign, processCampaignSends } from '@/lib/founder/outreach/sendEngine'
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

  const rl = checkRateLimit(`founder-outreach-compose:${auth.user.uid}`, 10, 60_000)
  if (!rl.allowed) {
    return NextResponse.json({ success: false, error: 'Compose rate limited' }, { status: 429 })
  }

  const parsed = parseRecipientFields({
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

  if (parsed.exceedsMax) {
    return NextResponse.json(
      {
        success: false,
        error: `Maximum ${OUTREACH_MAX_RECIPIENTS} recipients per send.`,
        code: 'recipient_limit',
      },
      { status: 400 }
    )
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
  const idempotencyKey = String(body.idempotencyKey || '').trim().slice(0, 200)

  const db = getFirebaseAdmin().firestore()

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

  if (!body.confirmSend || !body.authorisedList) {
    return NextResponse.json(
      {
        success: false,
        error: 'Explicit confirmation required (confirmSend and authorisedList).',
        code: 'confirmation_required',
        data: {
          preview: {
            recipients: parsed.totalSendable,
            to: parsed.toCount,
            cc: parsed.ccCount,
            bcc: parsed.bccCount,
            subject,
            from: sender.display,
            requiresLargeConfirm: parsed.totalSendable >= LARGE_SEND_CONFIRM_THRESHOLD,
          },
        },
      },
      { status: 400 }
    )
  }

  if (
    typeof body.confirmCount === 'number' &&
    body.confirmCount !== parsed.totalSendable
  ) {
    return NextResponse.json(
      {
        success: false,
        error: `Confirmation count mismatch. Expected ${parsed.totalSendable}.`,
        code: 'count_mismatch',
      },
      { status: 400 }
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
      recipients: parsed.sendable.map((r) => ({
        email: r.email,
        normalisedEmail: r.normalisedEmail,
        field: r.field,
      })),
      toCount: parsed.toCount,
      ccCount: parsed.ccCount,
      bccCount: parsed.bccCount,
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
      maxToProcess: 400,
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
