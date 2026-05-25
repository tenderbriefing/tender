import React, { useState } from 'react'
import { Alert, ScrollView, Text } from 'react-native'
import { RouteProp, useRoute } from '@react-navigation/native'
import * as ImagePicker from 'expo-image-picker'
import { Audio } from 'expo-av'
import { mobileApi } from '../api/client'
import { enqueueOffline } from '../offline/queue'
import { Button, Card, Input, Screen, Title } from '../components/ui'
import { colors } from '../theme/colors'
import type { RootStackParamList } from '../navigation/types'

export default function ReportUploadScreen() {
  const { params } = useRoute<RouteProp<RootStackParamList, 'ReportUpload'>>()
  const [summary, setSummary] = useState('')
  const [notes, setNotes] = useState('')
  const [photoUrls, setPhotoUrls] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [recording, setRecording] = useState<Audio.Recording | null>(null)

  const pickPhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync()
    if (!perm.granted) {
      Alert.alert('Camera', 'Permission required')
      return
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.7 })
    if (result.canceled || !result.assets[0]) return
    await uploadMedia(result.assets[0].uri, 'venue')
  }

  const uploadMedia = async (uri: string, mediaType: string) => {
    const form = new FormData()
    form.append('requestId', params.requestId)
    form.append('mediaType', mediaType)
    form.append('file', {
      uri,
      name: `${mediaType}-${Date.now()}.jpg`,
      type: 'image/jpeg',
    } as unknown as Blob)
    try {
      const res = await mobileApi.media(form)
      if (res && typeof res === 'object' && 'url' in res) {
        setPhotoUrls((p) => [...p, String((res as { url: string }).url)])
      }
    } catch {
      await enqueueOffline({
        itemType: 'upload',
        payload: { requestId: params.requestId, uri, mediaType },
      })
      Alert.alert('Queued', 'Photo queued for sync')
    }
  }

  const startVoice = async () => {
    const perm = await Audio.requestPermissionsAsync()
    if (!perm.granted) return
    await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true })
    const rec = new Audio.Recording()
    await rec.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY)
    await rec.startAsync()
    setRecording(rec)
  }

  const stopVoice = async () => {
    if (!recording) return
    await recording.stopAndUnloadAsync()
    const uri = recording.getURI()
    setRecording(null)
    if (!uri) return
    const form = new FormData()
    form.append('requestId', params.requestId)
    form.append('mediaType', 'voice')
    form.append('file', {
      uri,
      name: `voice-${Date.now()}.m4a`,
      type: 'audio/m4a',
    } as unknown as Blob)
    try {
      const res = await mobileApi.media(form)
      if (res && typeof res === 'object' && 'url' in res) {
        setPhotoUrls((p) => [...p, String((res as { url: string }).url)])
      }
    } catch {
      await enqueueOffline({ itemType: 'upload', payload: { requestId: params.requestId, uri } })
    }
  }

  const submit = async () => {
    if (!summary.trim()) {
      Alert.alert('Report', 'Summary is required')
      return
    }
    setLoading(true)
    try {
      await mobileApi.submitReport({
        requestId: params.requestId,
        tenderId: params.tenderId,
        summary: summary.trim(),
        notes: notes.trim(),
        photoUrls,
        attendanceConfirmed: true,
      })
      Alert.alert('Submitted', 'Briefing report sent')
      setSummary('')
      setNotes('')
    } catch (e) {
      await enqueueOffline({
        itemType: 'report',
        payload: {
          requestId: params.requestId,
          tenderId: params.tenderId,
          summary,
          notes,
          photoUrls,
        },
      })
      Alert.alert('Queued offline', e instanceof Error ? e.message : 'Saved for sync')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Screen style={{ paddingTop: 0 }}>
      <ScrollView>
        <Title>Upload report</Title>
        <Card>
          <Text style={{ fontWeight: '600', marginBottom: 4 }}>Summary *</Text>
          <Input multiline numberOfLines={4} value={summary} onChangeText={setSummary} placeholder="Briefing summary" />
          <Text style={{ fontWeight: '600', marginTop: 12 }}>Notes</Text>
          <Input multiline value={notes} onChangeText={setNotes} placeholder="Additional notes" />
        </Card>
        <Button title="Take photo" variant="secondary" onPress={pickPhoto} />
        <Button
          title={recording ? 'Stop voice note' : 'Record voice note'}
          variant="secondary"
          onPress={recording ? stopVoice : startVoice}
        />
        {photoUrls.length > 0 && (
          <Text style={{ color: colors.slate600, marginVertical: 8 }}>
            {photoUrls.length} file(s) attached
          </Text>
        )}
        <Button title="Submit report" onPress={submit} loading={loading} />
      </ScrollView>
    </Screen>
  )
}
