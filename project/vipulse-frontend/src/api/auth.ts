import apiClient from './client'
import type {
  AuthResponse,
  ChangeCredentialsRequest,
  LoginRequest,
  RegisterRequest,
  Tokens,
  User,
} from '@/types/auth'

interface ApiEnvelope<T> { success: boolean; data: T; message?: string }

export const authApi = {
  login: async (req: LoginRequest): Promise<AuthResponse> => {
    const { data } = await apiClient.post<ApiEnvelope<AuthResponse>>('/api/v1/auth/login', req)
    return data.data
  },

  register: async (req: RegisterRequest): Promise<AuthResponse> => {
    const { data } = await apiClient.post<ApiEnvelope<AuthResponse>>('/api/v1/auth/register', req)
    return data.data
  },

  changeInitialCredentials: async (req: ChangeCredentialsRequest): Promise<void> => {
    await apiClient.put('/api/v1/auth/change-initial-credentials', req)
  },

  refresh: async (refreshToken: string): Promise<Tokens> => {
    const { data } = await apiClient.post<ApiEnvelope<Tokens>>('/api/v1/auth/refresh', {
      refresh_token: refreshToken,
    })
    return data.data
  },

  logout: async (): Promise<void> => {
    await apiClient.post('/api/v1/auth/logout')
  },

  me: async (): Promise<User> => {
    const { data } = await apiClient.get<ApiEnvelope<User>>('/api/v1/auth/me')
    return data.data
  },
}
