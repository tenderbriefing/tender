import { NextRequest, NextResponse } from 'next/server'
import { backend } from '@/lib/backend/loadServices'
import {
  verifyApiUser,
  unauthorizedResponse,
} from '@/lib/auth/verifyApiUser'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const user = await verifyApiUser(request.headers.get('authorization'))
    if (!user) return unauthorizedResponse()

    const storage = backend.getStorage()
    const { searchParams } = new URL(request.url)
    const limit = Math.min(Number(searchParams.get('limit') || 30), 100)

    const items =
      (await storage.getNotifications?.({
        userId: user.uid,
        limit,
      })) || []

    const unreadCount = items.filter((n) => !(n as { read?: boolean }).read).length

    return NextResponse.json({
      success: true,
      data: items,
      unreadCount,
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to load notifications',
      },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await verifyApiUser(request.headers.get('authorization'))
    if (!user) return unauthorizedResponse()

    const body = await request.json()
    const storage = backend.getStorage()

    if (body.markAllRead) {
      await storage.markAllNotificationsRead?.(user.uid)
      return NextResponse.json({ success: true })
    }

    if (body.notificationId) {
      await storage.markNotificationRead?.(body.notificationId)
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ success: false, error: 'Invalid payload' }, { status: 400 })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update notification',
      },
      { status: 500 }
    )
  }
}
