import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  User, Mail, Lock, Eye, EyeOff, ShieldCheck,
  Loader2, CheckCircle2, ArrowRight,
} from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { useAuth }  from '@/hooks/useAuth'
import { cn }       from '@/utils/cn'
import type { UserRole } from '@/types/auth'

// ── Password rules ─────────────────────────────────────────────────────────────
const PW_RULES = [
  { label: '8+ characters',     test: (p: string) => p.length >= 8 },
  { label: 'Uppercase letter',  test: (p: string) => /[A-Z]/.test(p) },
  { label: 'Lowercase letter',  test: (p: string) => /[a-z]/.test(p) },
  { label: 'Number',            test: (p: string) => /\d/.test(p) },
  { label: 'Special char',      test: (p: string) => /[^A-Za-z0-9]/.test(p) },
]

function pwStrength(p: string) {
  const n = PW_RULES.filter(r => r.test(p)).length
  if (n <= 1) return { score: 1, label: 'Weak',   barCls: 'bg-red-500' }
  if (n <= 2) return { score: 2, label: 'Fair',   barCls: 'bg-orange-500' }
  if (n <= 3) return { score: 3, label: 'Good',   barCls: 'bg-amber-400' }
  return       { score: 5, label: 'Strong', barCls: 'bg-green-500' }
}

// ── Schema ────────────────────────────────────────────────────────────────────
const strongPw = z.string()
  .min(8, 'Minimum 8 characters')
  .regex(/[A-Z]/, 'Needs an uppercase letter')
  .regex(/[a-z]/, 'Needs a lowercase letter')
  .regex(/\d/,    'Needs a number')
  .regex(/[^A-Za-z0-9]/, 'Needs a special character')

const schema = z.object({
  username:        z.string().min(3, 'Min 3 characters').max(50),
  email:           z.string().email('Enter a valid email address'),
  password:        strongPw,
  confirmPassword: z.string().min(1, 'Please confirm your password'),
  role:            z.enum(['support_agent', 'viewer', 'manager', 'admin'] as const),
}).refine(d => d.password === d.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
})
type FormData = z.infer<typeof schema>

const ROLES: { value: UserRole; label: string; desc: string; color: string }[] = [
  { value: 'support_agent', label: 'Support Agent', desc: 'Create & manage own tickets', color: 'border-blue-500/20 hover:border-blue-500/40' },
  { value: 'viewer',        label: 'Viewer',        desc: 'Read-only access',             color: 'border-slate-500/20 hover:border-slate-500/40' },
  { value: 'manager',       label: 'Manager',       desc: 'Full team oversight',          color: 'border-amber-500/20 hover:border-amber-500/40' },
  { value: 'admin',         label: 'Admin',         desc: 'Full system access',           color: 'border-violet-500/20 hover:border-violet-500/40' },
]

