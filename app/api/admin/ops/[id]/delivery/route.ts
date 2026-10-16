import { NextRequest, NextResponse } from 'next/server'
import { verifyApiUser, unauthorizedResponse } from '@/lib/auth/verifyApiUser'

export const dynamic = 'force-dynamic'

function deliveryService() {
  return require('../../../../../../backend/services/ops/reportClientDeliveryService')
}

function opsService() {
  return require('../../../../../../backend/services/ops/opsLifecycleService')
}

/** GET delivery review + history (admin only). */
export async function GET(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const user = await verifyApiUser(request.headers.get('authorization'), ['admin'])
  if (!user) return unauthorizedResponse('Admin sign-in required')
  const params = await props.params
  try {
    const delivery = deliveryService()
    const ops = opsService()
    const doc = await ops.getRequest(params.id)
    if (!doc) {
      return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
    }
    const history = await delivery.listDeliveries(params.id)
    const activeId =
      request.nextUrl.searchParams.get('deliveryId') ||
      doc.clientDeliveryId ||
      history[0]?.id ||
      null
    const active = activeId ? await delivery.getDelivery(activeId) : null
    return NextResponse.json({
      success: true,
      data: {
        row: ops.toOpsBoardRow(doc),
        delivery: delivery.publicDeliveryView(active),
        history: history.map((h: unknown) => delivery.publicDeliveryView(h)),
      },
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Load failed' },
      { status: 400 }
    )
  }
}

/**
 * POST actions:
 * open | update | confirm_send | retry | resend
 * confirm_send requires confirm: true — never auto-sends.
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
    const delivery = deliveryService()
    const ops = opsService()
    let result: any

    switch (action) {
      case 'open':
        result = await delivery.openDeliveryReview(params.id, adminUser, {
          forceNew: body.forceNew === true,
          resend: body.resend === true,
        })
        break
      case 'update':
        result = await delivery.updateDeliveryDraft(
          params.id,
          String(body.deliveryId || ''),
          body.patch || body,
          adminUser
        )
        break
      case 'confirm_send':
        result = await delivery.confirmAndSend(
          params.id,
          String(body.deliveryId || ''),
          { confirm: body.confirm === true },
          adminUser
        )
        break
      case 'retry':
        result = await delivery.retryDelivery(
          params.id,
          String(body.deliveryId || ''),
          { newAttempt: body.newAttempt === true },
          adminUser
        )
        break
      case 'resend':
        result = await delivery.resendReport(params.id, adminUser)
        break
      default:
        return NextResponse.json(
          { success: false, error: `Unknown action: ${action}` },
          { status: 400 }
        )
    }

    return NextResponse.json({
      success: true,
      data: {
        action,
        emailSent: result.emailSent ?? false,
        duplicate: result.duplicate === true,
        alreadySent: result.alreadySent === true,
        row: ops.toOpsBoardRow(result.request),
        delivery: delivery.publicDeliveryView(result.delivery),
        providerMessageId: result.providerMessageId || null,
        error: result.error || null,
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Delivery action failed',
      },
      { status: 400 }
    )
  }
}
