import { NextRequest, NextResponse } from 'next/server'
import { getFirebaseAdmin } from '@/lib/backend/firebaseAdmin'
import { verifyUnsubscribeToken } from '@/lib/founder/outreach/unsubscribeToken'
import { upsertEmailSuppression } from '@/lib/founder/outreach/suppression'

export const dynamic = 'force-dynamic'

function htmlPage(title: string, body: string) {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${title}</title></head>
<body style="font-family:system-ui,sans-serif;max-width:32rem;margin:3rem auto;padding:0 1rem;color:#0f172a;">
<h1 style="font-size:1.25rem;">${title}</h1>
<p style="line-height:1.55;color:#334155;">${body}</p>
<p style="margin-top:2rem;font-size:0.875rem;color:#64748b;"><a href="https://www.tenderbriefing.co.za">TenderBriefing</a></p>
</body></html>`
}

async function handleUnsubscribe(token: string) {
  const verified = verifyUnsubscribeToken(token)
  if (!verified.ok) {
    return {
      status: 400,
      html: htmlPage(
        'Unsubscribe link invalid',
        'This unsubscribe link is invalid or has expired. If you continue to receive outreach emails, contact support@tenderbriefing.co.za.'
      ),
    }
  }
  const db = getFirebaseAdmin().firestore()
  await upsertEmailSuppression(db, verified.email, 'unsubscribe', 'outreach_unsubscribe_link')
  return {
    status: 200,
    html: htmlPage(
      'You are unsubscribed',
      'You have been unsubscribed from TenderBriefing SME outreach emails. Transactional messages about your account or bookings are unaffected.'
    ),
  }
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token') || ''
  const result = await handleUnsubscribe(token)
  return new NextResponse(result.html, {
    status: result.status,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  })
}

export async function POST(request: NextRequest) {
  let token = request.nextUrl.searchParams.get('token') || ''
  if (!token) {
    try {
      const body = await request.json()
      token = String(body?.token || '')
    } catch {
      /* ignore */
    }
  }
  const result = await handleUnsubscribe(token)
  return new NextResponse(result.html, {
    status: result.status,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  })
}
