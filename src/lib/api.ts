import axios from 'axios'

/**
 * Resolve API base URL for local (relative / Vite proxy) and split deploys.
 * If the env value is only the API origin (no /api/v1), append it automatically.
 */
function resolveApiBaseUrl(raw: string | undefined): string {
  const value = (raw || '/api/v1').trim().replace(/\/+$/, '')

  if (!value.startsWith('http://') && !value.startsWith('https://')) {
    return value.startsWith('/') ? value : `/${value}`
  }

  try {
    const url = new URL(value)
    const path = url.pathname.replace(/\/+$/, '') || '/'

    if (path === '/' || path === '/api' || !path.includes('/api/v1')) {
      url.pathname = '/api/v1'
    }

    url.search = ''
    url.hash = ''
    return `${url.origin}${url.pathname.replace(/\/+$/, '')}`
  } catch {
    return '/api/v1'
  }
}

export const API_BASE_URL = resolveApiBaseUrl(import.meta.env.VITE_API_BASE_URL as string | undefined)

/** Laravel `/api` root (unversioned routes such as `/api/health`). */
export const API_ROOT_URL = API_BASE_URL.replace(/\/v1$/, '')

export const AUTH_TOKEN_KEY = 'auth_token'

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
})

export const rootApi = axios.create({
  baseURL: API_ROOT_URL,
  headers: {
    Accept: 'application/json',
  },
})

function isAuthFormRequest(config: { url?: string }): boolean {
  const url = config.url ?? ''
  return url.includes('/login') || url.includes('/auth/register') || url.includes('/auth/refresh')
}

api.interceptors.request.use(
  (config) => {
    if (isAuthFormRequest(config)) {
      delete config.headers.Authorization
      delete config.headers.authorization
      return config
    }

    const token = localStorage.getItem(AUTH_TOKEN_KEY)
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }

    return config
  },
  (error) => Promise.reject(error),
)

/** One refresh at a time: the old token stops working once it's refreshed, so parallel 401s share the result. */
let refreshing: Promise<string | null> | null = null

function refreshToken(expired: string): Promise<string | null> {
  refreshing ??= axios
    .post<{ access_token: string; user?: unknown }>(`${API_BASE_URL}/auth/refresh`, null, {
      headers: { Accept: 'application/json', Authorization: `Bearer ${expired}` },
    })
    .then(({ data }) => {
      localStorage.setItem(AUTH_TOKEN_KEY, data.access_token)
      if (data.user) localStorage.setItem('auth_user', JSON.stringify(data.user))
      return data.access_token
    })
    .catch(() => null)
    .finally(() => {
      refreshing = null
    })
  return refreshing
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config
    if (!config || isAuthFormRequest(config) || error.response?.status !== 401) {
      return Promise.reject(error)
    }

    const sent = String(config.headers?.Authorization ?? '').replace(/^Bearer /, '')
    const current = localStorage.getItem(AUTH_TOKEN_KEY)
    if (!config._retried && current) {
      // Expired tokens are refreshed (for up to two weeks) and the request tried again.
      const token = current !== sent ? current : await refreshToken(current)
      if (token) {
        config._retried = true
        config.headers.Authorization = `Bearer ${token}`
        return api(config)
      }
    }

    localStorage.removeItem(AUTH_TOKEN_KEY)
    return Promise.reject(error)
  },
)

export default api
