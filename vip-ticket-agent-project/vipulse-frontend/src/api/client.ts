import axios, { AxiosError, AxiosRequestConfig, InternalAxiosRequestConfig } from 'axios'
import { v4 as uuidv4 } from 'uuid'

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

export const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30_000,
})

// ── Token storage helpers ─────────────────────────────────────────────────────
const TOKEN_KEY   = 'vipulse_access_token'
const REFRESH_KEY = 'vipulse_refresh_token'

export const tokenStorage = {
  getAccess:     ()      => localStorage.getItem(TOKEN_KEY),
  setAccess:     (t: string) => localStorage.setItem(TOKEN_KEY, t),
  getRefresh:    ()      => localStorage.getItem(REFRESH_KEY),
  setRefresh:    (t: string) => localStorage.setItem(REFRESH_KEY, t),
  clear:         ()      => { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(REFRESH_KEY) },
}

// ── Request interceptor — attach Authorization + X-Request-ID ─────────────────
apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = tokenStorage.getAccess()
  if (token) config.headers['Authorization'] = `Bearer ${token}`
  config.headers['X-Request-ID'] = uuidv4()
  return config
})

// ── Response interceptor — refresh on 401, retry once ────────────────────────
let _refreshing = false
let _queue: Array<{ resolve: (v: string) => void; reject: (e: unknown) => void }> = []

function processQueue(error: unknown, token: string | null) {
  _queue.forEach(({ resolve, reject }) => (error ? reject(error) : resolve(token!)))
  _queue = []
}

apiClient.interceptors.response.use(
  (r) => r,
  async (error: AxiosError) => {
    const original = error.config as AxiosRequestConfig & { _retry?: boolean }

    if (error.response?.status !== 401 || original._retry) {
      return Promise.reject(error)
    }

    // /auth/refresh itself 401-ed → force logout
    if (original.url?.includes('/auth/refresh') || original.url?.includes('/auth/logout')) {
      tokenStorage.clear()
      window.location.href = '/login'
      return Promise.reject(error)
    }

    if (_refreshing) {
      return new Promise<string>((resolve, reject) => {
        _queue.push({ resolve, reject })
      }).then((token) => {
        original.headers = { ...original.headers, Authorization: `Bearer ${token}` }
        return apiClient(original)
      })
    }

    original._retry = true
    _refreshing = true

    try {
      const refresh = tokenStorage.getRefresh()
      if (!refresh) throw new Error('No refresh token')

      const { data } = await apiClient.post('/api/v1/auth/refresh', { refresh_token: refresh })
      const newAccess  = data.data.access_token
      const newRefresh = data.data.refresh_token

      tokenStorage.setAccess(newAccess)
      tokenStorage.setRefresh(newRefresh)
      processQueue(null, newAccess)

      original.headers = { ...original.headers, Authorization: `Bearer ${newAccess}` }
      return apiClient(original)
    } catch (err) {
      processQueue(err, null)
      tokenStorage.clear()
      window.location.href = '/login'
      return Promise.reject(err)
    } finally {
      _refreshing = false
    }
  },
)

export default apiClient
