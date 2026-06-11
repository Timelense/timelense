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
