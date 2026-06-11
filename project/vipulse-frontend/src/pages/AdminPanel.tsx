import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import { Navigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Pencil, Trash2, Crown, Upload, AlertTriangle } from 'lucide-react'
import { PageWrapper }  from '@/components/layout/PageWrapper'
import { Button }       from '@/components/ui/Button'
import { Badge }        from '@/components/ui/Badge'
import { Modal }        from '@/components/ui/Modal'
import { Input }        from '@/components/ui/Input'
import { Spinner }      from '@/components/ui/Spinner'
import { useToast }     from '@/components/ui/Toast'
import { useAuth }      from '@/hooks/useAuth'
import apiClient        from '@/api/client'
import { VIP_COLORS, DEPARTMENTS, ROLES } from '@/utils/constants'
import type { VIPLevel } from '@/types/ticket'

interface Employee {
  employee_id:        string
  name:               string
  email:              string
  role:               string
  department:         string
  vip_level:          VIPLevel
  vip_score_override: number | null
  is_active:          boolean
}

const schema = z.object({
  employee_id:        z.string().min(1, 'Required'),
  name:               z.string().min(2, 'Min 2 characters'),
  email:              z.string().email('Valid email required'),
  role:               z.string().min(1, 'Required'),
  department:         z.string().min(1, 'Required'),
  vip_level:          z.enum(['standard', 'silver', 'gold', 'platinum'] as const),
  vip_score_override: z.number().min(0).max(100).nullable().optional(),
})
type FormData = z.infer<typeof schema>

const VIP_LEVELS: VIPLevel[] = ['standard', 'silver', 'gold', 'platinum']

