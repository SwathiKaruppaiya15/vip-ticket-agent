import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Eye, EyeOff, Mail, Lock, Loader2,
  Zap, ShieldCheck, TrendingUp, ArrowRight,
} from 'lucide-react'
import { useAuth }  from '@/hooks/useAuth'
import { useToast } from '@/components/ui/Toast'
import { cn }       from '@/utils/cn'

const schema = z.object({
  email:    z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
})
type FormData = z.infer<typeof schema>

// ── Feature cards ─────────────────────────────────────────────────────────────
const FEATURES = [
  {
    icon: Zap,
    gradient: 'from-violet-500/20 to-violet-500/5',
    border: 'border-violet-500/20',
    iconColor: 'text-violet-400',
    title: 'AI-powered triage',
    desc: 'LangGraph multi-agent pipeline classifies and routes in milliseconds.',
  },
  {
    icon: ShieldCheck,
    gradient: 'from-cyan-500/20 to-cyan-500/5',
    border: 'border-cyan-500/20',
    iconColor: 'text-cyan-400',
    title: 'VIP detection engine',
    desc: 'Automatic priority escalation for C-suite and executive requests.',
  },
  {
    icon: TrendingUp,
    gradient: 'from-green-500/20 to-green-500/5',
    border: 'border-green-500/20',
    iconColor: 'text-green-400',
    title: 'Real-time SLA monitoring',
    desc: 'Predictive breach scoring with instant alerts before deadlines slip.',
  },
]

