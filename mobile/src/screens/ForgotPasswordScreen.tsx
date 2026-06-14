import { useMemo, useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native'
import { useTheme, typography, spacing, radius, shadow, fonts, type Palette } from '../theme'
import { AuroraBackground } from '../components/AuroraBackground'
import { BrandLogo, BrandWordmark } from '../components/BrandHeader'
import { forgotPassword } from '../api/auth'
import { ApiError } from '../api/client'
import type { RootStackScreenProps } from '../navigation/types'

export default function ForgotPasswordScreen({ navigation }: RootStackScreenProps<'ForgotPassword'>) {
  const { colors } = useTheme()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSendCode = async () => {
    setError(null)
    if (!email.trim()) {
      setError('Email is required')
      return
    }

    setLoading(true)
    try {
      const res = await forgotPassword(email.trim())
      // In development/test mode, the backend returns the code in the response.
      // We pass it to the ResetPassword screen to auto-fill it for a friction-free dev flow.
      navigation.navigate('ResetPassword', {
        email: email.trim(),
        code: res.code,
      })
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message)
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
        <Text style={styles.subtitle}>Forgot your password? Enter your email and we'll send you a 6-digit verification code to reset it.</Text>

        {error && <Text style={styles.errorText}>{error}</Text>}

        <TextInput
          style={styles.input}
          placeholder="Email Address"
          placeholderTextColor={colors.textMuted}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
        />

        <TouchableOpacity style={[styles.button, loading && styles.buttonDisabled]} onPress={handleSendCode} disabled={loading}>
          {loading ? <ActivityIndicator color={colors.white} /> : <Text style={styles.buttonText}>Send Code</Text>}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.navigate('Login')}>
          <Text style={styles.link}>Back to Sign In</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  )
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  inner: { flex: 1, justifyContent: 'center', padding: spacing.xl },
  brand: { alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  subtitle: { fontSize: typography.size.md, color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.xl, fontWeight: typography.weight.medium, lineHeight: 22 },
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
  link: { color: colors.accent, textAlign: 'center', fontSize: typography.size.sm, fontFamily: fonts.semibold, fontWeight: typography.weight.semibold, marginTop: spacing.md },
})
