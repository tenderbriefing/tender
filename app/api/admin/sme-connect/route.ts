import { NextRequest, NextResponse } from 'next/server'
import { verifyApiUser, unauthorizedResponse } from '@/lib/auth/verifyApiUser'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

/**
 * Phase 19 SME Connect recommendations — Approve/Reject only.
 * No send / notify endpoint.
 */
export async function GET(request: NextRequest) {
  const user = await verifyApiUser(request.headers.get('authorization'), ['admin'])
  if (!user) return unauthorizedResponse('Admin sign-in required')

  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || undefined
    const matching = require('../../../../backend/services/smeConnectMatchingService') as {
      listRecommendations: (opts?: Record<string, unknown>) => Promise<unknown[]>
    }
    const rows = await matching.listRecommendations({
      status,
      limit: Number(searchParams.get('limit') || 200),
    })
    return NextResponse.json({
      success: true,
      data: rows,
      count: Array.isArray(rows) ? rows.length : 0,
      policy: {
        customerNotify: false,
        sendButton: false,
        note: 'Phase 19 recommendation-only — human approval required before any future outreach',
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'SME Connect list failed',
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const user = await verifyApiUser(request.headers.get('authorization'), ['admin'])
  if (!user) return unauthorizedResponse('Admin sign-in required')

  try {
    const body = await request.json().catch(() => ({}))
    const action = String(body.action || '').trim()
    const matching = require('../../../../backend/services/smeConnectMatchingService') as {
      approveRecommendation: (id: string) => Promise<unknown>
      rejectRecommendation: (id: string, reason?: string) => Promise<unknown>
      markReadyForOutreach: (id: string) => Promise<unknown>
      runMatchingForClassified: (opts?: Record<string, unknown>) => Promise<unknown>
    }

    if (action === 'approve') {
      const id = String(body.id || '')
      if (!id) return NextResponse.json({ success: false, error: 'id required' }, { status: 400 })
      const result = await matching.approveRecommendation(id)
      return NextResponse.json({ success: true, data: result, triggeredBy: user.uid })
    }

    if (action === 'reject') {
      const id = String(body.id || '')
      if (!id) return NextResponse.json({ success: false, error: 'id required' }, { status: 400 })
      const result = await matching.rejectRecommendation(id, body.reason || null)
      return NextResponse.json({ success: true, data: result, triggeredBy: user.uid })
    }

    if (action === 'ready_for_outreach') {
      const id = String(body.id || '')
      if (!id) return NextResponse.json({ success: false, error: 'id required' }, { status: 400 })
      const result = await matching.markReadyForOutreach(id)
      return NextResponse.json({ success: true, data: result, triggeredBy: user.uid })
    }

    if (action === 'run_matching') {
      const result = await matching.runMatchingForClassified({
        limit: Number(body.limit) || 50,
        minScore: Number(body.minScore) || 0.45,
      })
      return NextResponse.json({ success: true, data: result, triggeredBy: user.uid })
    }

    if (action === 'send' || action === 'notify') {
      return NextResponse.json(
        {
          success: false,
          error: 'Customer outreach send is disabled in Phase 19',
        },
        { status: 403 }
      )
    }

    return NextResponse.json({ success: false, error: `Unknown action: ${action}` }, { status: 400 })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'SME Connect action failed',
      },
      { status: 500 }
    )
  }
}
