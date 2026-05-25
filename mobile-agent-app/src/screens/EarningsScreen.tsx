import React, { useCallback, useState } from 'react'
import { Alert, RefreshControl, ScrollView, Text } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { mobileApi, EarningsData } from '../api/client'
import { Card, Screen, Title } from '../components/ui'
import { colors } from '../theme/colors'

function zar(cents: number) {
  return `R${(cents / 100).toFixed(2)}`
}

export default function EarningsScreen() {
  const [data, setData] = useState<EarningsData | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    setData(await mobileApi.earnings())
  }, [])

  useFocusEffect(
    useCallback(() => {
      load().catch((e) => Alert.alert('Earnings', e instanceof Error ? e.message : 'Failed'))
    }, [load])
  )

  return (
    <Screen style={{ paddingTop: 0 }}>
      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false) }} />}>
        <Title>Earnings</Title>
        {data && (
          <>
            <Card>
              <Text style={{ color: colors.slate600 }}>Completed briefings</Text>
              <Text style={{ fontSize: 28, fontWeight: '800' }}>{data.completedBriefings}</Text>
            </Card>
            <Card>
              <Text style={{ color: colors.slate600 }}>Pending payout</Text>
              <Text style={{ fontSize: 22, fontWeight: '800', color: colors.amber }}>
                {zar(data.pendingPayoutCents)}
              </Text>
            </Card>
            <Card>
              <Text style={{ color: colors.slate600 }}>Paid total</Text>
              <Text style={{ fontSize: 22, fontWeight: '800', color: colors.brand }}>
                {zar(data.paidEarningsCents)}
              </Text>
            </Card>
            <Card>
              <Text style={{ color: colors.slate600 }}>This month</Text>
              <Text style={{ fontSize: 22, fontWeight: '800' }}>{zar(data.monthEarningsCents)}</Text>
            </Card>
            <Text style={{ fontWeight: '800', marginTop: 8, marginBottom: 8 }}>Payout history</Text>
            {(data.payouts || []).map((p) => (
              <Card key={p.id}>
                <Text style={{ fontWeight: '600', textTransform: 'capitalize' }}>{p.status}</Text>
                <Text style={{ color: colors.brand, fontWeight: '800' }}>{zar(p.amountCents || 0)}</Text>
              </Card>
            ))}
          </>
        )}
      </ScrollView>
    </Screen>
  )
}
