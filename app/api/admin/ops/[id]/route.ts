import { NextRequest, NextResponse } from 'next/server'
import { verifyApiUser, unauthorizedResponse } from '@/lib/auth/verifyApiUser'

export const dynamic = 'force-dynamic'

function opsService() {
  return require('../../../../../backend/services/ops/opsLifecycleService')
}

export async function GET(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const user = await verifyApiUser(request.headers.get('authorization'), ['admin'])
  if (!user) return unauthorizedResponse('Admin sign-in required')
  const params = await props.params
  try {
    const ops = opsService()
    const doc = await ops.getRequest(params.id)
    if (!doc) {
      return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
    }
    return NextResponse.json({
      success: true,
      data: { row: ops.toOpsBoardRow(doc), request: doc },
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Load failed' },
      { status: 500 }
    )
  }
}

/**
 * Admin lifecycle actions.
 * Body: { action: 'assign' | 'attend' | 'evidence_override' | 'report_in_progress' |
 *   'report_ready' | 'mark_delivered' | 'close', ...fields }
 * NEVER sends client email on mark_delivered.
 */
export async function POST(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const user = await verifyApiUser(request.headers.get('authorization'), ['admin'])
  if (!user) return unauthorizedResponse('Admin sign-in required')
  const params = await props.params
  const adminUser = { uid: user.uid, email: user.email }

  try {
    const body = await request.json().catch(() => ({}))
    const action = String(body.action || '').trim()
    const ops = opsService()
    let result: unknown

    switch (action) {
      case 'assign':
        result = await ops.assignManualRepresentative(params.id, body, adminUser)
        break
      case 'attend':
        result = await ops.markAttended(params.id, body, adminUser)
        break
      case 'evidence_override':
        result = await ops.overrideEvidenceRequirement(params.id, body, adminUser)
        break
      case 'report_in_progress':
        result = await ops.setReportInProgress(params.id, adminUser)
        break
      case 'report_ready':
        result = await ops.markReportReady(params.id, body, adminUser)
        break
      case 'mark_delivered': {
        const delivered = await ops.markDelivered(params.id, body, adminUser)
        result = delivered
        break
      }
      case 'complete': {
        const closure = require('../../../../../backend/services/ops/fulfilmentClosureService')
        result = await closure.completeFulfilment(params.id, adminUser, body)
        break
      }
      case 'reopen': {
        const closure = require('../../../../../backend/services/ops/fulfilmentClosureService')
        result = await closure.reopenForCorrection(params.id, body, adminUser)
        break
      }
      case 'close':
        result = await ops.closeRequest(params.id, body, adminUser)
        break
      default:
        return NextResponse.json(
          { success: false, error: `Unknown action: ${action}` },
          { status: 400 }
        )
    }

    const requestDoc =
      result && typeof result === 'object' && 'request' in (result as object)
        ? (result as { request: unknown }).request
        : result

    return NextResponse.json({
      success: true,
      data: {
        action,
        emailSent:
          action === 'mark_delivered'
            ? false
            : (result as { emailSent?: boolean })?.emailSent ?? null,
        row: ops.toOpsBoardRow(requestDoc),
        result,
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Action failed',
      },
      { status: 400 }
    )
  }
}
