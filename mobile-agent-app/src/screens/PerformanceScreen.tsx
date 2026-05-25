import React, { useCallback, useState } from 'react'
import { Alert, RefreshControl, ScrollView, Text, View } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { mobileApi, PerformanceData } from '../api/client'
import { Badge, Card, Screen, Title } from '../components/ui'
import { colors } from '../theme/colors'

export default function PerformanceScreen() {
  const [data, setData] = useState<PerformanceData | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    setData(await mobileApi.performance())
  }, [])

  useFocusEffect(
    useCallback(() => {
      load().catch((e) => Alert.alert('Performance', e instanceof Error ? e.message : 'Failed'))
    }, [load])
  )

  const metrics = data
    ? [
        ['Attendance', `${data.attendancePct}%`],
        ['Report quality', `${data.reportQuality}%`],
        ['Reliability', `${data.reliabilityScore}%`],
        ['Score', String(data.performanceScore)],
        ['Missed', String(data.missedBriefings)],
        ['Fraud flags', String(data.fraudFlags)],
      ]
    : []

  return (
    <Screen style={{ paddingTop: 0 }}>
      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false) }} />}>
        <Title>Performance</Title>
        {data && (
          <>
            <Card>
              <View style={{ alignItems: 'center' }}>
                <Badge label={data.tier} tone="success" />
                <Text style={{ fontSize: 32, fontWeight: '900', marginTop: 8, color: colors.slate900 }}>
                  {data.tier}
                </Text>
              </View>
            </Card>
            {metrics.map(([label, value]) => (
              <Card key={label}>
                <Text style={{ color: colors.slate600 }}>{label}</Text>
                <Text style={{ fontSize: 22, fontWeight: '800' }}>{value}</Text>
              </Card>
            ))}
          </>
        )}
      </ScrollView>
    </Screen>
  )
}
