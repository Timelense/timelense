import { useEffect } from 'react'
import { Stack, useRouter, useSegments } from 'expo-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider, useAuth } from '../src/contexts/auth'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
})

function RootLayoutNav() {
  const { isLoaded, isSignedIn } = useAuth()
  const segments = useSegments()
  const router = useRouter()

  useEffect(() => {
    if (!isLoaded) return

    const inTabs = segments[0] === '(tabs)'
    if (!isSignedIn && inTabs) {
      router.replace('/login')
    } else if (isSignedIn && !inTabs) {
      router.replace('/(tabs)/timer')
    }
  }, [isLoaded, isSignedIn, segments])

  if (!isLoaded) return null

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
    </Stack>
  )
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RootLayoutNav />
      </AuthProvider>
    </QueryClientProvider>
  )
}
