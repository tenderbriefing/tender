import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Public CTA endpoints — authenticated by signed token only.
 * GET  ?token= — preview opportunity
 * POST { token, action: 'confirm' } — create request + return /pay path
 */
export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get('token') || ''
    const svc = require('../../../../backend/services/smeConnectConversionService') as {
      loadCandidateFromToken: (t: string) => Promise<{
        ok: boolean
        error?: string
        status?: number
        candidate?: Record<string, unknown>
      }>
      publicCandidateView: (c: Record<string, unknown>) => unknown
      markClicked: (c: Record<string, unknown>) => Promise<Record<string, unknown>>
    }
    const loaded = await svc.loadCandidateFromToken(token)
    if (!loaded.ok || !loaded.candidate) {
      return NextResponse.json(
        { success: false, error: loaded.error || 'Invalid link' },
        { status: loaded.status || 401 }
      )
    }
    const clicked = await svc.markClicked(loaded.candidate)
    return NextResponse.json({
      success: true,
      data: svc.publicCandidateView(clicked),
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'CTA preview failed',
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const token = String(body.token || '')
    const action = String(body.action || 'confirm')
    if (action !== 'confirm') {
      return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 })
    }
    const svc = require('../../../../backend/services/smeConnectConversionService') as {
      confirmAndCreateRequest: (t: string) => Promise<{
        ok: boolean
        error?: string
        status?: number
        payPath?: string
        alreadyExisted?: boolean
        candidate?: unknown
        request?: { id?: string }
      }>
    }
    const result = await svc.confirmAndCreateRequest(token)
    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error || 'Confirm failed' },
        { status: result.status || 400 }
      )
    }
    return NextResponse.json({
      success: true,
      data: {
        payPath: result.payPath,
        alreadyExisted: result.alreadyExisted === true,
        requestId: result.request?.id || null,
        candidate: result.candidate,
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Confirm failed',
      },
      { status: 500 }
    )
  }
}
