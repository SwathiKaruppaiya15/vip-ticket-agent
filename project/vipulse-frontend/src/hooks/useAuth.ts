import { useAuthStore } from '@/store/authStore'

export function useAuth() {
  const {
    user, isAuthenticated, mustChangeCredentials,
    isLoading, error, login, register, logout, clearError,
  } = useAuthStore()

  const isAdmin   = user?.role === 'admin'
  const isManager = user?.role === 'manager' || isAdmin
  const isViewer  = user?.role === 'viewer'

  return {
    user,
    isAuthenticated,
    mustChangeCredentials,
    isLoading,
    error,
    login,
    register,
    logout,
    clearError,
    isAdmin,
    isManager,
    isViewer,
  }
}
