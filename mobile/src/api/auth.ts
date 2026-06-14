import { apiRequest, setToken, clearToken } from './client'
import type { AuthResponse } from '@timelense/shared'

export async function register(email: string, password: string): Promise<AuthResponse> {
  const res = await apiRequest<AuthResponse>('/auth/register', 'POST', { email, password })
  await setToken(res.token)
  return res
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  const res = await apiRequest<AuthResponse>('/auth/login', 'POST', { email, password })
  await setToken(res.token)
  return res
}

export async function logout(): Promise<void> {
  await clearToken()
}

export async function forgotPassword(email: string): Promise<{ success: boolean; code?: string }> {
  return await apiRequest<{ success: boolean; code?: string }>('/auth/forgot-password', 'POST', { email })
}

export async function resetPassword(email: string, code: string, password: string): Promise<{ success: boolean }> {
  return await apiRequest<{ success: boolean }>('/auth/reset-password', 'POST', { email, code, password })
}
