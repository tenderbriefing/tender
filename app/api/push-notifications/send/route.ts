import { NextRequest, NextResponse } from 'next/server'
import { getMessaging } from 'firebase-admin/messaging'
import { initializeApp, getApps, cert } from 'firebase-admin/app'

// Initialize Firebase Admin if not already initialized
if (!getApps().length) {
  try {
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
    })
  } catch (error) {
    console.error('Error initializing Firebase Admin:', error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId, payload, topic, condition } = await request.json()

    if (!userId && !topic && !condition) {
      return NextResponse.json(
        { error: 'Either userId, topic, or condition must be provided' },
        { status: 400 }
      )
    }

    const messaging = getMessaging()

    let message: any = {
      notification: {
        title: payload.title,
        body: payload.body,
      },
      data: payload.data || {},
      webpush: {
        notification: {
          icon: payload.icon || '/icon-192x192.png',
          badge: payload.badge || '/icon-192x192.png',
          actions: payload.actions || [],
          requireInteraction: true,
        },
        fcmOptions: {
          link: payload.data?.url || '/',
        },
      },
    }

    // Set target
    if (userId) {
      // In a real implementation, you'd fetch the user's FCM token from database
      message.token = 'user-fcm-token-placeholder'
    } else if (topic) {
      message.topic = topic
    } else if (condition) {
      message.condition = condition
    }

    const response = await messaging.send(message)

    return NextResponse.json({
      success: true,
      messageId: response,
    })
  } catch (error) {
    console.error('Error sending push notification:', error)
    return NextResponse.json(
      { error: 'Failed to send push notification' },
      { status: 500 }
    )
  }
}
