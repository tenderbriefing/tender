import React, { useEffect, useState } from 'react'
import { Alert, Linking, Text } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useAuth } from '../context/AuthContext'
import { registerForPushNotifications } from '../services/push'
import { getPendingCount } from '../offline/queue'
import { Button, Card, Input, Screen, Title } from '../components/ui'
import { colors } from '../theme/colors'

const PROFILE_KEY = 'tb_agent_profile_local'

export default function ProfileScreen() {
  const { user, signOut } = useAuth()
  const [whatsapp, setWhatsapp] = useState('')
  const [province, setProvince] = useState('')
  const [pending, setPending] = useState(0)
  const [pushToken, setPushToken] = useState<string | null>(null)

  useEffect(() => {
    AsyncStorage.getItem(PROFILE_KEY).then((raw) => {
      if (raw) {
        const p = JSON.parse(raw) as { whatsapp?: string; province?: string }
        setWhatsapp(p.whatsapp || '')
        setProvince(p.province || '')
      }
    })
    getPendingCount().then(setPending)
    registerForPushNotifications().then(setPushToken)
  }, [])

  const save = async () => {
    await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify({ whatsapp, province }))
    Alert.alert('Saved', 'Profile details stored on device')
  }

  return (
    <Screen>
      <Title>Profile</Title>
      <Card>
        <Text style={{ fontWeight: '700' }}>{user?.email}</Text>
        <Text style={{ color: colors.slate600, fontSize: 12, marginTop: 4 }}>
          Agent ID: {user?.uid?.slice(0, 16)}…
        </Text>
      </Card>
      <Card>
        <Text style={{ fontWeight: '600' }}>WhatsApp number</Text>
        <Input value={whatsapp} onChangeText={setWhatsapp} placeholder="+27…" keyboardType="phone-pad" />
        <Text style={{ fontWeight: '600', marginTop: 8 }}>Province</Text>
        <Input value={province} onChangeText={setProvince} placeholder="e.g. Gauteng" />
        <Button title="Save locally" variant="secondary" onPress={save} />
      </Card>
      {whatsapp ? (
        <Button
          title="Open WhatsApp support"
          variant="secondary"
          onPress={() =>
            Linking.openURL(`https://wa.me/${whatsapp.replace(/\D/g, '')}`)
          }
        />
      ) : null}
      <Card>
        <Text style={{ color: colors.slate600 }}>Offline queue: {pending}</Text>
        <Text style={{ color: colors.slate600, marginTop: 4 }}>
          Push: {pushToken ? 'registered' : 'not registered'}
        </Text>
      </Card>
      <Button title="Sign out" variant="danger" onPress={() => signOut()} />
    </Screen>
  )
}
