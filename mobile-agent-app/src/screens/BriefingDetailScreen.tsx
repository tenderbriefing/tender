import React, { useEffect, useState } from 'react'
import { Alert, Linking, ScrollView, Text } from 'react-native'
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { mobileApi, BriefingDetail } from '../api/client'
import { Button, Card, Screen, Subtitle, Title } from '../components/ui'
import { colors } from '../theme/colors'
import type { RootStackParamList } from '../navigation/types'

export default function BriefingDetailScreen() {
  const { params } = useRoute<RouteProp<RootStackParamList, 'BriefingDetail'>>()
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const [data, setData] = useState<BriefingDetail | null>(null)

  useEffect(() => {
    mobileApi
      .briefing(params.requestId)
      .then(setData)
      .catch((e) => Alert.alert('Briefing', e instanceof Error ? e.message : 'Load failed'))
  }, [params.requestId])

  const req = data?.request || {}
  const tender = data?.tender || {}
  const lat = data?.coordinates?.lat
  const lng = data?.coordinates?.lng
  const navUrl =
    lat != null && lng != null
      ? `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
          String(req.briefingVenue || tender.briefingVenue || '')
        )}`

  return (
    <Screen style={{ paddingTop: 0 }}>
      <ScrollView>
        <Title>{String(req.tenderNumber || 'Briefing')}</Title>
        <Subtitle>{String(tender.title || req.tenderTitle || '')}</Subtitle>
        <Card>
          <Text style={{ fontWeight: '600' }}>Venue</Text>
          <Text style={{ color: colors.slate600 }}>{String(req.briefingVenue || '—')}</Text>
          <Text style={{ marginTop: 8, fontWeight: '600' }}>Department</Text>
          <Text style={{ color: colors.slate600 }}>{String(tender.department || req.department || '—')}</Text>
          <Text style={{ marginTop: 8, fontWeight: '600' }}>Date / time</Text>
          <Text style={{ color: colors.slate600 }}>
            {String(req.briefingDate || '')} {String(req.briefingTime || '')}
          </Text>
          <Text style={{ marginTop: 12, fontSize: 20, fontWeight: '800', color: colors.brand }}>
            R{((Number(req.paymentAmount) || 24900) / 100).toFixed(2)}
          </Text>
        </Card>
        {data?.aiSummary?.summary && (
          <Card>
            <Text style={{ fontWeight: '800', marginBottom: 6 }}>AI tender summary</Text>
            <Text style={{ color: colors.slate600, lineHeight: 20 }}>{data.aiSummary.summary}</Text>
          </Card>
        )}
        <Button title="Navigate to venue" onPress={() => Linking.openURL(navUrl)} />
        <Button
          title="GPS check-in / out"
          variant="secondary"
          onPress={() =>
            navigation.navigate('CheckIn', {
              requestId: params.requestId,
              venueLat: lat,
              venueLng: lng,
            })
          }
        />
        <Button
          title="Upload report"
          onPress={() =>
            navigation.navigate('ReportUpload', {
              requestId: params.requestId,
              tenderId: String(req.tenderId || tender.id || ''),
            })
          }
        />
      </ScrollView>
    </Screen>
  )
}
