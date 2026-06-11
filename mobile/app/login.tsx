import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native'
import { Link } from 'expo-router'
import { colors, typography, spacing, radius } from '../src/theme'
import { login } from '../src/api/auth'
import { useAuth } from '../src/contexts/auth'
import { ApiError } from '../src/api/client'

export default function LoginScreen() {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleLogin = async () => {
    setError(null)
    if (!email.trim()) { setError('Email is required'); return }
    if (!password) { setError('Password is required'); return }

    setLoading(true)
    try {
      await login(email.trim(), password)
      signIn()
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError('Invalid email or password')
      } else {
        setError('Something went wrong. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.inner}>
        <Text style={styles.title}>TimeLens</Text>
        <Text style={styles.subtitle}>Sign in to continue</Text>

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
          placeholder="Password"
          placeholderTextColor={colors.textMuted}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="password"
        />

        <TouchableOpacity style={[styles.button, loading && styles.buttonDisabled]} onPress={handleLogin} disabled={loading}>
          {loading ? <ActivityIndicator color={colors.white} /> : <Text style={styles.buttonText}>Sign In</Text>}
        </TouchableOpacity>

        <Link href="/register" style={styles.link}>
          Don't have an account? Register
        </Link>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  inner: { flex: 1, justifyContent: 'center', padding: spacing.xl },
  title: { fontSize: typography.size.xxxl, fontWeight: typography.weight.bold, color: colors.primary, textAlign: 'center', marginBottom: spacing.xs },
  subtitle: { fontSize: typography.size.md, color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.xl },
  errorText: { color: colors.danger, fontSize: typography.size.sm, marginBottom: spacing.md, textAlign: 'center' },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: typography.size.md,
    color: colors.text,
    marginBottom: spacing.md,
  },
  button: {
    backgroundColor: colors.primary,
    padding: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: colors.white, fontWeight: typography.weight.semibold, fontSize: typography.size.md },
  link: { color: colors.primary, textAlign: 'center', fontSize: typography.size.sm },
})
