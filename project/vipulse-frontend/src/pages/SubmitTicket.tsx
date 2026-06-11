import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Brain, Paperclip, Cpu, FileSpreadsheet, FileText, ClipboardList } from 'lucide-react'
import { PageWrapper }    from '@/components/layout/PageWrapper'
import { Card }           from '@/components/ui/Card'
import { Button }         from '@/components/ui/Button'
import { Input }          from '@/components/ui/Input'
import { useToast }       from '@/components/ui/Toast'
import { ExcelUpload }    from '@/components/import/ExcelUpload'
import { PdfUpload }      from '@/components/import/PdfUpload'
import { useTicketStore } from '@/store/ticketStore'
import { ticketsApi }     from '@/api/tickets'
import { DEPARTMENTS, ROLES } from '@/utils/constants'
import { cn }             from '@/utils/cn'

// ── Manual form schema ────────────────────────────────────────────────────────
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
  { value: 'low',      label: 'Low',      cls: 'border-green-500/30 text-green-400 hover:border-green-500/60 hover:bg-green-500/5',    active: 'border-green-500 bg-green-500/15 text-green-300' },
  { value: 'medium',   label: 'Medium',   cls: 'border-amber-500/30 text-amber-400 hover:border-amber-500/60 hover:bg-amber-500/5',    active: 'border-amber-500 bg-amber-500/15 text-amber-300' },
  { value: 'high',     label: 'High',     cls: 'border-orange-500/30 text-orange-400 hover:border-orange-500/60 hover:bg-orange-500/5', active: 'border-orange-500 bg-orange-500/15 text-orange-300' },
  { value: 'critical', label: 'Critical', cls: 'border-red-500/30 text-red-400 hover:border-red-500/60 hover:bg-red-500/5',            active: 'border-red-500 bg-red-500/15 text-red-300' },
]

const SELECT_CLS = cn(
  'h-10 w-full rounded-xl border px-3.5 text-sm',
  'focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500/50',
  'transition-all duration-150 appearance-none cursor-pointer',
)
const selectStyle: React.CSSProperties = {
  background:  'rgba(255,255,255,0.04)',
  borderColor: 'rgba(255,255,255,0.10)',
  color:       '#CBD5E1',
}

// ── Tab definitions ───────────────────────────────────────────────────────────
type Tab = 'manual' | 'excel' | 'pdf'

const TABS: { id: Tab; label: string; icon: React.ElementType; desc: string }[] = [
  {
    id:    'manual',
    label: 'Manual Entry',
    icon:  ClipboardList,
    desc:  'Fill out the form manually',
  },
  {
    id:    'excel',
    label: 'Excel Upload',
    icon:  FileSpreadsheet,
    desc:  'Bulk import from .xlsx/.csv',
  },
  {
    id:    'pdf',
    label: 'PDF / Image',
    icon:  FileText,
    desc:  'AI extracts from document',
  },
]

// ── AI analysis animation ─────────────────────────────────────────────────────
function AnalyzingState() {
  return (
    <div className="card-dark rounded-2xl flex flex-col items-center justify-center gap-7 py-24">
      <div className="relative flex h-20 w-20 items-center justify-center">
        <div
          className="absolute inset-0 rounded-full animate-ping opacity-20"
          style={{ background: 'radial-gradient(#7C3AED, transparent)' }}
        />
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
            <div
              className="h-1.5 w-1.5 rounded-full bg-violet-500 animate-pulse"
              style={{ animationDelay: `${i * 150}ms` }}
            />
            <span className="text-[9px] text-slate-600 font-semibold">{step}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Manual form ───────────────────────────────────────────────────────────────
function ManualForm() {
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

  if (analyzing) return <AnalyzingState />

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {/* Employee info */}
      <Card className="p-6">
        <p className="mb-5 text-sm font-bold text-slate-300">Employee Information</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Employee ID"   placeholder="EMP-001"    error={errors.employee_id?.message}   {...register('employee_id')} />
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
                errors.issue_description && 'border-red-500/50',
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
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function SubmitTicket() {
  const [activeTab, setActiveTab] = useState<Tab>('manual')

  return (
    <PageWrapper title="Submit Ticket" subtitle="Create tickets manually, via Excel, or from a PDF">
      <div className="mx-auto max-w-3xl">

        {/* ── Tab switcher ── */}
        <div
          className="flex gap-1 p-1 rounded-2xl mb-6"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          {TABS.map(tab => {
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'relative flex flex-1 flex-col items-center gap-1.5 rounded-xl px-3 py-3',
                  'text-center transition-all duration-200 group',
                  isActive
                    ? 'bg-violet-600 text-white shadow-md'
                    : 'text-slate-500 hover:text-slate-200 hover:bg-white/[0.04]',
                )}
              >
                <tab.icon className={cn('h-4 w-4 shrink-0', isActive ? 'text-white' : 'text-slate-600 group-hover:text-slate-400')} />
                <span className="text-xs font-bold leading-none">{tab.label}</span>
                <span className={cn('text-[10px] leading-tight hidden sm:block', isActive ? 'text-violet-200' : 'text-slate-700')}>
                  {tab.desc}
                </span>
              </button>
            )
          })}
        </div>

        {/* ── Tab content with fade animation ── */}
        <div key={activeTab} className="animate-fade-in">
          {activeTab === 'manual' && <ManualForm />}
          {activeTab === 'excel' && (
            <div className="card-dark rounded-2xl p-6">
              <div className="flex items-center gap-2.5 mb-6">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/15 border border-violet-500/20">
                  <FileSpreadsheet className="h-4 w-4 text-violet-400" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-200">Excel / CSV Import</p>
                  <p className="text-xs text-slate-600">Bulk import up to 1,000 tickets at once</p>
                </div>
              </div>
              <ExcelUpload />
            </div>
          )}
          {activeTab === 'pdf' && (
            <div className="card-dark rounded-2xl p-6">
              <div className="flex items-center gap-2.5 mb-6">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-500/15 border border-cyan-500/20">
                  <FileText className="h-4 w-4 text-cyan-400" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-200">PDF / Image Import</p>
                  <p className="text-xs text-slate-600">AI extracts ticket details from any document</p>
                </div>
              </div>
              <PdfUpload />
            </div>
          )}
        </div>
      </div>
    </PageWrapper>
  )
}
