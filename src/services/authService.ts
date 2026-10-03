import { isAxiosError } from 'axios'
import type {
  ApiValidationErrors,
  AuthResponse,
  AuthUser,
  LoginPayload,
  RegisterPayload,
} from '@/types/auth'
import { AUTH_TOKEN_KEY, api } from '@/lib/api'

const USER_KEY = 'auth_user'

function readStoredUser(): AuthUser | null {
  const raw = localStorage.getItem(USER_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as AuthUser
  } catch {
    return null
  }
}

let currentUser: AuthUser | null = readStoredUser()
const userListeners = new Set<() => void>()

function setCurrentUser(user: AuthUser | null): void {
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user))
  else localStorage.removeItem(USER_KEY)
  currentUser = user
  userListeners.forEach((listener) => listener())
}

function persist(data: AuthResponse): void {
  localStorage.setItem(AUTH_TOKEN_KEY, data.access_token)
  setCurrentUser(data.user)
}

function clear(): void {
  localStorage.removeItem(AUTH_TOKEN_KEY)
  setCurrentUser(null)
}

export const authService = {
  async login(payload: LoginPayload): Promise<AuthResponse> {
    clear()
    const { data } = await api.post<AuthResponse>('/auth/login', payload)
    persist(data)
    return data
  },

  async register(payload: RegisterPayload): Promise<AuthResponse> {
    clear()
    const { data } = await api.post<AuthResponse>('/auth/register', payload)
    persist(data)
    return data
  },

  async me(): Promise<AuthUser> {
    const { data } = await api.get<{ user: AuthUser }>('/auth/me')
    setCurrentUser(data.user)
    return data.user
  },

  async logout(): Promise<void> {
    try {
      if (this.getToken()) {
        await api.post('/auth/logout')
      }
    } catch {
      // Token may already be expired/invalid; local session is cleared regardless.
    } finally {
      clear()
    }
  },

  getToken(): string | null {
    return localStorage.getItem(AUTH_TOKEN_KEY)
  },

  getUser(): AuthUser | null {
    return currentUser
  },

  setUser(user: AuthUser): void {
    setCurrentUser(user)
  },

  subscribe(listener: () => void): () => void {
    userListeners.add(listener)
    return () => userListeners.delete(listener)
  },

  isAuthenticated(): boolean {
    return Boolean(this.getToken())
  },
}

/** Human-readable message from an API error. */
export function apiErrorMessage(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (isAxiosError(error)) {
    if (!error.response) return 'Cannot reach the denuwe server. Please try again.'
    if (error.response.status === 429) return 'Too many attempts. Please wait a minute and try again.'
    const message = (error.response.data as { message?: unknown } | undefined)?.message
    if (typeof message === 'string' && message) return message
  }
  return fallback
}

/** Field errors from a Laravel 422 response, or null. */
export function apiValidationErrors(error: unknown): ApiValidationErrors | null {
  if (isAxiosError(error) && error.response?.status === 422) {
    const errors = (error.response.data as { errors?: ApiValidationErrors } | undefined)?.errors
    return errors ?? null
  }
  return null
}
