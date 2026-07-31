import { NextRequest, NextResponse } from 'next/server'
import { notificationService } from '@/lib/services/notificationService'
import { ensureRouteAccess, isAccessDenied } from '@/lib/auth/ensureRouteAccess'
import { requireAdmin, isGuardResponse } from '@/lib/auth/apiGuards'
import { getFirebaseAdmin } from '@/lib/backend/firebaseAdmin'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, ...data } = body

    switch (action) {
      case 'markAsRead': {
        const access = await ensureRouteAccess(request)
        if (isAccessDenied(access)) return access

        const { notificationId } = data

        if (!notificationId || typeof notificationId !== 'string') {
          return NextResponse.json(
            {
              success: false,
              error: 'Missing required field: notificationId',
            },
            { status: 400 }
          )
        }

        const admin = getFirebaseAdmin()
        const snap = await admin.firestore().collection('notifications').doc(notificationId).get()
        if (!snap.exists) {
          return NextResponse.json(
            { success: false, error: 'Notification not found' },
            { status: 404 }
          )
        }

        const ownerId = snap.data()?.userId
        if (ownerId !== access.uid && access.userType !== 'admin') {
          return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
        }

        await snap.ref.update({ read: true })
        return NextResponse.json({
          success: true,
          message: 'Notification marked as read',
        })
      }

      case 'markAllAsRead': {
        const access = await ensureRouteAccess(request)
        if (isAccessDenied(access)) return access

        // Force caller identity — never trust client userId (IDOR).
        const markAllResult = await notificationService.markAllAsRead(access.uid)

        if (markAllResult) {
          return NextResponse.json({
            success: true,
            message: 'All notifications marked as read',
          })
        }
        return NextResponse.json(
          {
            success: false,
            error: 'Failed to mark all notifications as read',
          },
          { status: 500 }
        )
      }

      case 'send': {
        // Admin-only — never allow authenticated users to send to arbitrary targetUserId.
        const guard = await requireAdmin(request)
        if (isGuardResponse(guard)) return guard

        const { targetUserId, type, data: notificationData, customMessage } = data

        if (!targetUserId || !type) {
          return NextResponse.json(
            {
              success: false,
              error: 'Missing required fields: targetUserId, type',
            },
            { status: 400 }
          )
        }

        const sendResult = await notificationService.sendNotification(
          targetUserId,
          type,
          notificationData,
          customMessage
        )

        if (sendResult) {
          return NextResponse.json({
            success: true,
            message: 'Notification sent successfully',
          })
        }
        return NextResponse.json(
          {
            success: false,
            error: 'Failed to send notification',
          },
          { status: 500 }
        )
      }

      default:
        return NextResponse.json(
          {
            success: false,
            error: 'Invalid action',
          },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('Notifications API error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  const access = await ensureRouteAccess(request)
  if (isAccessDenied(access)) return access

  try {
    const { searchParams } = new URL(request.url)
    // Force caller identity — ignore client userId query (IDOR).
    const userId = access.uid
    const limit = parseInt(searchParams.get('limit') || '50', 10)
    const unreadOnly = searchParams.get('unreadOnly') === 'true'

    const notifications = await notificationService.getUserNotifications(
      userId,
      limit,
      unreadOnly
    )

    const unreadCount = await notificationService.getUnreadCount(userId)

    return NextResponse.json({
      success: true,
      notifications,
      unreadCount,
    })
  } catch (error) {
    console.error('Notifications API error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    )
  }
}
