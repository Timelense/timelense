import { useMemo, useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native'
import { useTheme, typography, spacing, radius, shadow, fonts, type Palette } from '../theme'
import { AuroraBackground } from '../components/AuroraBackground'
import { BrandLogo, BrandWordmark } from '../components/BrandHeader'
import { register } from '../api/auth'
import { useAuth } from '../contexts/auth'
import { ApiError } from '../api/client'
import type { RootStackScreenProps } from '../navigation/types'

export default function RegisterScreen({ navigation }: RootStackScreenProps<'Register'>) {
  const { signIn } = useAuth()
  const { colors } = useTheme()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleRegister = async () => {
    setError(null)
    if (!email.trim()) { setError('Email is required'); return }
    if (!email.includes('@')) { setError('Enter a valid email'); return }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return }

    setLoading(true)
    try {
      await register(email.trim(), password)
      signIn()
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError('An account with this email already exists')
      } else {
        setError('Something went wrong. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <AuroraBackground />
      <View style={styles.inner}>
        <View style={styles.brand}>
          <BrandLogo size={64} />
          <BrandWordmark size={typography.size.xxl} />
        </View>
        <Text style={styles.subtitle}>Start catching your hours — create an account.</Text>

        {error && <Text style={styles.errorText}>{error}</Text>}

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor={colors.textMuted}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
        />
        <TextInput
          style={styles.input}
          placeholder="Password (min 8 characters)"
          placeholderTextColor={colors.textMuted}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="new-password"
        />

        <TouchableOpacity style={[styles.button, loading && styles.buttonDisabled]} onPress={handleRegister} disabled={loading}>
          {loading ? <ActivityIndicator color={colors.white} /> : <Text style={styles.buttonText}>Create Account</Text>}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.navigate('Login')}>
          <Text style={styles.link}>Already have an account? Sign in</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  )
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  inner: { flex: 1, justifyContent: 'center', padding: spacing.xl },
  brand: { alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  subtitle: { fontSize: typography.size.md, color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.xl, fontWeight: typography.weight.medium },
  errorText: { color: colors.danger, fontSize: typography.size.sm, marginBottom: spacing.md, textAlign: 'center', fontWeight: typography.weight.semibold },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    fontSize: typography.size.md,
    color: colors.text,
    marginBottom: spacing.md,
    fontWeight: typography.weight.medium,
  },
  button: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: radius.full,
    alignItems: 'center',
    marginBottom: spacing.md,
    ...shadow.button(colors.primary),
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: colors.white, fontFamily: fonts.bold, fontWeight: typography.weight.bold, fontSize: typography.size.lg },
  link: { color: colors.primary, textAlign: 'center', fontSize: typography.size.sm, fontFamily: fonts.semibold, fontWeight: typography.weight.semibold },
})
