import React, { useCallback, useState } from 'react'
import { Alert, FlatList, RefreshControl, Text, TouchableOpacity, View } from 'react-native'
import { CompositeNavigationProp, useFocusEffect, useNavigation } from '@react-navigation/native'
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useAuth } from '../context/AuthContext'
import { mobileApi, DispatchItem } from '../api/client'
import { flushOfflineQueue, getPendingCount } from '../offline/queue'
import { Badge, Button, Card, Screen } from '../components/ui'
import { colors } from '../theme/colors'
import type { MainTabParamList, RootStackParamList } from '../navigation/types'

type DispatchNav = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Dispatch'>,
  NativeStackNavigationProp<RootStackParamList>
>

function JobCard({
  item,
  onOpen,
  onAccept,
  onDecline,
}: {
  item: DispatchItem
  onOpen: () => void
  onAccept: () => void
  onDecline: () => void
}) {
  return (
    <Card>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ fontWeight: '800', fontSize: 16, color: colors.slate900, flex: 1 }}>
          {item.tenderNumber || item.requestId}
        </Text>
        <Badge label={item.urgency === 'high' ? 'Urgent' : 'Open'} tone={item.urgency === 'high' ? 'urgent' : 'default'} />
      </View>
      <Text style={{ color: colors.slate600, marginTop: 4 }} numberOfLines={2}>
        {item.tenderTitle}
      </Text>
      <Text style={{ marginTop: 8, fontWeight: '700', color: colors.brand, fontSize: 18 }}>
        {item.payoutZar || 'R249.00'}
      </Text>
      <Text style={{ fontSize: 12, color: colors.slate600 }}>
        {item.province}
        {item.distanceKm != null ? ` · ${item.distanceKm} km` : ''}
        {item.etaMinutes != null ? ` · ETA ${item.etaMinutes}m` : ''}
      </Text>
      <Text style={{ fontSize: 12, color: colors.slate600, marginTop: 2 }}>
        {item.briefingDate} {item.briefingTime || ''}
      </Text>
      {item.canAccept && (
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
          <View style={{ flex: 1 }}>
            <Button title="Accept" onPress={onAccept} />
          </View>
          <View style={{ flex: 1 }}>
            <Button title="Decline" variant="secondary" onPress={onDecline} />
          </View>
        </View>
      )}
      <TouchableOpacity onPress={onOpen} style={{ marginTop: 8 }}>
        <Text style={{ color: colors.brand, fontWeight: '700', textAlign: 'center' }}>View briefing →</Text>
      </TouchableOpacity>
    </Card>
  )
}

export default function DispatchScreen() {
  const { user } = useAuth()
  const navigation = useNavigation<DispatchNav>()
  const [assignments, setAssignments] = useState<DispatchItem[]>([])
  const [opportunities, setOpportunities] = useState<DispatchItem[]>([])
  const [pending, setPending] = useState(0)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    const board = await mobileApi.dispatch()
    setAssignments(board.assignments || [])
    setOpportunities(board.opportunities || [])
    await flushOfflineQueue()
    setPending(await getPendingCount())
  }, [])

  useFocusEffect(
    useCallback(() => {
      load().catch((e) => Alert.alert('Dispatch', e instanceof Error ? e.message : 'Load failed'))
    }, [load])
  )

  const onRefresh = async () => {
    setRefreshing(true)
    try {
      await load()
    } catch (e) {
      Alert.alert('Dispatch', e instanceof Error ? e.message : 'Refresh failed')
    } finally {
      setRefreshing(false)
    }
  }

  const accept = async (requestId: string) => {
    if (!user) return
    try {
      await mobileApi.accept(user.uid, requestId)
      await load()
    } catch (e) {
      Alert.alert('Accept', e instanceof Error ? e.message : 'Failed')
    }
  }

  const decline = async (requestId: string) => {
    if (!user) return
    try {
      await mobileApi.decline(user.uid, requestId)
      await load()
    } catch (e) {
      Alert.alert('Decline', e instanceof Error ? e.message : 'Failed')
    }
  }

  const data = [
    { key: 'h1', type: 'header' as const, title: 'Active assignments' },
    ...assignments.map((i) => ({ key: i.requestId, type: 'job' as const, item: i, section: 'active' })),
    { key: 'h2', type: 'header' as const, title: 'Nearby / available' },
    ...opportunities.map((i) => ({ key: `o-${i.requestId}`, type: 'job' as const, item: i, section: 'opp' })),
  ]

  return (
    <Screen style={{ paddingTop: 0 }}>
      {pending > 0 && (
        <Text style={{ color: colors.amber, fontWeight: '600', marginBottom: 8 }}>
          {pending} item(s) waiting to sync
        </Text>
      )}
      <FlatList
        data={data}
        keyExtractor={(row) => row.key}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />}
        renderItem={({ item: row }) => {
          if (row.type === 'header') {
            return (
              <Text style={{ fontWeight: '800', color: colors.slate600, marginVertical: 8, fontSize: 12 }}>
                {row.title.toUpperCase()}
              </Text>
            )
          }
          const job = row.item
          return (
            <JobCard
              item={job}
              onOpen={() => navigation.navigate('BriefingDetail', { requestId: job.requestId })}
              onAccept={() => accept(job.requestId)}
              onDecline={() => decline(job.requestId)}
            />
          )
        }}
        ListEmptyComponent={
          <Text style={{ color: colors.slate600, textAlign: 'center', marginTop: 24 }}>No briefings loaded</Text>
        }
      />
    </Screen>
  )
}
