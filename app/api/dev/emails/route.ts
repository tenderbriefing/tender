import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/dev/emails?id=<galleryId>
 * Development-only HTML preview of transactional email fixtures.
 */
export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_DEV_EMAIL_PREVIEW !== 'true') {
    return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
  }

  const { renderEmailTemplate } = require('@/lib/emails/templates')
  const { GALLERY, getFixture } = require('@/lib/emails/fixtures')

  const id = request.nextUrl.searchParams.get('id') || 'sme_welcome'
  const entry = GALLERY.find((g: { id: string }) => g.id === id) || GALLERY[0]
  const fixture = getFixture(entry.fixture)
  const rendered = renderEmailTemplate(entry.templateId, fixture, process.env)

  const format = request.nextUrl.searchParams.get('format')
  if (format === 'json') {
    return NextResponse.json({
      success: true,
      data: {
        id: entry.id,
        label: entry.label,
        subject: rendered.subject,
        text: rendered.text,
      },
    })
  }
  if (format === 'text') {
    return new NextResponse(rendered.text, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  }

  return new NextResponse(rendered.html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}
