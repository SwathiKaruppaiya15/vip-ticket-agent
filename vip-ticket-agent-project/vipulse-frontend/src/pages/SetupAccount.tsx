import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Mail, Lock, Eye, EyeOff, ShieldAlert, CheckCircle2, ArrowRight } from 'lucide-react'
import { authApi } from '@/api/auth'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/components/ui/Toast'
import { cn } from '@/utils/cn'

// ── Password rules ────────────────────────────────────────────────────────────
const PW_RULES = [
  { label: '8+ characters',     test: (p: string) => p.length >= 8 },
  { label: 'Uppercase letter',  test: (p: string) => /[A-Z]/.test(p) },
  { label: 'Lowercase letter',  test: (p: string) => /[a-z]/.test(p) },
  { label: 'Number',            test: (p: string) => /\d/.test(p) },
  { label: 'Special character', test: (p: string) => /[^A-Za-z0-9]/.test(p) },
]

function pwStrength(p: string) {
  const n = PW_RULES.filter(r => r.test(p)).length
  if (n <= 1) return { score: 1, bar: 'bg-red-500' }
  if (n <= 2) return { score: 2, bar: 'bg-orange-500' }
  if (n <= 3) return { score: 3, bar: 'bg-amber-400' }
  return       { score: 5, bar: 'bg-green-500' }
}

// ── Schema ────────────────────────────────────────────────────────────────────
const strongPw = z.string()
  .min(8, 'Minimum 8 characters')
  .regex(/[A-Z]/, 'Needs uppercase')
  .regex(/[a-z]/, 'Needs lowercase')
  .regex(/\d/,    'Needs a number')
  .regex(/[^A-Za-z0-9]/, 'Needs a special character')

const schema = z.object({
  current_password: z.string().min(1, 'Current password required'),
  new_email:        z.string().email('Enter a valid email'),
  new_password:     strongPw,
  confirm_password: z.string().min(1, 'Please confirm password'),
}).refine(d => d.new_password === d.confirm_password, {
  message: 'Passwords do not match',
  path:    ['confirm_password'],
})
type FormData = z.infer<typeof schema>

