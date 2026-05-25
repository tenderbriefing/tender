import { NextRequest, NextResponse } from 'next/server'
import { verifyApiUser, unauthorizedResponse, forbiddenResponse } from '@/lib/auth/verifyApiUser'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

export async function GET(request: NextRequest) {
  const user = await verifyApiUser(request.headers.get('authorization'), ['sme', 'admin'])
  if (!user) return unauthorizedResponse()

  try {
    const emailIngestion = require('../../../../backend/services/procurement/emailIngestionService')
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || undefined

    const items =
      user.userType === 'admin'
        ? await emailIngestion.listIngested({ limit: 100, status })
        : await emailIngestion.listIngested({
            limit: 50,
            forwardedByUid: user.uid,
            status,
          })

    return NextResponse.json({ success: true, data: items })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Load failed' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const user = await verifyApiUser(request.headers.get('authorization'), ['sme', 'admin'])
  if (!user) return unauthorizedResponse()

  try {
    const emailIngestion = require('../../../../backend/services/procurement/emailIngestionService')
    const body = await request.json()

    const doc = await emailIngestion.ingestEmail({
      rawEmailText: body.rawEmailText || body.text || body.body || '',
      subject: body.subject || '',
      fromEmail: body.fromEmail || body.from || user.email,
      forwardedByUid: body.forwardedByUid || (user.userType === 'sme' ? user.uid : null),
      forwardedByEmail: user.email,
      source: body.source || (user.userType === 'admin' ? 'manual_upload' : 'email_forward'),
      attachments: body.attachments || [],
      html: body.html,
    })

    return NextResponse.json({ success: true, data: doc })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Ingest failed' },
      { status: 400 }
    )
  }
}
