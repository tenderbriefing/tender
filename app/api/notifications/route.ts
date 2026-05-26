import { NextRequest, NextResponse } from 'next/server'
import { notificationService } from '@/lib/services/notificationService'
import { ensureRouteAccess, isAccessDenied } from '@/lib/auth/ensureRouteAccess'
import { forbiddenResponse } from '@/lib/auth/verifyApiUser'

export async function POST(request: NextRequest) {
  const access = await ensureRouteAccess(request)
  if (isAccessDenied(access)) return access

  try {
    const body = await request.json()
    const { action, ...data } = body

    switch (action) {
      case 'markAsRead':
        const { notificationId } = data
        
        if (!notificationId) {
          return NextResponse.json({
            success: false,
            error: 'Missing required field: notificationId'
          }, { status: 400 })
        }

        const result = await notificationService.markAsRead(notificationId)
        
        if (result) {
          return NextResponse.json({
            success: true,
            message: 'Notification marked as read'
          })
        } else {
          return NextResponse.json({
            success: false,
            error: 'Failed to mark notification as read'
          }, { status: 500 })
        }

      case 'markAllAsRead':
        const { userId } = data

        if (userId && userId !== access.uid && access.userType !== 'admin') {
          return forbiddenResponse()
        }
        
        if (!userId) {
          return NextResponse.json({
            success: false,
            error: 'Missing required field: userId'
          }, { status: 400 })
        }

        const markAllResult = await notificationService.markAllAsRead(userId)
        
        if (markAllResult) {
          return NextResponse.json({
            success: true,
            message: 'All notifications marked as read'
          })
        } else {
          return NextResponse.json({
            success: false,
            error: 'Failed to mark all notifications as read'
          }, { status: 500 })
        }

      case 'send':
        const { targetUserId, type, data: notificationData, customMessage } = data
        
        if (!targetUserId || !type) {
          return NextResponse.json({
            success: false,
            error: 'Missing required fields: targetUserId, type'
          }, { status: 400 })
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
            message: 'Notification sent successfully'
          })
        } else {
          return NextResponse.json({
            success: false,
            error: 'Failed to send notification'
          }, { status: 500 })
        }

      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action'
        }, { status: 400 })
    }

  } catch (error) {
    console.error('Notifications API error:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const limit = parseInt(searchParams.get('limit') || '50')
    const unreadOnly = searchParams.get('unreadOnly') === 'true'

    if (!userId) {
      return NextResponse.json({
        success: false,
        error: 'Missing required parameter: userId'
      }, { status: 400 })
    }

    const notifications = await notificationService.getUserNotifications(
      userId,
      limit,
      unreadOnly
    )

    const unreadCount = await notificationService.getUnreadCount(userId)

    return NextResponse.json({
      success: true,
      notifications,
      unreadCount
    })

  } catch (error) {
    console.error('Notifications API error:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}