// ── Shared field wrapper ──────────────────────────────────────────────────────
function Field({
  label, hint, error, icon: Icon, show, onToggleShow, inputProps,
}: {
  label:         string
  hint?:         string
  error?:        string
  icon:          React.ElementType
  show?:         boolean
  onToggleShow?: () => void
  inputProps:    React.InputHTMLAttributes<HTMLInputElement>
}) {
  const isPassword = inputProps.type === 'password' || show !== undefined

  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-slate-300">
        {label}
        {hint && <span className="ml-2 text-xs text-slate-600">{hint}</span>}
      </label>
      <div className="relative">
        <Icon className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-600" />
        <input
          className={cn(
            'input-dark w-full pl-10',
            isPassword && onToggleShow ? 'pr-10' : 'pr-4',
            error && 'border-red-500/50',
          )}
          {...inputProps}
          type={show !== undefined ? (show ? 'text' : 'password') : inputProps.type}
        />
        {onToggleShow && (
          <button
            type="button"
            onClick={onToggleShow}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-300 transition-colors"
          >
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        )}
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function SetupAccount() {
  const { user, logout, mustChangeCredentials } = useAuth()
  const navigate  = useNavigate()
  const { toast } = useToast()

  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew,     setShowNew]     = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [saving,      setSaving]      = useState(false)
  const [pwValue,     setPwValue]     = useState('')

  useEffect(() => {
    if (!mustChangeCredentials) navigate('/dashboard', { replace: true })
  }, [mustChangeCredentials, navigate])

  const { register, handleSubmit, watch, formState: { errors } } = useForm<FormData>({
    resolver:      zodResolver(schema),
    defaultValues: { new_email: user?.email ?? '' },
  })

  const watchedPw = watch('new_password', '')
  useEffect(() => setPwValue(watchedPw), [watchedPw])

  const onSubmit = async (data: FormData) => {
    setSaving(true)
    try {
      await authApi.changeInitialCredentials({
        new_email:        data.new_email,
        current_password: data.current_password,
        new_password:     data.new_password,
        confirm_password: data.confirm_password,
      })
      toast('success', 'Credentials updated. Please sign in again.')
      await logout()
      navigate('/login', { replace: true })
    } catch (err: unknown) {
      const msg = (err as any)?.response?.data?.error ?? 'Update failed. Please try again.'
      toast('error', msg)
    } finally {
      setSaving(false)
    }
  }

  const strength = pwStrength(pwValue)

  return (
    <div
      className="flex min-h-screen items-center justify-center p-4"
      style={{ backgroundColor: '#0F172A' }}
    >
      {/* Background glow */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          backgroundImage: `
            radial-gradient(ellipse at 30% 20%, rgba(124,58,237,0.08) 0%, transparent 50%),
            radial-gradient(ellipse at 70% 80%, rgba(6,182,212,0.06) 0%, transparent 50%)
          `,
        }}
      />

      <div className="relative w-full max-w-md animate-fade-in">
        {/* Alert banner */}
        <div
          className="mb-5 flex items-start gap-3 rounded-2xl px-4 py-3.5"
          style={{ background: 'rgba(245,158,11,0.10)', border: '1px solid rgba(245,158,11,0.20)' }}
        >
          <ShieldAlert className="h-5 w-5 text-amber-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-bold text-amber-300">First-time setup required</p>
            <p className="mt-0.5 text-xs text-amber-500/80 leading-relaxed">
              For security, update your email and password before continuing.
              These become your permanent credentials.
            </p>
          </div>
        </div>

        {/* Card */}
        <div
          className="rounded-2xl p-8"
          style={{
            background:   '#111827',
            border:       '1px solid rgba(255,255,255,0.09)',
            boxShadow:    '0 20px 60px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)',
          }}
        >
          {/* Header */}
          <div className="mb-7 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/15 border border-violet-500/20">
              <ShieldAlert className="h-5 w-5 text-violet-400" />
            </div>
            <div>
              <h1 className="text-lg font-extrabold text-slate-100">Set your credentials</h1>
              <p className="text-xs text-slate-600 mt-0.5">
                Logged in as{' '}
                <span className="metric font-semibold text-violet-400">{user?.email}</span>
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>

            {/* Current password */}
            <Field
              label="Current password"
              hint="(your demo password)"
              icon={Lock}
              show={showCurrent}
              onToggleShow={() => setShowCurrent(v => !v)}
              error={errors.current_password?.message}
              inputProps={{ autoComplete: 'current-password', placeholder: 'Enter current password', ...register('current_password') }}
            />

            {/* Divider */}
            <div className="py-1" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }} />

            {/* New email */}
            <Field
              label="New email address"
              icon={Mail}
              error={errors.new_email?.message}
              inputProps={{ type: 'email', autoComplete: 'email', placeholder: 'you@company.com', ...register('new_email') }}
            />

            {/* New password */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-300">New password</label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-600" />
                <input
                  type={showNew ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="Create a strong password"
                  className={cn('input-dark w-full pl-10 pr-10', errors.new_password && 'border-red-500/50')}
                  {...register('new_password')}
                />
                <button type="button" onClick={() => setShowNew(v => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-300 transition-colors">
                  {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.new_password && <p className="text-xs text-red-400">{errors.new_password.message}</p>}

              {/* Strength */}
              {pwValue.length > 0 && (
                <div className="mt-2 space-y-2">
                  <div className="flex gap-1">
                    {[1,2,3,4,5].map(i => (
                      <div key={i} className={cn(
                        'h-1 flex-1 rounded-full transition-all duration-300',
                        i <= strength.score ? strength.bar : 'bg-white/10',
                      )} />
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                    {PW_RULES.map(rule => (
                      <div key={rule.label} className="flex items-center gap-1.5">
                        <CheckCircle2 className={cn('h-3 w-3 shrink-0 transition-colors',
                          rule.test(pwValue) ? 'text-green-500' : 'text-white/15')} />
                        <span className={cn('text-[10px]',
                          rule.test(pwValue) ? 'text-green-500' : 'text-slate-700')}>
                          {rule.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Confirm password */}
            <Field
              label="Confirm new password"
              icon={Lock}
              show={showConfirm}
              onToggleShow={() => setShowConfirm(v => !v)}
              error={errors.confirm_password?.message}
              inputProps={{ autoComplete: 'new-password', placeholder: 'Re-enter your new password', ...register('confirm_password') }}
            />

            <button
              type="submit"
              disabled={saving}
              className={cn(
                'btn-gradient flex h-11 w-full items-center justify-center gap-2 text-sm font-bold text-white rounded-xl mt-2',
                saving && 'opacity-70 cursor-not-allowed',
              )}
            >
              {saving ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                  Saving…
                </span>
              ) : (
                <>Save &amp; Continue <ArrowRight className="h-4 w-4" /></>
              )}
            </button>
          </form>
        </div>

        <p className="mt-5 text-center text-xs text-slate-700">
          Secured by JWT · VIPulse AI Enterprise
        </p>
      </div>
    </div>
  )
}
