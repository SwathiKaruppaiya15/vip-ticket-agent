import { useCallback, useRef, useState } from 'react'
import {
  FileText, Brain, Pencil, CheckCircle2,
  AlertTriangle, Loader2, X, Trash2, Save,
} from 'lucide-react'
import { cn } from '@/utils/cn'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { importsApi } from '@/api/imports'
import type { ExtractedTicket, ImportResult } from '@/api/imports'

const ACCEPTED  = '.pdf,.png,.jpg,.jpeg,.webp'
const MAX_MB    = 10
const SEVERITIES = ['low','medium','high','critical'] as const

type Severity = typeof SEVERITIES[number]

const SEVERITY_STYLES: Record<Severity, string> = {
  low:      'chip-low',
  medium:   'chip-medium',
  high:     'chip-high',
  critical: 'chip-critical',
}

// ── Editable ticket card ──────────────────────────────────────────────────────
function TicketCard({
  ticket,
  index,
  onUpdate,
  onRemove,
}: {
  ticket:   ExtractedTicket
  index:    number
  onUpdate: (idx: number, field: keyof ExtractedTicket, val: string) => void
  onRemove: (idx: number) => void
}) {
  const [expanded, setExpanded] = useState(false)

  const inputCls = cn(
    'w-full rounded-lg border px-3 py-2 text-sm text-slate-200 placeholder-slate-600',
    'focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500/50 transition-all',
  )
  const inputStyle = { background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.10)' }

  return (
    <div
      className="rounded-2xl overflow-hidden animate-fade-in"
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-white/[0.02] transition-colors"
        onClick={() => setExpanded(v => !v)}
      >
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-violet-500/20 text-[11px] font-bold text-violet-400 shrink-0">
          {index + 1}
        </div>
        <p className="flex-1 text-sm font-semibold text-slate-200 truncate">{ticket.issue_title || 'Untitled'}</p>
        <span className={cn('chip text-[10px]', SEVERITY_STYLES[ticket.severity as Severity] ?? 'chip-medium')}>
          {ticket.severity}
        </span>
        <button
          type="button"
          onClick={e => { e.stopPropagation(); onRemove(index) }}
          className="ml-2 text-slate-600 hover:text-red-400 transition-colors"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
        <Pencil className="h-3.5 w-3.5 text-slate-600" />
      </div>

      {/* Expanded edit form */}
      {expanded && (
        <div className="px-4 pb-4 space-y-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="pt-3 grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1 block">Employee Name</label>
              <input
                value={ticket.employee_name}
                onChange={e => onUpdate(index, 'employee_name', e.target.value)}
                className={inputCls} style={inputStyle}
                placeholder="Employee name"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1 block">Employee ID</label>
              <input
                value={ticket.employee_id ?? ''}
                onChange={e => onUpdate(index, 'employee_id', e.target.value)}
                className={inputCls} style={inputStyle}
                placeholder="EMP-001 (optional)"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1 block">Role</label>
              <input
                value={ticket.role}
                onChange={e => onUpdate(index, 'role', e.target.value)}
                className={inputCls} style={inputStyle}
                placeholder="Job title / role"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1 block">Department</label>
              <input
                value={ticket.department}
                onChange={e => onUpdate(index, 'department', e.target.value)}
                className={inputCls} style={inputStyle}
                placeholder="Department"
              />
            </div>
          </div>

          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1 block">Issue Title</label>
            <input
              value={ticket.issue_title}
              onChange={e => onUpdate(index, 'issue_title', e.target.value)}
              className={inputCls} style={inputStyle}
              placeholder="Brief summary"
            />
          </div>

          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1 block">Description</label>
            <textarea
              rows={3}
              value={ticket.issue_description}
              onChange={e => onUpdate(index, 'issue_description', e.target.value)}
              className={cn(inputCls, 'resize-none')}
              style={inputStyle}
              placeholder="Detailed description"
            />
          </div>

          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1 block">Severity</label>
            <div className="flex gap-2">
              {SEVERITIES.map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => onUpdate(index, 'severity', s)}
                  className={cn(
                    'chip capitalize cursor-pointer transition-all',
                    ticket.severity === s ? SEVERITY_STYLES[s] : 'text-slate-600 hover:text-slate-300',
                  )}
                  style={ticket.severity !== s ? { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' } : undefined}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Result summary ────────────────────────────────────────────────────────────
function ImportSuccess({ result, onReset }: { result: ImportResult; onReset: () => void }) {
  return (
    <div className="flex flex-col items-center gap-5 py-10 animate-fade-in">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-green-500/15 border border-green-500/25">
        <CheckCircle2 className="h-8 w-8 text-green-400" />
      </div>
      <div className="text-center">
        <p className="text-lg font-extrabold text-slate-100">
          {result.created} ticket{result.created !== 1 ? 's' : ''} created!
        </p>
        <p className="mt-1 text-sm text-slate-500">
          {result.failed > 0 && `${result.failed} failed · `}AI pipeline running in background
        </p>
      </div>
      <div className="grid grid-cols-3 gap-3 w-full max-w-sm">
        {[
          { l: 'Total',   v: result.total_rows,  c: 'text-slate-300' },
          { l: 'Created', v: result.created,     c: 'text-green-400' },
          { l: 'Failed',  v: result.failed,       c: result.failed > 0 ? 'text-red-400' : 'text-slate-500' },
        ].map(s => (
          <div key={s.l} className="rounded-xl py-3 text-center" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <p className={`metric text-xl font-extrabold ${s.c}`}>{s.v}</p>
            <p className="text-[10px] text-slate-600 mt-0.5 uppercase tracking-wider">{s.l}</p>
          </div>
        ))}
      </div>
      <Button variant="outline" size="sm" onClick={onReset}>Upload Another PDF</Button>
    </div>
  )
}

// ── Main PdfUpload component ──────────────────────────────────────────────────
export function PdfUpload() {
  const { toast } = useToast()

  type Stage = 'idle' | 'extracting' | 'preview' | 'creating' | 'done'

  const [file,      setFile]      = useState<File | null>(null)
  const [dragOver,  setDragOver]  = useState(false)
  const [stage,     setStage]     = useState<Stage>('idle')
  const [tickets,   setTickets]   = useState<ExtractedTicket[]>([])
  const [result,    setResult]    = useState<ImportResult | null>(null)
  const [empId,     setEmpId]     = useState('')
  const [progress,  setProgress]  = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const reset = () => {
    setFile(null)
    setTickets([])
    setResult(null)
    setStage('idle')
    setEmpId('')
    setProgress(0)
    if (inputRef.current) inputRef.current.value = ''
  }

  const validateFile = (f: File): string | null => {
    const ext = f.name.toLowerCase().split('.').pop() ?? ''
    if (!['pdf','png','jpg','jpeg','webp'].includes(ext)) {
      return 'Unsupported file. Please upload a PDF or image (.pdf, .png, .jpg, .jpeg)'
    }
    if (f.size > MAX_MB * 1024 * 1024) {
      return `File too large. Maximum size is ${MAX_MB} MB.`
    }
    return null
  }

  const handleFile = (f: File) => {
    const err = validateFile(f)
    if (err) { toast('error', err); return }
    setFile(f)
    setStage('idle')
    setTickets([])
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }, [])

  const handleExtract = async () => {
    if (!file) return
    setStage('extracting')
    setProgress(0)

    try {
      const res = await importsApi.importPdf(file, {
        employeeId: empId.trim() || undefined,
        onProgress: (pct) => setProgress(pct),
      })

      if (!res.extracted || res.extracted.length === 0) {
        toast('warning', res.message ?? 'No ticket data could be extracted from this document.')
        setStage('idle')
        return
      }

      // Auto-fill employee_id if provided
      const withId = res.extracted.map(t => ({
        ...t,
        employee_id: t.employee_id || empId.trim() || '',
      }))

      setTickets(withId)
      setStage('preview')
      toast('success', `Extracted ${res.extracted.length} ticket${res.extracted.length !== 1 ? 's' : ''}. Review before submitting.`)
    } catch (err: any) {
      const msg = err?.response?.data?.error ?? err?.message ?? 'AI extraction failed.'
      toast('error', msg)
      setStage('idle')
    }
  }

  const updateTicket = (idx: number, field: keyof ExtractedTicket, val: string) => {
    setTickets(prev => prev.map((t, i) => i === idx ? { ...t, [field]: val } : t))
  }

  const removeTicket = (idx: number) => {
    setTickets(prev => prev.filter((_, i) => i !== idx))
  }

  const handleCreateAll = async () => {
    if (!tickets.length) return
    setStage('creating')

    try {
      const res = await importsApi.confirmPdfImport(tickets, empId.trim())
      setResult(res)
      setStage('done')
      toast('success', `${res.created} ticket${res.created !== 1 ? 's' : ''} created successfully!`)
    } catch (err: any) {
      const msg = err?.response?.data?.error ?? 'Failed to create tickets.'
      toast('error', msg)
      setStage('preview')
    }
  }

  // ── DONE ──────────────────────────────────────────────────────────────────
  if (stage === 'done' && result) {
    return <ImportSuccess result={result} onReset={reset} />
  }

  // ── PREVIEW ───────────────────────────────────────────────────────────────
  if (stage === 'preview' || stage === 'creating') {
    return (
      <div className="space-y-4 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-slate-200">
              {tickets.length} ticket{tickets.length !== 1 ? 's' : ''} extracted
            </p>
            <p className="text-xs text-slate-600 mt-0.5">
              Review and edit before creating. Click a card to expand.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" icon={<X className="h-3.5 w-3.5" />} onClick={reset}>
              Cancel
            </Button>
            <Button
              variant="gradient"
              size="sm"
              icon={stage === 'creating' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              onClick={handleCreateAll}
              disabled={stage === 'creating' || tickets.length === 0}
            >
              {stage === 'creating' ? 'Creating…' : `Create All ${tickets.length} Ticket${tickets.length !== 1 ? 's' : ''}`}
            </Button>
          </div>
        </div>

        {/* Ticket cards */}
        <div className="space-y-2.5 max-h-[440px] overflow-y-auto pr-1">
          {tickets.map((t, i) => (
            <TicketCard
              key={i}
              ticket={t}
              index={i}
              onUpdate={updateTicket}
              onRemove={removeTicket}
            />
          ))}
        </div>

        {tickets.length === 0 && (
          <div className="flex flex-col items-center py-10 gap-3 text-slate-600">
            <AlertTriangle className="h-8 w-8" />
            <p className="text-sm">All tickets removed. Upload another file.</p>
            <Button variant="outline" size="sm" onClick={reset}>Start over</Button>
          </div>
        )}
      </div>
    )
  }

  // ── UPLOAD ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      {/* Info banner */}
      <div
        className="flex items-start gap-3 rounded-xl px-4 py-3"
        style={{ background: 'rgba(6,182,212,0.08)', border: '1px solid rgba(6,182,212,0.15)' }}
      >
        <Brain className="h-5 w-5 text-cyan-400 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-bold text-cyan-300">AI-powered extraction</p>
          <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
            Upload a PDF, screenshot, or image. Our AI (Groq LLaMA3) will extract employee, issue, and severity details automatically.
            Supports multi-issue documents.
          </p>
        </div>
      </div>

      {/* Optional employee ID */}
      <div>
        <label className="text-sm font-medium text-slate-300 mb-1.5 block">
          Employee ID <span className="text-slate-600">(optional — applied to all extracted tickets)</span>
        </label>
        <input
          value={empId}
          onChange={e => setEmpId(e.target.value)}
          placeholder="EMP-001"
          className="input-dark w-full px-3.5"
        />
      </div>

      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => !file && inputRef.current?.click()}
        className={cn(
          'relative flex flex-col items-center justify-center rounded-2xl py-12 transition-all duration-200 cursor-pointer',
          dragOver
            ? 'border-2 border-cyan-500 bg-cyan-500/10 scale-[1.01]'
            : file
            ? 'border-2 border-green-500/50 bg-green-500/5'
            : 'border-2 border-dashed border-white/10 hover:border-cyan-500/40 hover:bg-white/[0.02]',
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED}
          className="sr-only"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
        />

        {file ? (
          <div className="flex flex-col items-center gap-3 text-center px-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-green-500/15 border border-green-500/25">
              <FileText className="h-7 w-7 text-green-400" />
            </div>
            <div>
              <p className="font-bold text-slate-200">{file.name}</p>
              <p className="text-xs text-slate-500 mt-0.5">{(file.size / 1024).toFixed(1)} KB</p>
            </div>
            <button
              type="button"
              onClick={e => { e.stopPropagation(); reset() }}
              className="text-xs text-slate-600 hover:text-red-400 transition-colors underline underline-offset-2"
            >
              Remove file
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 text-center px-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/[0.05] border border-white/10">
              <FileText className="h-7 w-7 text-slate-500" />
            </div>
            <div>
              <p className="font-bold text-slate-300">Drop your PDF or image here</p>
              <p className="text-sm text-slate-600 mt-1">or click to browse</p>
            </div>
            <p className="text-xs text-slate-700">.pdf · .png · .jpg · .jpeg · Max {MAX_MB} MB</p>
          </div>
        )}
      </div>

      {/* Extracting progress */}
      {stage === 'extracting' && (
        <div className="space-y-3 animate-fade-in">
          <div className="flex items-center gap-2.5 rounded-xl px-4 py-3" style={{ background: 'rgba(6,182,212,0.08)', border: '1px solid rgba(6,182,212,0.15)' }}>
            <Loader2 className="h-4 w-4 text-cyan-400 animate-spin shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-cyan-300">AI extracting ticket data…</p>
              <p className="text-xs text-slate-600 mt-0.5">Parsing document and calling Groq LLaMA3</p>
            </div>
          </div>
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-slate-500">
              <span>Processing</span>
              <span className="metric">{progress < 100 ? `${progress}%` : 'Analyzing…'}</span>
            </div>
            <div className="h-1.5 w-full rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
              <div
                className="h-full rounded-full bg-cyan-500 transition-all duration-300"
                style={{ width: stage === 'extracting' ? `${Math.max(progress, 15)}%` : '100%' }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Extract button */}
      <button
        type="button"
        onClick={handleExtract}
        disabled={!file || stage === 'extracting'}
        className={cn(
          'btn-gradient flex h-11 w-full items-center justify-center gap-2 text-sm font-bold text-white rounded-xl',
          (!file || stage === 'extracting') && 'opacity-40 cursor-not-allowed',
        )}
        style={file && stage !== 'extracting' ? { background: 'linear-gradient(135deg, #06B6D4, #4F46E5)' } : undefined}
      >
        {stage === 'extracting' ? (
          <><Loader2 className="h-4 w-4 animate-spin" />Extracting with AI…</>
        ) : (
          <><Brain className="h-4 w-4" />Extract Tickets with AI</>
        )}
      </button>
    </div>
  )
}
