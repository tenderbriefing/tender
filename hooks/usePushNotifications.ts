'use client'

import { useState, useEffect, useCallback } from 'react'
import { pushNotificationService } from '@/lib/services/pushNotificationService'

export interface PushNotificationState {
  isSupported: boolean
  permission: NotificationPermission
  token: string | null
  isSubscribed: boolean
}

export function usePushNotifications() {
  const [state, setState] = useState<PushNotificationState>({
    isSupported: false,
    permission: 'default',
    token: null,
    isSubscribed: false,
  })

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Check if push notifications are supported
  useEffect(() => {
    const isSupported = 'Notification' in window && 'serviceWorker' in navigator
    const permission = isSupported ? Notification.permission : 'denied'
    
    setState(prev => ({
      ...prev,
      isSupported,
      permission,
    }))
  }, [])

  // Request permission and get token
  const requestPermission = useCallback(async () => {
    if (!state.isSupported) {
      setError('Push notifications are not supported in this browser')
      return false
    }

    setIsLoading(true)
    setError(null)

    try {
      const granted = await pushNotificationService.requestPermission()
      
      if (granted) {
        const token = await pushNotificationService.getToken()
        
        setState(prev => ({
          ...prev,
          permission: 'granted',
          token,
        }))

        // Subscribe to general notifications
        if (token) {
          await pushNotificationService.subscribeToTopic(token, 'general')
          setState(prev => ({ ...prev, isSubscribed: true }))
        }

        return true
      } else {
        setState(prev => ({ ...prev, permission: 'denied' }))
        setError('Notification permission denied')
        return false
      }
    } catch (err) {
      setError('Failed to request notification permission')
      return false
    } finally {
      setIsLoading(false)
    }
  }, [state.isSupported])

  // Subscribe to specific topic
  const subscribeToTopic = useCallback(async (topic: string) => {
    if (!state.token) {
      setError('No FCM token available')
      return false
    }

    setIsLoading(true)
    setError(null)

    try {
      const success = await pushNotificationService.subscribeToTopic(state.token, topic)
      if (success) {
        setState(prev => ({ ...prev, isSubscribed: true }))
      }
      return success
    } catch (err) {
      setError('Failed to subscribe to topic')
      return false
    } finally {
      setIsLoading(false)
    }
  }, [state.token])

  // Unsubscribe from topic
  const unsubscribeFromTopic = useCallback(async (topic: string) => {
    if (!state.token) {
      setError('No FCM token available')
      return false
    }

    setIsLoading(true)
    setError(null)

    try {
      const success = await pushNotificationService.unsubscribeFromTopic(state.token, topic)
      return success
    } catch (err) {
      setError('Failed to unsubscribe from topic')
      return false
    } finally {
      setIsLoading(false)
    }
  }, [state.token])

  // Send test notification
  const sendTestNotification = useCallback(async () => {
    if (!state.token) {
      setError('No FCM token available')
      return false
    }

    setIsLoading(true)
    setError(null)

    try {
      const success = await pushNotificationService.sendToUser({
        userId: 'current-user',
        payload: {
          title: 'Test Notification',
          body: 'This is a test notification from TenderConnect',
          data: {
            url: '/dashboard',
          },
        },
      })
      return success
    } catch (err) {
      setError('Failed to send test notification')
      return false
    } finally {
      setIsLoading(false)
    }
  }, [state.token])

  return {
    ...state,
    isLoading,
    error,
    requestPermission,
    subscribeToTopic,
    unsubscribeFromTopic,
    sendTestNotification,
  }
}
