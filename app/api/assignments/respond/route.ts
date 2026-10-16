/**
 * Phase 15 — Secure representative accept/decline via scoped dispatch token.
 * No unauthenticated request mutation without a valid token.
 */
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

function dispatchService() {
  return require('../../../../backend/services/ops/assignmentDispatchService')
}

export async function GET(request: NextRequest) {
  const requestId = String(request.nextUrl.searchParams.get('requestId') || '').trim()
  const token = String(request.nextUrl.searchParams.get('token') || '').trim()
  if (!requestId || !token) {
    return NextResponse.json({ success: false, error: 'Missing requestId or token' }, { status: 400 })
  }
  try {
    const svc = dispatchService()
    const preview = await svc.getDispatchPreview(requestId, token)
    if (!preview) {
      return NextResponse.json({ success: false, error: 'Invalid or expired link' }, { status: 404 })
    }
    return NextResponse.json({ success: true, data: preview })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Load failed' },
      { status: 400 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const requestId = String(body.requestId || '').trim()
    const token = String(body.token || '').trim()
    const decision = String(body.decision || body.action || '')
      .trim()
      .toLowerCase()
    const reason = String(body.reason || '').trim()

    if (!requestId || !token) {
      return NextResponse.json({ success: false, error: 'Missing requestId or token' }, { status: 400 })
    }
    if (decision !== 'accept' && decision !== 'decline') {
      return NextResponse.json({ success: false, error: 'decision must be accept or decline' }, { status: 400 })
    }

    const svc = dispatchService()
    if (decision === 'accept') {
      const result = await svc.acceptDispatch(requestId, { token })
      return NextResponse.json({
        success: true,
        data: {
          decision: 'accept',
          alreadyAccepted: result.alreadyAccepted,
          opsStage: result.request?.opsStage || null,
          assignmentSubstate: result.request?.assignmentSubstate || null,
          representativeName: result.request?.representativeName || null,
        },
      })
    }

    const result = await svc.declineDispatch(requestId, { token, reason })
    return NextResponse.json({
      success: true,
      data: {
        decision: 'decline',
        alreadyDeclined: result.alreadyDeclined,
        opsStage: result.request?.opsStage || null,
        assignmentSubstate: result.request?.assignmentSubstate || null,
      },
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Response failed' },
      { status: 400 }
    )
  }
}
