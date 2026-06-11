import { Navigate, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from 'react-query'
import { useAuth } from '@/hooks/useAuth'
import { ToastProvider } from '@/components/ui/Toast'

// Public pages
import Login        from '@/pages/Login'
import Register     from '@/pages/Register'
import SetupAccount from '@/pages/SetupAccount'

// Protected pages
import Dashboard    from '@/pages/Dashboard'
import SubmitTicket from '@/pages/SubmitTicket'
import AIDecision   from '@/pages/AIDecision'
import Tickets      from '@/pages/Tickets'
import TicketDetail from '@/pages/TicketDetail'
import Analytics    from '@/pages/Analytics'
import AdminPanel   from '@/pages/AdminPanel'

const qc = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000, refetchOnWindowFocus: false },
  },
})

// ── Guards ────────────────────────────────────────────────────────────────────

/**
 * RequireAuth — redirects unauthenticated users to /login.
 * If authenticated but must_change_credentials is true, forces /setup-account
 * so the user cannot bypass the first-login flow by typing a URL directly.
 */
function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, mustChangeCredentials } = useAuth()

  if (!isAuthenticated) return <Navigate to="/login" replace />

  // Block access to any protected page until credentials are updated
  if (mustChangeCredentials) return <Navigate to="/setup-account" replace />

  return <>{children}</>
}

/**
 * RequireSetup — only lets through users who are authenticated AND need to
 * change credentials. Everyone else is redirected appropriately.
 */
function RequireSetup({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, mustChangeCredentials } = useAuth()

  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (!mustChangeCredentials) return <Navigate to="/dashboard" replace />

  return <>{children}</>
}

/**
 * PublicOnly — redirects authenticated users away from login / register.
 */
function PublicOnly({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, mustChangeCredentials } = useAuth()

  if (isAuthenticated) {
    return <Navigate to={mustChangeCredentials ? '/setup-account' : '/dashboard'} replace />
  }

  return <>{children}</>
}

// ── App ───────────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <QueryClientProvider client={qc}>
      <ToastProvider>
        <Routes>
          {/* ── Public routes ── */}
          <Route path="/login"    element={<PublicOnly><Login /></PublicOnly>} />
          <Route path="/register" element={<PublicOnly><Register /></PublicOnly>} />

          {/* ── First-login setup (authenticated but must change credentials) ── */}
          <Route
            path="/setup-account"
            element={<RequireSetup><SetupAccount /></RequireSetup>}
          />

          {/* ── Root redirect ── */}
          <Route
            path="/"
            element={<RequireAuth><Navigate to="/dashboard" replace /></RequireAuth>}
          />

          {/* ── Protected routes ── */}
          <Route path="/dashboard"  element={<RequireAuth><Dashboard /></RequireAuth>} />
          <Route path="/submit"     element={<RequireAuth><SubmitTicket /></RequireAuth>} />
          <Route path="/tickets"    element={<RequireAuth><Tickets /></RequireAuth>} />
          <Route
            path="/tickets/:ticketId"
            element={<RequireAuth><TicketDetail /></RequireAuth>}
          />
          <Route
            path="/tickets/:ticketId/decision"
            element={<RequireAuth><AIDecision /></RequireAuth>}
          />
          <Route path="/analytics"  element={<RequireAuth><Analytics /></RequireAuth>} />
          <Route path="/admin"      element={<RequireAuth><AdminPanel /></RequireAuth>} />

          {/* ── Catch-all ── */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </ToastProvider>
    </QueryClientProvider>
  )
}
