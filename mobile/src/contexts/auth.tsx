import React, { createContext, useContext, useEffect, useState } from 'react'
import { getToken, clearToken } from '../api/client'
import { onUnauthorized } from '../api/authEvents'

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
    getToken()
      .then((t) => setIsSignedIn(!!t))
      .catch((e) => {
        console.warn('Failed to read auth token from keychain:', e)
        setIsSignedIn(false)
      })
      .finally(() => setIsLoaded(true))
  }, [])

  // A 401 from the API layer clears the token and signs the user out, which
  // swaps the navigator back to the auth stack.
  useEffect(() => onUnauthorized(() => setIsSignedIn(false)), [])

  const signIn = () => setIsSignedIn(true)

  const signOut = async () => {
    await clearToken()
    try {
      const { resetDatabase } = require('../db/database')
      const { clearCheckpoint } = require('../db/healthCheck')
      resetDatabase()
      await clearCheckpoint()
    } catch (e) {
      console.warn('Failed to clear database on sign out:', e)
    }
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
