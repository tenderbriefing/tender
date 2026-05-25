import React, { useState } from 'react'
import { Alert, Text } from 'react-native'
import { RouteProp, useRoute } from '@react-navigation/native'
import { mobileApi } from '../api/client'
import { enqueueOffline, flushOfflineQueue } from '../offline/queue'
import { getCurrentGps, distanceKm } from '../services/location'
import { Button, Card, Screen, Title } from '../components/ui'
import { colors } from '../theme/colors'
import type { RootStackParamList } from '../navigation/types'

export default function CheckInScreen() {
  const { params } = useRoute<RouteProp<RootStackParamList, 'CheckIn'>>()
  const [loading, setLoading] = useState<'in' | 'out' | null>(null)
  const [gps, setGps] = useState<{
    lat: number
    lng: number
    accuracy: number | null
    distanceKm?: number
    geofenceOk?: boolean
  } | null>(null)

  const run = async (eventType: 'check_in' | 'check_out') => {
    setLoading(eventType === 'check_in' ? 'in' : 'out')
    try {
      const pos = await getCurrentGps()
      const payload: Record<string, unknown> = {
        requestId: params.requestId,
        latitude: pos.latitude,
        longitude: pos.longitude,
        accuracy: pos.accuracy,
        siteLatitude: params.venueLat,
        siteLongitude: params.venueLng,
        deviceTimestamp: new Date().toISOString(),
      }
      const dist =
        params.venueLat != null && params.venueLng != null
          ? distanceKm(pos.latitude, pos.longitude, params.venueLat, params.venueLng)
          : undefined

      try {
        const result =
          eventType === 'check_in'
            ? await mobileApi.checkIn(payload)
            : await mobileApi.checkOut(payload)
        const resultDist =
          'distanceKm' in result && result.distanceKm != null ? result.distanceKm : undefined
        setGps({
          lat: pos.latitude,
          lng: pos.longitude,
          accuracy: pos.accuracy,
          distanceKm: dist ?? resultDist,
          geofenceOk: result.withinGeofence,
        })
        if (result.withinGeofence === false) {
          Alert.alert('Geofence', 'You may be outside the briefing venue radius.')
        } else {
          Alert.alert('Success', eventType === 'check_in' ? 'Checked in' : 'Checked out')
        }
      } catch (netErr) {
        await enqueueOffline({
          itemType: eventType,
          payload,
        })
        setGps({
          lat: pos.latitude,
          lng: pos.longitude,
          accuracy: pos.accuracy,
          distanceKm: dist,
        })
        Alert.alert('Queued offline', 'Will sync when connection returns.')
      }
      await flushOfflineQueue()
    } catch (e) {
      Alert.alert('GPS', e instanceof Error ? e.message : 'Failed')
    } finally {
      setLoading(null)
    }
  }

  return (
    <Screen>
      <Title>GPS attendance</Title>
      <Card>
        <Text style={{ color: colors.slate600 }}>Request: {params.requestId}</Text>
        {gps && (
          <>
            <Text style={{ marginTop: 8 }}>Accuracy: {gps.accuracy != null ? `${Math.round(gps.accuracy)} m` : '—'}</Text>
            {gps.distanceKm != null && <Text>Distance to venue: {gps.distanceKm.toFixed(2)} km</Text>}
            <Text>
              Geofence:{' '}
              {gps.geofenceOk === undefined ? '—' : gps.geofenceOk ? 'Inside' : 'Outside'}
            </Text>
          </>
        )}
      </Card>
      <Button title="Check in" onPress={() => run('check_in')} loading={loading === 'in'} />
      <Button title="Check out" variant="secondary" onPress={() => run('check_out')} loading={loading === 'out'} />
    </Screen>
  )
}
