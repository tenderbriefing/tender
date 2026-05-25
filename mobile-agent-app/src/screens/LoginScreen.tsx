import React, { useState } from 'react'
import { Alert, KeyboardAvoidingView, Platform, Text } from 'react-native'
import { useAuth } from '../context/AuthContext'
import { isFirebaseConfigured } from '../config/firebase'
import { Button, Input, Screen, Title, Subtitle } from '../components/ui'
import { colors } from '../theme/colors'

export default function LoginScreen() {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const onSubmit = async () => {
    if (!isFirebaseConfigured()) {
      Alert.alert('Setup required', 'Copy .env.example to .env and add Firebase public keys.')
      return
    }
    setLoading(true)
    try {
      await signIn(email, password)
    } catch (e) {
      Alert.alert('Sign-in failed', e instanceof Error ? e.message : 'Try again')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Screen style={{ justifyContent: 'center' }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Text style={{ color: colors.brand, fontWeight: '800', fontSize: 12, letterSpacing: 1 }}>
          TENDERBRIEFING
        </Text>
        <Title>TenderBriefing Agent</Title>
        <Subtitle>Field operations — dispatch, GPS, reports, earnings</Subtitle>
        <Input
          placeholder="Email"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <Input
          placeholder="Password"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />
        <Button title="Sign in" onPress={onSubmit} loading={loading} />
      </KeyboardAvoidingView>
    </Screen>
  )
}