export default function AdminPanel() {
  const { isAdmin, isManager } = useAuth()
  const { toast }   = useToast()
  const qc          = useQueryClient()

  const [modalOpen,      setModalOpen]      = useState(false)
  const [editing,        setEditing]        = useState<Employee | null>(null)
  const [deleteConfirm,  setDeleteConfirm]  = useState<string | null>(null)

  if (!isAdmin && !isManager) return <Navigate to="/dashboard" replace />

  // ── Data ──────────────────────────────────────────────────────────────────
  const { data: employees, isLoading } = useQuery<{ employees: Employee[]; total: number }>(
    'vip-employees',
    async () => {
      const { data } = await apiClient.get('/api/v1/vip/employees')
      return data.data
    },
  )

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver:      zodResolver(schema),
    defaultValues: { vip_level: 'standard' },
  })

  // ── Mutations ──────────────────────────────────────────────────────────────
  const create = useMutation(
    (d: FormData) => apiClient.post('/api/v1/vip/employees', d),
    {
      onSuccess: () => {
        qc.invalidateQueries('vip-employees')
        setModalOpen(false)
        reset()
        toast('success', 'VIP employee added successfully.')
      },
      onError: (err: any) => {
        const msg = err?.response?.data?.error ?? 'Failed to save employee.'
        toast('error', msg)
      },
    },
  )

  const update = useMutation(
    ({ id, d }: { id: string; d: Partial<FormData> }) =>
      apiClient.patch(`/api/v1/vip/employees/${id}`, d),
    {
      onSuccess: () => {
        qc.invalidateQueries('vip-employees')
        setModalOpen(false)
        setEditing(null)
        reset()
        toast('success', 'VIP employee updated.')
      },
      onError: () => toast('error', 'Failed to update employee.'),
    },
  )

  const remove = useMutation(
    (id: string) => apiClient.delete(`/api/v1/vip/employees/${id}`),
    {
      onSuccess: () => {
        qc.invalidateQueries('vip-employees')
        setDeleteConfirm(null)
        toast('success', 'Employee removed.')
      },
      onError: () => toast('error', 'Failed to remove employee.'),
    },
  )

  // ── Handlers ──────────────────────────────────────────────────────────────
  const openAdd = () => {
    setEditing(null)
    reset({ vip_level: 'gold' })
    setModalOpen(true)
  }

  const openEdit = (emp: Employee) => {
    setEditing(emp)
    // Pre-fill form
    reset({
      employee_id:        emp.employee_id,
      name:               emp.name,
      email:              emp.email,
      role:               emp.role,
      department:         emp.department,
      vip_level:          emp.vip_level,
      vip_score_override: emp.vip_score_override ?? undefined,
    })
    setModalOpen(true)
  }

  const onSubmit = (d: FormData) => {
    if (editing) {
      update.mutate({ id: editing.employee_id, d })
    } else {
      create.mutate(d)
    }
  }

  const isSaving = create.isLoading || update.isLoading

  return (
    <PageWrapper title="Admin Panel" subtitle="VIP employee database management">
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-400">
            {employees?.total ?? 0} VIP employees registered
          </p>
          <div className="flex gap-3">
            <Button variant="outline" size="sm" icon={<Upload className="h-4 w-4" />}
              onClick={() => toast('info', 'CSV import coming soon.')}>
              CSV Import
            </Button>
            <Button size="sm" icon={<Plus className="h-4 w-4" />} onClick={openAdd}>
              Add VIP Employee
            </Button>
          </div>
        </div>

        {/* Table */}
        <div className="card-dark rounded-2xl overflow-hidden">
          {isLoading ? (
            <div className="flex h-48 items-center justify-center"><Spinner /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.025)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    {['Employee', 'Role', 'Department', 'VIP Level', 'Score Override', 'Status', ''].map(h => (
                      <th key={h} className="th-cell">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(employees?.employees ?? []).map(emp => (
                    <tr key={emp.employee_id} className="group transition-colors"
                      style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.025)')}
                      onMouseLeave={e => (e.currentTarget.style.background = '')}>
                      <td className="td-cell">
                        <div className="flex items-center gap-2.5">
                          <Crown className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                          <div>
                            <p className="font-semibold text-slate-200">{emp.name}</p>
                            <p className="metric text-[11px] text-slate-600">{emp.employee_id}</p>
                          </div>
                        </div>
                      </td>
                      <td className="td-cell text-slate-400 text-sm">{emp.role}</td>
                      <td className="td-cell text-slate-400 text-sm">{emp.department}</td>
                      <td className="td-cell">
                        <span className={`chip ${VIP_COLORS[emp.vip_level] ?? ''}`}>
                          {emp.vip_level.toUpperCase()}
                        </span>
                      </td>
                      <td className="td-cell metric text-xs text-slate-500">
                        {emp.vip_score_override != null ? `${emp.vip_score_override}/100` : '—'}
                      </td>
                      <td className="td-cell">
                        <Badge variant={emp.is_active ? 'low' : 'outline'}>
                          {emp.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td className="td-cell">
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => openEdit(emp)} className="icon-btn" aria-label={`Edit ${emp.name}`}>
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => setDeleteConfirm(emp.employee_id)} className="icon-btn-danger" aria-label={`Delete ${emp.name}`}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!employees?.employees?.length && (
                <div className="py-16 text-center">
                  <Crown className="mx-auto h-8 w-8 text-slate-700 mb-3" />
                  <p className="text-sm font-semibold text-slate-500">No VIP employees registered yet</p>
                  <p className="text-xs text-slate-700 mt-1">Add your first VIP employee to enable automatic detection</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Add / Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditing(null); reset() }}
        title={editing ? `Edit — ${editing.name}` : 'Add VIP Employee'}
        size="lg"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Employee ID"
              placeholder="EMP-001"
              error={errors.employee_id?.message}
              disabled={!!editing}   // can't change ID on edit
              {...register('employee_id')}
            />
            <Input
              label="Full Name"
              placeholder="Jane Smith"
              error={errors.name?.message}
              {...register('name')}
            />
            <Input
              label="Email address"
              type="email"
              placeholder="jane@company.com"
              error={errors.email?.message}
              {...register('email')}
            />
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-300">Role</label>
              <select
                className="h-10 w-full rounded-xl border px-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500/50 appearance-none cursor-pointer"
                style={{ background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.10)', color: '#CBD5E1' }}
                {...register('role')}
              >
                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              {errors.role && <p className="text-xs text-red-400">{errors.role.message}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-300">Department</label>
              <select
                className="h-10 w-full rounded-xl border px-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500/50 appearance-none cursor-pointer"
                style={{ background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.10)', color: '#CBD5E1' }}
                {...register('department')}
              >
                {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
              {errors.department && <p className="text-xs text-red-400">{errors.department.message}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-300">VIP Level</label>
              <select
                className="h-10 w-full rounded-xl border px-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500/50 appearance-none cursor-pointer"
                style={{ background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.10)', color: '#CBD5E1' }}
                {...register('vip_level')}
              >
                {VIP_LEVELS.map(v => <option key={v} value={v}>{v.toUpperCase()}</option>)}
              </select>
              {errors.vip_level && <p className="text-xs text-red-400">{errors.vip_level.message}</p>}
            </div>
          </div>
          <div className="flex gap-3 justify-end pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <Button
              variant="outline"
              type="button"
              size="sm"
              onClick={() => { setModalOpen(false); setEditing(null); reset() }}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" loading={isSaving}>
              {editing ? 'Save changes' : 'Add employee'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete confirmation modal */}
      <Modal
        open={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="Remove VIP Employee"
        size="sm"
      >
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
            <AlertTriangle className="h-6 w-6 text-red-500" />
          </div>
          <p className="text-sm text-slate-600">
            Are you sure you want to remove this VIP employee? This will affect future VIP detection
            for tickets submitted under their employee ID.
          </p>
          <div className="mt-5 flex gap-3 justify-center">
            <Button variant="outline" size="sm" onClick={() => setDeleteConfirm(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              loading={remove.isLoading}
              onClick={() => deleteConfirm && remove.mutate(deleteConfirm)}
            >
              Remove employee
            </Button>
          </div>
        </div>
      </Modal>
    </PageWrapper>
  )
}
