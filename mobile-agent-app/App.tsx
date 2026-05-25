import React, { useEffect } from 'react'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { AuthProvider } from './src/context/AuthContext'
import RootNavigator from './src/navigation/RootNavigator'
import { flushOfflineQueue } from './src/offline/queue'
import { registerForPushNotifications } from './src/services/push'

export default function App() {
  useEffect(() => {
    flushOfflineQueue().catch(() => undefined)
    registerForPushNotifications().catch(() => undefined)
  }, [])

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="light" />
        <RootNavigator />
      </AuthProvider>
    </SafeAreaProvider>
  )
}
