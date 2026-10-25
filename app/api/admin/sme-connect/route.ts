import { NextRequest, NextResponse } from 'next/server'
import { verifyApiUser, unauthorizedResponse } from '@/lib/auth/verifyApiUser'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

/**
 * Phase 20 SME Connect — audit, match, approve/reject/dismiss, controlled send, funnel.
 */
export async function GET(request: NextRequest) {
  const user = await verifyApiUser(request.headers.get('authorization'), ['admin'])
  if (!user) return unauthorizedResponse('Admin sign-in required')

  try {
    const { searchParams } = new URL(request.url)
    const view = String(searchParams.get('view') || '').trim()

    if (view === 'audit') {
      const matching = require('../../../../backend/services/smeConnectMatchingService') as {
        auditHistoricalPaid: () => Promise<unknown>
      }
      return NextResponse.json({ success: true, data: await matching.auditHistoricalPaid() })
    }

    if (view === 'funnel') {
      const funnel = require('../../../../backend/services/smeConnectFunnelService') as {
        computeFunnel: () => Promise<unknown>
      }
      return NextResponse.json({ success: true, data: await funnel.computeFunnel() })
    }

    if (view === 'classification-sample') {
      const audit = require('../../../../backend/services/smeConnectClassificationAudit') as {
        sampleConfirmedCompulsory: (opts?: Record<string, unknown>) => Promise<unknown>
      }
      return NextResponse.json({
        success: true,
        data: await audit.sampleConfirmedCompulsory({
          sampleSize: Number(searchParams.get('sampleSize') || 25),
        }),
      })
    }

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
        sendRequiresApproval: true,
        liveCustomerSendDefault: false,
        note: 'Send requires HUMAN_APPROVED and overrideRecipient unless allowLiveCustomers',
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
      dismissBadMatch: (id: string, reason?: string) => Promise<unknown>
      markReadyForOutreach: (id: string) => Promise<unknown>
      runMatchingForClassified: (opts?: Record<string, unknown>) => Promise<unknown>
      auditHistoricalPaid: () => Promise<unknown>
      getRecommendation: (id: string) => Promise<unknown>
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

    if (action === 'dismiss_bad_match') {
      const id = String(body.id || '')
      if (!id) return NextResponse.json({ success: false, error: 'id required' }, { status: 400 })
      const result = await matching.dismissBadMatch(id, body.reason || 'bad_match')
      return NextResponse.json({ success: true, data: result, triggeredBy: user.uid })
    }

    if (action === 'ready_for_outreach') {
      const id = String(body.id || '')
      if (!id) return NextResponse.json({ success: false, error: 'id required' }, { status: 400 })
      const result = await matching.markReadyForOutreach(id)
      return NextResponse.json({ success: true, data: result, triggeredBy: user.uid })
    }

    if (action === 'run_matching' || action === 'backtest') {
      const result = await matching.runMatchingForClassified({
        limit: Number(body.limit) || 100,
        minScore: Number(body.minScore) || 0.45,
        includeTestSmes: body.includeTestSmes === true,
        includeLikely: body.includeLikely === true,
        persist: body.persist !== false,
      })
      return NextResponse.json({ success: true, data: result, triggeredBy: user.uid })
    }

    if (action === 'audit') {
      return NextResponse.json({
        success: true,
        data: await matching.auditHistoricalPaid(),
        triggeredBy: user.uid,
      })
    }

    if (action === 'send' || action === 'notify') {
      const id = String(body.id || '')
      if (!id) return NextResponse.json({ success: false, error: 'id required' }, { status: 400 })
      const outreach = require('../../../../backend/services/smeConnectOutreachService') as {
        sendApprovedOutreach: (
          id: string,
          opts?: Record<string, unknown>
        ) => Promise<unknown>
      }
      // Default: force test inbox unless explicitly allowing live customers
      const overrideRecipient =
        body.overrideRecipient ||
        (body.allowLiveCustomers === true
          ? undefined
          : process.env.SME_CONNECT_CERT_INBOX || 'info@tenderbriefing.co.za')
      const result = await outreach.sendApprovedOutreach(id, {
        overrideRecipient,
        allowLiveCustomers: body.allowLiveCustomers === true,
        actor: { uid: user.uid, email: user.email },
      })
      return NextResponse.json({ success: true, data: result, triggeredBy: user.uid })
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
