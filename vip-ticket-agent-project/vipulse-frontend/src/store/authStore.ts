import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { tokenStorage } from '@/api/client'
import { authApi } from '@/api/auth'
import type { LoginRequest, RegisterRequest, User } from '@/types/auth'

interface AuthState {
  user:                  User | null
  accessToken:           string | null
  isAuthenticated:       boolean
  mustChangeCredentials: boolean
  isLoading:             boolean
  error:                 string | null

  login:    (req: LoginRequest)    => Promise<{ mustChange: boolean }>
  register: (req: RegisterRequest) => Promise<void>
  logout:   ()                     => Promise<void>
  setUser:  (user: User)           => void
  clearError: ()                   => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user:                  null,
      accessToken:           null,
      isAuthenticated:       false,
      mustChangeCredentials: false,
      isLoading:             false,
      error:                 null,

      // ── login ───────────────────────────────────────────────────────────────
      login: async (req) => {
        set({ isLoading: true, error: null })
        try {
          const { user, tokens } = await authApi.login(req)
          tokenStorage.setAccess(tokens.access_token)
          tokenStorage.setRefresh(tokens.refresh_token)
          const mustChange = user.must_change_credentials || tokens.must_change_credentials
          set({
            user,
            accessToken:           tokens.access_token,
            isAuthenticated:       true,
            mustChangeCredentials: mustChange,
            isLoading:             false,
          })
          return { mustChange }
        } catch (err: unknown) {
          const msg =
            (err as { response?: { data?: { error?: string } } })
              ?.response?.data?.error ?? 'Invalid email or password.'
          set({ error: msg, isLoading: false })
          throw err
        }
      },

      // ── register ────────────────────────────────────────────────────────────
      register: async (req) => {
        set({ isLoading: true, error: null })
        try {
          // Don't auto-login after register — user is redirected to /login
          await authApi.register(req)
          set({ isLoading: false })
        } catch (err: unknown) {
          const msg =
            (err as { response?: { data?: { error?: string } } })
              ?.response?.data?.error ?? 'Registration failed. Please try again.'
          set({ error: msg, isLoading: false })
          throw err
        }
      },

      // ── logout ──────────────────────────────────────────────────────────────
      logout: async () => {
        try { await authApi.logout() } catch { /* ignore */ }
        tokenStorage.clear()
        set({
          user:                  null,
          accessToken:           null,
          isAuthenticated:       false,
          mustChangeCredentials: false,
        })
      },

      setUser:    (user) => set({ user }),
      clearError: ()     => set({ error: null }),
    }),
    {
      name: 'vipulse-auth',
      partialize: (s) => ({
        user:                  s.user,
        accessToken:           s.accessToken,
        isAuthenticated:       s.isAuthenticated,
        mustChangeCredentials: s.mustChangeCredentials,
      }),
    },
  ),
)
