import React from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  ViewStyle,
} from 'react-native'
import { colors } from '../theme/colors'

export function Screen({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.screen, style]}>{children}</View>
}

export function Title({ children }: { children: string }) {
  return <Text style={styles.title}>{children}</Text>
}

export function Subtitle({ children }: { children: string }) {
  return <Text style={styles.subtitle}>{children}</Text>
}

export function Card({ children }: { children: React.ReactNode }) {
  return <View style={styles.card}>{children}</View>
}

export function Badge({
  label,
  tone = 'default',
}: {
  label: string
  tone?: 'default' | 'urgent' | 'success'
}) {
  const bg =
    tone === 'urgent' ? '#fee2e2' : tone === 'success' ? colors.brandLight : colors.slate100
  const fg = tone === 'urgent' ? colors.red : tone === 'success' ? colors.brandDark : colors.slate600
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.badgeText, { color: fg }]}>{label}</Text>
    </View>
  )
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled,
  loading,
}: {
  title: string
  onPress: () => void
  variant?: 'primary' | 'secondary' | 'danger'
  disabled?: boolean
  loading?: boolean
}) {
  const bg =
    variant === 'primary' ? colors.brand : variant === 'danger' ? colors.red : colors.white
  const fg = variant === 'secondary' ? colors.brand : colors.white
  const border = variant === 'secondary' ? styles.btnSecondary : undefined
  return (
    <TouchableOpacity
      style={[styles.btn, { backgroundColor: bg }, border, (disabled || loading) && styles.btnDisabled]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.85}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <Text style={[styles.btnText, { color: fg }]}>{title}</Text>
      )}
    </TouchableOpacity>
  )
}

export function Input(props: React.ComponentProps<typeof TextInput>) {
  return <TextInput {...props} style={[styles.input, props.style]} placeholderTextColor="#94a3b8" />
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.slate50, padding: 16 },
  title: { fontSize: 22, fontWeight: '800', color: colors.slate900 },
  subtitle: { fontSize: 14, color: colors.slate600, marginTop: 4 },
  card: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.slate100,
  },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  btn: {
    minHeight: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    marginTop: 8,
  },
  btnSecondary: { borderWidth: 2, borderColor: colors.brand },
  btnDisabled: { opacity: 0.55 },
  btnText: { fontSize: 16, fontWeight: '700' },
  input: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.slate100,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.slate900,
    marginTop: 8,
  },
})
