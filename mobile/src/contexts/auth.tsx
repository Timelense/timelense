import React, { createContext, useContext, useEffect, useState } from 'react'
import { getToken, clearToken } from '../api/client'

interface AuthState {
  isLoaded: boolean
  isSignedIn: boolean
  signIn: () => void
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isLoaded, setIsLoaded] = useState(false)
  const [isSignedIn, setIsSignedIn] = useState(false)

  useEffect(() => {
    getToken().then((t) => {
      setIsSignedIn(!!t)
      setIsLoaded(true)
    })
  }, [])

  const signIn = () => setIsSignedIn(true)

  const signOut = async () => {
    await clearToken()
    setIsSignedIn(false)
  }

  return (
    <AuthContext.Provider value={{ isLoaded, isSignedIn, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