// ── Left panel ────────────────────────────────────────────────────────────────
function HeroPanel() {
  return (
    <div className="hidden lg:flex flex-col justify-between p-12 xl:p-16 relative overflow-hidden bg-app-bg">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: `
            radial-gradient(ellipse at 70% 10%, rgba(6,182,212,0.10) 0%, transparent 50%),
            radial-gradient(ellipse at 20% 90%, rgba(124,58,237,0.10) 0%, transparent 50%)
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
          <span className="absolute inset-0 rounded-full bg-cyan-400 animate-ping opacity-40" />
          <span className="relative rounded-full bg-cyan-400 h-3 w-3" />
        </div>
        <span className="text-xl font-bold text-white tracking-tight select-none">
          VIPulse<span className="gradient-text">AI</span>
        </span>
      </div>

      {/* Hero */}
      <div className="relative z-10 space-y-8">
        <div>
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-cyan-500/25 bg-cyan-500/10 px-3.5 py-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />
            <span className="text-xs font-semibold text-cyan-300">Join the platform</span>
          </div>

          <h2 className="text-[2.6rem] font-extrabold text-white leading-[1.1] tracking-tight">
            Start triaging<br />
            critical tickets<br />
            <span className="gradient-text">intelligently.</span>
          </h2>
          <p className="mt-5 text-[15px] leading-relaxed text-slate-400 max-w-xs">
            Choose your role and get access to the AI-powered service desk platform from day one.
          </p>
        </div>

        {/* Role preview grid */}
        <div className="grid grid-cols-2 gap-2.5">
          {ROLES.map(r => (
            <div
              key={r.value}
              className={cn('rounded-xl border bg-white/[0.025] p-3.5 transition-colors', r.color)}
            >
              <p className="text-sm font-semibold text-slate-200">{r.label}</p>
              <p className="mt-0.5 text-xs text-slate-600">{r.desc}</p>
            </div>
          ))}
        </div>
      </div>

      <p className="relative z-10 text-xs text-slate-700">
        © 2026 VIPulse AI · Enterprise Edition
      </p>
    </div>
  )
}

// ── Shared input ──────────────────────────────────────────────────────────────
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
            'input-dark w-full pl-10',
            error && 'border-red-500/50',
            right ? 'pr-10' : 'pr-4',
          )}
          {...inputProps}
        />
        {right && (
          <div className="absolute right-3.5 top-1/2 -translate-y-1/2">{right}</div>
        )}
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  )
}

// ── Register page ─────────────────────────────────────────────────────────────
export default function Register() {
  const { register: registerUser, isLoading, error, clearError } = useAuth()
  const navigate  = useNavigate()
  const { toast } = useToast()

  const [showPw,      setShowPw]      = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [pwValue,     setPwValue]     = useState('')

  const { register, handleSubmit, watch, formState: { errors } } = useForm<FormData>({
    resolver:      zodResolver(schema),
    defaultValues: { role: 'support_agent' },
  })

  const watchedPw = watch('password', '')
  useEffect(() => setPwValue(watchedPw), [watchedPw])

  useEffect(() => {
    if (error) { toast('error', error); clearError() }
  }, [error, toast, clearError])

  const onSubmit = async (data: FormData) => {
    try {
      await registerUser({ username: data.username, email: data.email, password: data.password, role: data.role })
      toast('success', 'Account created! Please sign in.')
      navigate('/login', { replace: true })
    } catch { /* handled via store */ }
  }

  const strength = pwStrength(pwValue)

  return (
    <div
      className="grid min-h-screen lg:grid-cols-[1.15fr_1fr]"
      style={{ backgroundColor: '#0F172A' }}
    >
      <HeroPanel />

      {/* ── Right: form panel ── */}
      <div
        className="flex flex-col items-center justify-center px-6 py-12 relative overflow-y-auto"
        style={{ backgroundColor: '#080E1A' }}
      >
        <div className="pointer-events-none absolute top-0 left-0 h-64 w-64 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #06B6D4, transparent 70%)' }} />

        {/* Mobile logo */}
        <div className="mb-8 flex items-center gap-2.5 lg:hidden">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inset-0 rounded-full bg-cyan-400 animate-ping opacity-50" />
            <span className="relative rounded-full bg-cyan-400 h-2.5 w-2.5" />
          </span>
          <span className="text-lg font-bold text-white">VIPulse<span className="gradient-text">AI</span></span>
        </div>

        <div className="w-full max-w-sm animate-fade-in">
          <div className="mb-8">
            <h1 className="text-[1.75rem] font-extrabold text-white tracking-tight">Create account</h1>
            <p className="mt-1.5 text-sm text-slate-500">Join VIPulse AI to start managing IT tickets</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-3.5" noValidate>

            {/* Username */}
            <AuthInput
              label="Username"
              icon={User}
              error={errors.username?.message}
              inputProps={{ type: 'text', autoComplete: 'username', placeholder: 'johndoe', ...register('username') }}
            />

            {/* Email */}
            <AuthInput
              label="Email address"
              icon={Mail}
              error={errors.email?.message}
              inputProps={{ type: 'email', autoComplete: 'email', placeholder: 'you@company.com', ...register('email') }}
            />

            {/* Role */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-300">Account role</label>
              <div className="relative">
                <ShieldCheck className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 z-10" />
                <select
                  {...register('role')}
                  className={cn('input-dark w-full pl-10 appearance-none cursor-pointer', errors.role && 'border-red-500/50')}
                >
                  {ROLES.map(r => (
                    <option key={r.value} value={r.value}>{r.label} — {r.desc}</option>
                  ))}
                </select>
              </div>
              {errors.role && <p className="text-xs text-red-400">{errors.role.message}</p>}
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-300">Password</label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <input
                  type={showPw ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="Create a strong password"
                  className={cn('input-dark w-full pl-10 pr-10', errors.password && 'border-red-500/50')}
                  {...register('password')}
                />
                <button type="button" onClick={() => setShowPw(v => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors">
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && <p className="text-xs text-red-400">{errors.password.message}</p>}

              {/* Strength meter */}
              {pwValue.length > 0 && (
                <div className="space-y-2 pt-1">
                  <div className="flex items-center gap-2">
                    <div className="flex flex-1 gap-1">
                      {[1,2,3,4,5].map(i => (
                        <div key={i} className={cn(
                          'h-1 flex-1 rounded-full transition-all duration-300',
                          i <= strength.score ? strength.barCls : 'bg-white/10',
                        )} />
                      ))}
                    </div>
                    <span className="text-[11px] font-semibold text-slate-500">{strength.label}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                    {PW_RULES.map(rule => (
                      <div key={rule.label} className="flex items-center gap-1.5">
                        <CheckCircle2 className={cn('h-3 w-3 shrink-0 transition-colors',
                          rule.test(pwValue) ? 'text-green-500' : 'text-white/15')} />
                        <span className={cn('text-[10px]',
                          rule.test(pwValue) ? 'text-green-500' : 'text-slate-600')}>
                          {rule.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Confirm password */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-300">Confirm password</label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <input
                  type={showConfirm ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="Re-enter your password"
                  className={cn('input-dark w-full pl-10 pr-10', errors.confirmPassword && 'border-red-500/50')}
                  {...register('confirmPassword')}
                />
                <button type="button" onClick={() => setShowConfirm(v => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors">
                  {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.confirmPassword && <p className="text-xs text-red-400">{errors.confirmPassword.message}</p>}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading}
              className={cn(
                'btn-gradient flex h-11 w-full items-center justify-center gap-2 text-sm font-semibold text-white rounded-xl mt-2',
                isLoading && 'opacity-70 cursor-not-allowed',
              )}
            >
              {isLoading
                ? <><Loader2 className="h-4 w-4 animate-spin" />Creating account…</>
                : <><span>Create account</span><ArrowRight className="h-4 w-4" /></>
              }
            </button>
          </form>

          {/* Sign in link — uses React Router Link (same tab) */}
          <p className="mt-6 text-center text-sm text-slate-600">
            Already have an account?{' '}
            <Link
              to="/login"
              className="font-semibold text-violet-400 hover:text-violet-300 transition-colors underline-offset-2 hover:underline"
            >
              Sign in
            </Link>
          </p>

          <p className="mt-6 text-center text-xs text-slate-700">Powered by LangGraph multi-agent AI</p>
        </div>
      </div>
    </div>
  )
}
