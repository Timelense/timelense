import { useMemo, useState, useEffect } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native'
import { useTheme, typography, spacing, radius, shadow, fonts, type Palette } from '../theme'
import { AuroraBackground } from '../components/AuroraBackground'
import { BrandLogo, BrandWordmark } from '../components/BrandHeader'
import { resetPassword } from '../api/auth'
import { ApiError } from '../api/client'
import type { RootStackScreenProps } from '../navigation/types'

export default function ResetPasswordScreen({ navigation, route }: RootStackScreenProps<'ResetPassword'>) {
  const { email, code: initialCode } = route.params
  const { colors } = useTheme()
  const styles = useMemo(() => makeStyles(colors), [colors])

  const [code, setCode] = useState(initialCode ?? '')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (initialCode) {
      setCode(initialCode)
    }
  }, [initialCode])

  const handleResetPassword = async () => {
    setError(null)
    if (!code.trim() || code.trim().length !== 6) {
      setError('Please enter the 6-digit verification code')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters long')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setLoading(true)
    try {
      await resetPassword(email, code.trim(), password)
      navigation.navigate('Login', {
        message: 'Your password has been reset successfully. Please sign in.',
      })
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 400 && err.message === 'invalid_or_expired_code') {
          setError('Invalid or expired verification code')
        } else {
          setError(err.message)
        }
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
        <Text style={styles.subtitle}>Reset your password for {email}</Text>

        {error && <Text style={styles.errorText}>{error}</Text>}

        <TextInput
          style={styles.input}
          placeholder="6-Digit Code"
          placeholderTextColor={colors.textMuted}
          value={code}
          onChangeText={setCode}
          autoCapitalize="none"
          keyboardType="number-pad"
          maxLength={6}
        />

        <TextInput
          style={styles.input}
          placeholder="New Password"
          placeholderTextColor={colors.textMuted}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="password-new"
        />

        <TextInput
          style={styles.input}
          placeholder="Confirm New Password"
          placeholderTextColor={colors.textMuted}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
          autoComplete="password-new"
        />

        <TouchableOpacity style={[styles.button, loading && styles.buttonDisabled]} onPress={handleResetPassword} disabled={loading}>
          {loading ? <ActivityIndicator color={colors.white} /> : <Text style={styles.buttonText}>Reset Password</Text>}
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
