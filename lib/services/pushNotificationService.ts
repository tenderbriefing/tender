import { getMessaging, getToken, onMessage } from 'firebase/messaging'
import { initializeApp, getApps } from 'firebase/app'

import { getFirebaseConfig } from '../firebase-config'

// Initialize Firebase if not already initialized
if (!getApps().length) {
  initializeApp(getFirebaseConfig())
}

export interface PushNotificationPayload {
  title: string
  body: string
  icon?: string
  badge?: string
  data?: {
    [key: string]: string
  }
  actions?: Array<{
    action: string
    title: string
    icon?: string
  }>
}

export interface PushNotificationRequest {
  userId: string
  payload: PushNotificationPayload
  topic?: string
  condition?: string
}

class PushNotificationService {
  private messaging: any = null
  private vapidKey: string | null = null

  constructor() {
    if (typeof window !== 'undefined') {
      this.initializeMessaging()
    }
  }

  private async initializeMessaging() {
    try {
      this.messaging = getMessaging()
      this.vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY || null
    } catch (error) {
      console.error('Error initializing Firebase messaging:', error)
    }
  }

  /**
   * Request permission for push notifications
   */
  async requestPermission(): Promise<boolean> {
    if (!this.messaging) {
      console.error('Messaging not initialized')
      return false
    }

    try {
      const permission = await Notification.requestPermission()
      return permission === 'granted'
    } catch (error) {
      console.error('Error requesting notification permission:', error)
      return false
    }
  }

  /**
   * Get FCM token for the current user
   */
  async getToken(): Promise<string | null> {
    if (!this.messaging || !this.vapidKey) {
      console.error('Messaging or VAPID key not available')
      return null
    }

    try {
      const token = await getToken(this.messaging, {
        vapidKey: this.vapidKey
      })
      return token
    } catch (error) {
      console.error('Error getting FCM token:', error)
      return null
    }
  }

  /**
   * Subscribe to topic
   */
  async subscribeToTopic(token: string, topic: string): Promise<boolean> {
    try {
      const response = await fetch('/api/push-notifications/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token, topic }),
      })

      return response.ok
    } catch (error) {
      console.error('Error subscribing to topic:', error)
      return false
    }
  }

  /**
   * Unsubscribe from topic
   */
  async unsubscribeFromTopic(token: string, topic: string): Promise<boolean> {
    try {
      const response = await fetch('/api/push-notifications/unsubscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token, topic }),
      })

      return response.ok
    } catch (error) {
      console.error('Error unsubscribing from topic:', error)
      return false
    }
  }

  /**
   * Send push notification to specific user
   */
  async sendToUser(request: PushNotificationRequest): Promise<boolean> {
    try {
      const response = await fetch('/api/push-notifications/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      })

      return response.ok
    } catch (error) {
      console.error('Error sending push notification:', error)
      return false
    }
  }

  /**
   * Send push notification to topic
   */
  async sendToTopic(topic: string, payload: PushNotificationPayload): Promise<boolean> {
    try {
      const response = await fetch('/api/push-notifications/send-topic', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ topic, payload }),
      })

      return response.ok
    } catch (error) {
      console.error('Error sending topic notification:', error)
      return false
    }
  }

  /**
   * Set up message listener for foreground notifications
   */
  setupMessageListener(callback: (payload: any) => void) {
    if (!this.messaging) {
      console.error('Messaging not initialized')
      return
    }

    onMessage(this.messaging, (payload) => {
      console.log('Message received in foreground:', payload)
      callback(payload)
    })
  }

  /**
   * Show notification in browser
   */
  showNotification(payload: PushNotificationPayload) {
    if (!('Notification' in window)) {
      console.error('This browser does not support notifications')
      return
    }

    if (Notification.permission === 'granted') {
      const notificationOptions: NotificationOptions = {
        body: payload.body,
        icon: payload.icon || '/icon-192x192.png',
        badge: payload.badge || '/icon-192x192.png',
        data: payload.data,
        tag: 'tenderconnect-notification',
        requireInteraction: true,
      }

      const notification = new Notification(payload.title, notificationOptions)

      notification.onclick = () => {
        window.focus()
        notification.close()
        
        // Handle notification click
        if (payload.data?.url) {
          window.location.href = payload.data.url
        }
      }

      // Auto-close after 10 seconds
      setTimeout(() => {
        notification.close()
      }, 10000)
    }
  }
}

export const pushNotificationService = new PushNotificationService()
