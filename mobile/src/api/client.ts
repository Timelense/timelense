import * as Keychain from 'react-native-keychain'
import Config from 'react-native-config'
import { emitUnauthorized } from './authEvents'

const BASE_URL = Config.API_URL ?? 'http://localhost:3000'
const TOKEN_SERVICE = 'timelense_auth'

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
  const creds = await Keychain.getGenericPassword({ service: TOKEN_SERVICE })
  return creds ? creds.password : null
}

export async function setToken(token: string): Promise<void> {
  await Keychain.setGenericPassword('token', token, { service: TOKEN_SERVICE })
}

export async function clearToken(): Promise<void> {
  await Keychain.resetGenericPassword({ service: TOKEN_SERVICE })
}

type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE'

export async function apiRequest<T>(
  path: string,
  method: HttpMethod = 'GET',
  body?: unknown,
): Promise<T> {
  const token = await getToken()

  const serialized = body !== undefined ? JSON.stringify(body) : undefined

  const headers: Record<string, string> = {}
  if (serialized !== undefined) headers['Content-Type'] = 'application/json'
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: serialized,
  })

  if (res.status === 204) return undefined as T

  const data = await res.json()

  if (!res.ok) {
    if (res.status === 401) {
      await clearToken()
      emitUnauthorized()
    }
    throw new ApiError(res.status, data.error ?? 'unknown_error')
  }

  return data as T
}
