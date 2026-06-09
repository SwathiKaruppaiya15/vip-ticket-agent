import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Brain, Paperclip, Cpu } from 'lucide-react'
import { PageWrapper } from '@/components/layout/PageWrapper'
import { Card }        from '@/components/ui/Card'
import { Button }      from '@/components/ui/Button'
import { Input }       from '@/components/ui/Input'
import { useToast }    from '@/components/ui/Toast'
import { useTicketStore } from '@/store/ticketStore'
import { ticketsApi }  from '@/api/tickets'
import { DEPARTMENTS, ROLES } from '@/utils/constants'
import { cn }          from '@/utils/cn'

const schema = z.object({
  employee_id:       z.string().min(1, 'Required'),
  employee_name:     z.string().min(2, 'Required'),
  role:              z.string().min(1, 'Select a role'),
  department:        z.string().min(1, 'Select a department'),
  issue_title:       z.string().min(5, 'Min 5 characters').max(200),
  issue_description: z.string().min(20, 'Min 20 characters').max(5000),
  severity:          z.enum(['low','medium','high','critical']),
})
type FormData = z.infer<typeof schema>

const SEVERITIES = [
  { value: 'low',      label: 'Low',      cls: 'border-green-500/30 text-green-400 hover:border-green-500/60 hover:bg-green-500/5',   active: 'border-green-500 bg-green-500/15 text-green-300' },
  { value: 'medium',   label: 'Medium',   cls: 'border-amber-500/30 text-amber-400 hover:border-amber-500/60 hover:bg-amber-500/5',   active: 'border-amber-500 bg-amber-500/15 text-amber-300' },
  { value: 'high',     label: 'High',     cls: 'border-orange-500/30 text-orange-400 hover:border-orange-500/60 hover:bg-orange-500/5',active: 'border-orange-500 bg-orange-500/15 text-orange-300' },
  { value: 'critical', label: 'Critical', cls: 'border-red-500/30 text-red-400 hover:border-red-500/60 hover:bg-red-500/5',           active: 'border-red-500 bg-red-500/15 text-red-300' },
]

const SELECT_CLS = cn(
  'h-10 w-full rounded-xl border px-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500/50 transition-all duration-150 appearance-none cursor-pointer',
)
const selectStyle = {
  background:  'rgba(255,255,255,0.04)',
  borderColor: 'rgba(255,255,255,0.10)',
  color:       '#CBD5E1',
}

