import { NextRequest, NextResponse } from 'next/server'
import { verifyFounderUser } from '@/lib/founder/verifyFounder'
import { isFounderSmeOutreachEnabled, OUTREACH_MAX_UPLOAD_BYTES } from '@/lib/founder/outreach/featureFlag'
import { parseOutreachXlsx } from '@/lib/founder/outreach/parseSpreadsheet'
import { createValidatedCampaign } from '@/lib/founder/outreach/campaignStore'
import { getFirebaseAdmin } from '@/lib/backend/firebaseAdmin'
import { renderOutreachEmail } from '@/lib/founder/outreach/templateRegistry'
import { parseOutreachCampaignType, audienceLabel } from '@/lib/founder/outreach/campaignTypes'
import { checkRateLimit, clientIpFromRequest } from '@/lib/security/rateLimit'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(request: NextRequest) {
  if (!isFounderSmeOutreachEnabled()) {
    return NextResponse.json(
      { success: false, error: 'Founder SME Outreach is disabled', code: 'flag_disabled' },
      { status: 403 }
    )
  }

  const auth = await verifyFounderUser(request.headers.get('authorization'))
  if ('error' in auth) return auth.error

  const rl = checkRateLimit(
    `founder-outreach-validate:${auth.user.uid}:${clientIpFromRequest(request)}`,
    10,
    60_000
  )
  if (!rl.allowed) {
    return NextResponse.json({ success: false, error: 'Too many upload attempts' }, { status: 429 })
  }

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid multipart body' }, { status: 400 })
  }

  const file = form.get('file')
  if (!file || typeof file === 'string') {
    return NextResponse.json({ success: false, error: 'file is required' }, { status: 400 })
  }

  const campaignTypeRaw = form.get('campaignType')
  const campaignType = parseOutreachCampaignType(campaignTypeRaw)
  if (!campaignType) {
    return NextResponse.json(
      {
        success: false,
        error: 'campaignType must be sme_invitation or youth_agent_invitation',
        code: 'invalid_campaign_type',
      },
      { status: 400 }
    )
  }

  const blob = file as File
  const fileName = blob.name || 'upload.xlsx'
  if (!fileName.toLowerCase().endsWith('.xlsx')) {
    return NextResponse.json(
      { success: false, error: 'Only .xlsx files are accepted', code: 'invalid_extension' },
      { status: 400 }
    )
  }
  if (blob.size > OUTREACH_MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      { success: false, error: 'File too large', code: 'file_too_large' },
      { status: 400 }
    )
  }

  const buffer = Buffer.from(await blob.arrayBuffer())
  const parsed = parseOutreachXlsx(buffer, { fileName, campaignType })
  if (!parsed.ok) {
    return NextResponse.json(
      { success: false, error: parsed.error, code: parsed.code },
      { status: 400 }
    )
  }

  const db = getFirebaseAdmin().firestore()
  try {
    const { campaign, preview } = await createValidatedCampaign({
      db,
      fileName,
      rows: parsed.rows,
      createdByUid: auth.user.uid,
      createdByEmail: auth.user.email || '',
      campaignType,
    })

    const sampleReady = preview.find((r) => r.status === 'ready')
    const sampleEmail = renderOutreachEmail(campaignType, {
      name: sampleReady?.name || 'Alex',
      companyName: sampleReady?.companyName || 'Example Co',
      email: 'preview@example.com',
      unsubscribeUrl: 'https://www.tenderbriefing.co.za/api/outreach/unsubscribe?token=preview',
    })

    return NextResponse.json({
      success: true,
      data: {
        campaign,
        preview: preview.map((r) => ({
          name: r.name,
          companyName: r.companyName,
          email: r.email,
          status: r.status,
          reason: r.reason || null,
          rowNumber: r.rowNumber,
        })),
        emailPreview: {
          subject: sampleEmail.subject,
          ctaLabel: sampleEmail.ctaLabel,
          ctaUrl: sampleEmail.ctaUrl,
          templateVersion: sampleEmail.templateVersion,
          textExcerpt: sampleEmail.text.slice(0, 500),
          campaignType,
          audienceLabel: audienceLabel(campaignType),
        },
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Campaign create failed'
    return NextResponse.json(
      { success: false, error: message, code: 'campaign_create_failed' },
      { status: 400 }
    )
  }
}
