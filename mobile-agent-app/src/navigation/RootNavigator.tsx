import React from 'react'
import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { ActivityIndicator, View } from 'react-native'
import { useAuth } from '../context/AuthContext'
import { colors } from '../theme/colors'
import type { MainTabParamList, RootStackParamList } from './types'
import LoginScreen from '../screens/LoginScreen'
import DispatchScreen from '../screens/DispatchScreen'
import BriefingDetailScreen from '../screens/BriefingDetailScreen'
import CheckInScreen from '../screens/CheckInScreen'
import ReportUploadScreen from '../screens/ReportUploadScreen'
import EarningsScreen from '../screens/EarningsScreen'
import PerformanceScreen from '../screens/PerformanceScreen'
import ProfileScreen from '../screens/ProfileScreen'

const Stack = createNativeStackNavigator<RootStackParamList>()
const Tab = createBottomTabNavigator<MainTabParamList>()

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.brand },
        headerTintColor: colors.white,
        tabBarActiveTintColor: colors.brand,
        tabBarLabelStyle: { fontWeight: '600', fontSize: 11 },
      }}
    >
      <Tab.Screen name="Dispatch" component={DispatchScreen} options={{ title: 'Dispatch' }} />
      <Tab.Screen name="Earnings" component={EarningsScreen} />
      <Tab.Screen name="Performance" component={PerformanceScreen} options={{ title: 'Stats' }} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  )
}

export default function RootNavigator() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={colors.brand} />
      </View>
    )
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerTintColor: colors.brand }}>
        {user ? (
          <>
            <Stack.Screen
              name="MainTabs"
              component={MainTabs}
              options={{ headerShown: false }}
            />
            <Stack.Screen name="BriefingDetail" component={BriefingDetailScreen} options={{ title: 'Briefing' }} />
            <Stack.Screen name="CheckIn" component={CheckInScreen} options={{ title: 'GPS attendance' }} />
            <Stack.Screen name="ReportUpload" component={ReportUploadScreen} options={{ title: 'Upload report' }} />
          </>
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  )
}
