import * as SecureStore from 'expo-secure-store'
import { router } from 'expo-router'

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000'
const TOKEN_KEY = 'auth_token'

export class ApiError extends Error {
  constructor(
    public status: number,
    public error: string,
  ) {
    super(error)
    this.name = 'ApiError'
  }
}

export async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY)
}

export async function setToken(token: string): Promise<void> {
  return SecureStore.setItemAsync(TOKEN_KEY, token)
}

export async function clearToken(): Promise<void> {
  return SecureStore.deleteItemAsync(TOKEN_KEY)
}

type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE'

export async function apiRequest<T>(
  path: string,
  method: HttpMethod = 'GET',
  body?: unknown,
): Promise<T> {
  const token = await getToken()

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  if (res.status === 204) return undefined as T

  const data = await res.json()

  if (!res.ok) {
    if (res.status === 401) {
      await clearToken()
      router.replace('/login')
    }
    throw new ApiError(res.status, data.error ?? 'unknown_error')
  }

  return data as T
}