// ── Left panel ────────────────────────────────────────────────────────────────
function HeroPanel() {
  return (
    <div className="hidden lg:flex flex-col justify-between p-12 xl:p-16 relative overflow-hidden bg-app-bg">
      {/* Background layers */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: `
            radial-gradient(ellipse at 30% 20%, rgba(124,58,237,0.12) 0%, transparent 50%),
            radial-gradient(ellipse at 80% 80%, rgba(6,182,212,0.08) 0%, transparent 50%)
          `,
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-30"
        style={{
          backgroundImage: 'radial-gradient(rgba(255,255,255,0.035) 1px, transparent 1px)',
          backgroundSize:  '28px 28px',
        }}
      />

      {/* Logo */}
      <div className="relative z-10 flex items-center gap-3">
        <div className="relative flex h-3 w-3">
          <span className="absolute inset-0 rounded-full bg-violet-500 animate-ping opacity-40" />
          <span className="relative rounded-full bg-violet-500 h-3 w-3" />
        </div>
        <span className="text-xl font-bold text-white tracking-tight select-none">
          VIPulse<span className="gradient-text">AI</span>
        </span>
      </div>

      {/* Hero content */}
      <div className="relative z-10 space-y-8">
        <div>
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-violet-500/25 bg-violet-500/10 px-3.5 py-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-violet-400 animate-pulse" />
            <span className="text-xs font-semibold text-violet-300">Enterprise IT Service Intelligence</span>
          </div>

          <h2 className="text-[2.6rem] font-extrabold text-white leading-[1.1] tracking-tight">
            AI-Powered VIP<br />
            Service<br />
            <span className="gradient-text">Intelligence.</span>
          </h2>
          <p className="mt-5 text-[15px] leading-relaxed text-slate-400 max-w-xs">
            Monitor, triage, and resolve critical incidents before they escalate —
            with 6 intelligent agents working in parallel.
          </p>
        </div>

        {/* Feature cards */}
        <div className="space-y-3">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className={cn(
                'flex items-start gap-3.5 rounded-xl border p-3.5',
                `bg-gradient-to-r ${f.gradient} ${f.border}`,
              )}
            >
              <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/5', f.iconColor)}>
                <f.icon className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-200">{f.title}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <p className="relative z-10 text-xs text-slate-700">
        © 2026 VIPulse AI · Enterprise Edition
      </p>
    </div>
  )
}

// ── Input component ───────────────────────────────────────────────────────────
function AuthInput({
  label, icon: Icon, error, right, inputProps,
}: {
  label: string
  icon: React.ElementType
  error?: string
  right?: React.ReactNode
  inputProps: React.InputHTMLAttributes<HTMLInputElement>
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-slate-300">{label}</label>
      <div className="relative">
        <Icon className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
        <input
          className={cn(
            'input-dark w-full pl-10 pr-10',
            error && 'border-red-500/50 focus:border-red-500',
          )}
          {...inputProps}
        />
        {right && (
          <div className="absolute right-3.5 top-1/2 -translate-y-1/2">{right}</div>
        )}
      </div>
      {error && <p className="text-xs text-red-400 flex items-center gap-1">{error}</p>}
    </div>
  )
}

// ── Login page ────────────────────────────────────────────────────────────────
export default function Login() {
  const { login, isAuthenticated, mustChangeCredentials, isLoading, error, clearError } = useAuth()
  const navigate  = useNavigate()
  const { toast } = useToast()
  const [showPw, setShowPw] = useState(false)

  const { register, handleSubmit, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  useEffect(() => {
    if (isAuthenticated) {
      navigate(mustChangeCredentials ? '/setup-account' : '/dashboard', { replace: true })
    }
  }, [isAuthenticated, mustChangeCredentials, navigate])

  useEffect(() => {
    if (error) { toast('error', error); clearError() }
  }, [error, toast, clearError])

  const onSubmit = async (data: FormData) => {
    try {
      const { mustChange } = await login(data)
      if (mustChange) {
        toast('warning', 'First-time setup — please update your credentials.')
        navigate('/setup-account', { replace: true })
      }
    } catch { /* handled in store */ }
  }

  return (
    <div
      className="grid min-h-screen lg:grid-cols-[1.15fr_1fr]"
      style={{ backgroundColor: '#0F172A' }}
    >
      <HeroPanel />

      {/* ── Right: auth form ── */}
      <div
        className="flex flex-col items-center justify-center px-6 py-12 relative"
        style={{ backgroundColor: '#080E1A' }}
      >
        {/* Subtle top-right glow */}
        <div className="pointer-events-none absolute top-0 right-0 h-64 w-64 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #7C3AED, transparent 70%)' }} />

        {/* Mobile logo */}
        <div className="mb-8 flex items-center gap-2.5 lg:hidden">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inset-0 rounded-full bg-violet-500 animate-ping opacity-50" />
            <span className="relative rounded-full bg-violet-500 h-2.5 w-2.5" />
          </span>
          <span className="text-lg font-bold text-white">VIPulse<span className="gradient-text">AI</span></span>
        </div>

        <div className="w-full max-w-sm animate-fade-in">
          <div className="mb-8">
            <h1 className="text-[1.75rem] font-extrabold text-white tracking-tight">Welcome back</h1>
            <p className="mt-1.5 text-sm text-slate-500">
              Sign in to your VIPulse workspace
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <AuthInput
              label="Email address"
              icon={Mail}
              error={errors.email?.message}
              inputProps={{ type: 'email', autoComplete: 'email', placeholder: 'you@company.com', ...register('email') }}
            />

            <AuthInput
              label="Password"
              icon={Lock}
              error={errors.password?.message}
              right={
                <button type="button" onClick={() => setShowPw(v => !v)}
                  className="text-slate-500 hover:text-slate-300 transition-colors"
                  aria-label={showPw ? 'Hide password' : 'Show password'}>
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              }
              inputProps={{ type: showPw ? 'text' : 'password', autoComplete: 'current-password', placeholder: '••••••••', ...register('password') }}
            />

            {/* Sign in button */}
            <button
              type="submit"
              disabled={isLoading}
              className={cn(
                'btn-gradient flex h-11 w-full items-center justify-center gap-2 text-sm font-semibold text-white rounded-xl',
                isLoading && 'opacity-70 cursor-not-allowed',
              )}
            >
              {isLoading
                ? <><Loader2 className="h-4 w-4 animate-spin" />Signing in…</>
                : <><span>Sign in</span><ArrowRight className="h-4 w-4" /></>
              }
            </button>
          </form>

          {/* Demo credentials */}
          <button
            type="button"
            onClick={() => { setValue('email', 'admin@vipulse.ai'); setValue('password', 'admin123') }}
            className="mt-5 w-full rounded-xl border border-dashed border-white/10 bg-white/[0.03] px-4 py-3 text-left hover:border-violet-500/30 hover:bg-violet-500/[0.05] transition-all group"
          >
            <p className="text-xs font-semibold text-slate-500 mb-2 flex items-center gap-1.5 group-hover:text-slate-400">
              <span className="flex h-4 w-4 items-center justify-center rounded bg-violet-500/20 text-violet-400 text-[10px] font-bold">→</span>
              Click to use demo credentials
            </p>
            <div className="grid grid-cols-2 gap-x-4">
              <code className="metric text-xs text-slate-400">admin@vipulse.ai</code>
              <code className="metric text-xs text-slate-600">admin123</code>
            </div>
          </button>

          {/* Register link — uses React Router Link (same tab) */}
          <p className="mt-6 text-center text-sm text-slate-600">
            Don't have an account?{' '}
            <Link
              to="/register"
              className="font-semibold text-violet-400 hover:text-violet-300 transition-colors underline-offset-2 hover:underline"
            >
              Create account
            </Link>
          </p>

          <p className="mt-8 text-center text-xs text-slate-700">
            Secured by JWT · Powered by LangGraph AI
          </p>
        </div>
      </div>
    </div>
  )
}