export default function SubmitTicket() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const setRecentlyCreated = useTicketStore(s => s.setRecentlyCreated)
  const [analyzing, setAnalyzing] = useState(false)

  const { register, handleSubmit, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { severity: 'medium' },
  })
  const severity = watch('severity')

  const onSubmit = async (data: FormData) => {
    setAnalyzing(true)
    try {
      const ticket = await ticketsApi.create(data)
      setRecentlyCreated(ticket)
      toast('success', `Ticket ${ticket.ticket_id} submitted — AI analyzing…`)
      navigate(`/tickets/${ticket.ticket_id}/decision`)
    } catch {
      toast('error', 'Failed to submit ticket. Please try again.')
      setAnalyzing(false)
    }
  }

  return (
    <PageWrapper title="Submit Ticket" subtitle="AI will triage and route automatically">
      <div className="mx-auto max-w-3xl">
        {analyzing ? (
          /* ── AI Analysis animation ── */
          <div className="card-dark rounded-2xl flex flex-col items-center justify-center gap-7 py-24">
            <div className="relative flex h-20 w-20 items-center justify-center">
              <div className="absolute inset-0 rounded-full animate-ping opacity-20" style={{ background: 'radial-gradient(#7C3AED, transparent)' }} />
              <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-500/15 border border-violet-500/25">
                <Cpu className="h-8 w-8 text-violet-400 animate-pulse" />
              </div>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-slate-200">AI Pipeline Running…</p>
              <p className="mt-1.5 text-sm text-slate-600">6 intelligent agents working in parallel</p>
            </div>
            <div className="flex gap-3">
              {['Intake','VIP','Priority','Routing','SLA','AI Explain'].map((step, i) => (
                <div key={step} className="flex flex-col items-center gap-1.5">
                  <div className="h-1.5 w-1.5 rounded-full bg-violet-500 animate-pulse" style={{ animationDelay: `${i * 150}ms` }} />
                  <span className="text-[9px] text-slate-600 font-semibold">{step}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">

            {/* Employee info */}
            <Card className="p-6">
              <p className="mb-5 text-sm font-bold text-slate-300">Employee Information</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <Input label="Employee ID"   placeholder="EMP-001" error={errors.employee_id?.message}   {...register('employee_id')} />
                <Input label="Employee Name" placeholder="Jane Smith" error={errors.employee_name?.message} {...register('employee_name')} />

                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-slate-300">Role</label>
                  <select {...register('role')} className={SELECT_CLS} style={selectStyle}>
                    <option value="">Select role…</option>
                    {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                  {errors.role && <p className="text-xs text-red-400">{errors.role.message}</p>}
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-slate-300">Department</label>
                  <select {...register('department')} className={SELECT_CLS} style={selectStyle}>
                    <option value="">Select department…</option>
                    {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                  {errors.department && <p className="text-xs text-red-400">{errors.department.message}</p>}
                </div>
              </div>
            </Card>

            {/* Issue details */}
            <Card className="p-6">
              <p className="mb-5 text-sm font-bold text-slate-300">Issue Details</p>
              <div className="space-y-4">
                <Input
                  label="Issue Title"
                  placeholder="Brief summary of the problem"
                  error={errors.issue_title?.message}
                  {...register('issue_title')}
                />

                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-slate-300">
                    Description <span className="text-slate-600">(min 20 characters)</span>
                  </label>
                  <textarea
                    rows={5}
                    placeholder="Describe the issue in detail — more context gives better AI analysis…"
                    className={cn(
                      'w-full rounded-xl border px-3.5 py-3 text-sm resize-none',
                      'focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500/50 transition-all',
                      'placeholder-slate-600 text-slate-200',
                      errors.issue_description ? 'border-red-500/50' : '',
                    )}
                    style={{ background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.10)' }}
                    {...register('issue_description')}
                  />
                  {errors.issue_description && <p className="text-xs text-red-400">{errors.issue_description.message}</p>}
                </div>

                {/* Severity */}
                <div>
                  <label className="mb-3 block text-sm font-medium text-slate-300">Severity</label>
                  <div className="grid grid-cols-4 gap-2.5">
                    {SEVERITIES.map(s => (
                      <label
                        key={s.value}
                        className={cn(
                          'flex cursor-pointer items-center justify-center rounded-xl border-2 px-3 py-2.5 text-sm font-semibold transition-all',
                          severity === s.value ? s.active : s.cls,
                        )}
                      >
                        <input type="radio" value={s.value} className="sr-only" {...register('severity')} />
                        {s.label}
                      </label>
                    ))}
                  </div>
                </div>

                {/* Attachment */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-300">
                    Attachment <span className="text-slate-600">(optional)</span>
                  </label>
                  <label
                    className="flex cursor-pointer items-center gap-2 rounded-xl px-4 py-3 text-sm text-slate-600 hover:text-slate-400 transition-colors"
                    style={{ border: '1px dashed rgba(255,255,255,0.12)' }}
                  >
                    <Paperclip className="h-4 w-4" />
                    <span>Click to attach image or PDF</span>
                    <input type="file" accept="image/*,.pdf" className="sr-only" />
                  </label>
                </div>
              </div>
            </Card>

            <Button type="submit" variant="gradient" size="lg" className="w-full" icon={<Brain className="h-5 w-5" />}>
              Submit &amp; Analyze with AI
            </Button>
          </form>
        )}
      </div>
    </PageWrapper>
  )
}
