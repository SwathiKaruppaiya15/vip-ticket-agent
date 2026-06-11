import { useCallback, useRef, useState } from 'react'
import {
  Upload, FileSpreadsheet, Download, CheckCircle2, XCircle,
  AlertTriangle, Trash2, ChevronDown, ChevronUp, Loader2,
} from 'lucide-react'
import { cn } from '@/utils/cn'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { importsApi } from '@/api/imports'
import type { ImportResult } from '@/api/imports'

// ── Constants ─────────────────────────────────────────────────────────────────
const ACCEPTED = '.xlsx,.xls,.csv'
const MAX_MB   = 10

// ── Sub-components ────────────────────────────────────────────────────────────

function ProgressBar({ pct }: { pct: number }) {
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs text-slate-500">
        <span>Uploading…</span>
        <span className="metric">{pct}%</span>
      </div>
      <div className="h-1.5 w-full rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
        <div
          className="h-full rounded-full bg-violet-500 transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

function ResultSummary({ result, onReset }: { result: ImportResult; onReset: () => void }) {
  const [showErrors, setShowErrors] = useState(false)
  const allFailed = result.created === 0 && result.failed > 0

  const downloadErrorReport = () => {
    const lines = [
      'Row,Error',
      ...result.errors.map(e => `${e.row},"${e.error.replace(/"/g, '""')}"`),
    ]
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = 'vipulse_import_errors.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total Rows',  value: result.total_rows, color: 'text-slate-300', bg: 'rgba(255,255,255,0.05)' },
          { label: 'Created',     value: result.created,    color: 'text-green-400', bg: 'rgba(34,197,94,0.08)'   },
          { label: 'Failed',      value: result.failed,     color: 'text-red-400',   bg: 'rgba(239,68,68,0.08)'   },
        ].map(s => (
          <div key={s.label} className="rounded-xl p-4 text-center" style={{ background: s.bg, border: '1px solid rgba(255,255,255,0.07)' }}>
            <p className={`metric text-2xl font-extrabold tabular-nums ${s.color}`}>{s.value}</p>
            <p className="text-[11px] text-slate-600 mt-0.5 font-semibold uppercase tracking-wider">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Status message */}
      <div
        className={cn('flex items-center gap-3 rounded-xl px-4 py-3', allFailed ? 'bg-red-500/10 border border-red-500/20' : 'bg-green-500/10 border border-green-500/20')}
      >
        {allFailed
          ? <XCircle className="h-5 w-5 text-red-400 shrink-0" />
          : <CheckCircle2 className="h-5 w-5 text-green-400 shrink-0" />
        }
        <p className={cn('text-sm font-semibold', allFailed ? 'text-red-300' : 'text-green-300')}>
          {result.created > 0
            ? `${result.created} ticket${result.created !== 1 ? 's' : ''} imported successfully!`
            : 'Import failed — no tickets were created.'}
          {result.failed > 0 && result.created > 0 && ` (${result.failed} row${result.failed !== 1 ? 's' : ''} skipped)`}
        </p>
      </div>

      {/* Error list */}
      {result.errors.length > 0 && (
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(239,68,68,0.20)' }}>
          <button
            onClick={() => setShowErrors(v => !v)}
            className="flex w-full items-center justify-between px-4 py-3 text-sm font-semibold text-slate-300 hover:bg-white/[0.03] transition-colors"
            style={{ background: 'rgba(239,68,68,0.06)' }}
          >
            <span className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-400" />
              {result.errors.length} row{result.errors.length !== 1 ? 's' : ''} with errors
            </span>
            {showErrors ? <ChevronUp className="h-4 w-4 text-slate-500" /> : <ChevronDown className="h-4 w-4 text-slate-500" />}
          </button>

          {showErrors && (
            <div className="max-h-52 overflow-y-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    <th className="px-4 py-2 text-left font-bold text-slate-600 uppercase tracking-wider w-16">Row</th>
                    <th className="px-4 py-2 text-left font-bold text-slate-600 uppercase tracking-wider">Error</th>
                  </tr>
                </thead>
                <tbody>
                  {result.errors.map((e, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td className="px-4 py-2 metric font-bold text-red-400">{e.row > 0 ? e.row : '—'}</td>
                      <td className="px-4 py-2 text-slate-400">{e.error}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        {result.errors.length > 0 && (
          <Button variant="outline" size="sm" icon={<Download className="h-3.5 w-3.5" />} onClick={downloadErrorReport}>
            Download Error Report
          </Button>
        )}
        <Button variant="outline" size="sm" icon={<Trash2 className="h-3.5 w-3.5" />} onClick={onReset} className="ml-auto">
          Import Another File
        </Button>
      </div>
    </div>
  )
}

// ── Main ExcelUpload component ────────────────────────────────────────────────
export function ExcelUpload() {
  const { toast } = useToast()

  const [file,       setFile]       = useState<File | null>(null)
  const [dragOver,   setDragOver]   = useState(false)
  const [uploading,  setUploading]  = useState(false)
  const [progress,   setProgress]   = useState(0)
  const [result,     setResult]     = useState<ImportResult | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const reset = () => {
    setFile(null)
    setResult(null)
    setProgress(0)
    if (inputRef.current) inputRef.current.value = ''
  }

  const validateFile = (f: File): string | null => {
    const ext = f.name.toLowerCase().split('.').pop()
    if (!['xlsx', 'xls', 'csv'].includes(ext ?? '')) {
      return 'Unsupported file type. Please upload .xlsx, .xls, or .csv'
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
    setResult(null)
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }, [])

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) handleFile(f)
  }

  const handleImport = async () => {
    if (!file) return
    setUploading(true)
    setProgress(0)

    try {
      const res = await importsApi.importExcel(file, (pct) => setProgress(pct))
      setResult(res)
      if (res.created > 0) {
        toast('success', `${res.created} ticket${res.created !== 1 ? 's' : ''} imported successfully`)
      } else {
        toast('error', 'No tickets were created. Check the error report.')
      }
    } catch (err: any) {
      const msg = err?.response?.data?.error ?? err?.message ?? 'Import failed. Please try again.'
      toast('error', msg)
    } finally {
      setUploading(false)
    }
  }

  if (result) {
    return <ResultSummary result={result} onReset={reset} />
  }

  return (
    <div className="space-y-5">
      {/* Download template */}
      <div
        className="flex items-center justify-between rounded-xl px-4 py-3"
        style={{ background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.15)' }}
      >
        <div>
          <p className="text-sm font-bold text-violet-300">Need the template?</p>
          <p className="text-xs text-slate-600 mt-0.5">Download our sample Excel file with the correct format</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          icon={<Download className="h-3.5 w-3.5" />}
          onClick={() => importsApi.downloadTemplate().catch(() => toast('error', 'Failed to download template'))}
        >
          Download Template
        </Button>
      </div>

      {/* Required columns info */}
      <div className="rounded-xl px-4 py-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Required columns</p>
        <div className="flex flex-wrap gap-1.5">
          {['employee_id','employee_name','role','department','issue_title','issue_description','severity'].map(col => (
            <code key={col} className="text-[11px] font-mono px-2 py-0.5 rounded-md text-violet-300"
              style={{ background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.20)' }}>
              {col}
            </code>
          ))}
        </div>
        <p className="text-[11px] text-slate-600 mt-2">
          Severity: <span className="text-slate-400">low · medium · high · critical</span> (case-insensitive)
        </p>
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
            ? 'border-2 border-violet-500 bg-violet-500/10 scale-[1.01]'
            : file
            ? 'border-2 border-green-500/50 bg-green-500/5'
            : 'border-2 border-dashed border-white/10 hover:border-violet-500/40 hover:bg-white/[0.02]',
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED}
          className="sr-only"
          onChange={onInputChange}
        />

        {file ? (
          <div className="flex flex-col items-center gap-3 text-center px-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-green-500/15 border border-green-500/25">
              <FileSpreadsheet className="h-7 w-7 text-green-400" />
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
              <Upload className="h-7 w-7 text-slate-500" />
            </div>
            <div>
              <p className="font-bold text-slate-300">Drop your Excel file here</p>
              <p className="text-sm text-slate-600 mt-1">or click to browse</p>
            </div>
            <p className="text-xs text-slate-700">.xlsx · .xls · .csv · Max {MAX_MB} MB · Max 1,000 rows</p>
          </div>
        )}
      </div>

      {/* Upload progress */}
      {uploading && <ProgressBar pct={progress} />}

      {/* Import button */}
      <button
        type="button"
        onClick={handleImport}
        disabled={!file || uploading}
        className={cn(
          'btn-gradient flex h-11 w-full items-center justify-center gap-2 text-sm font-bold text-white rounded-xl',
          (!file || uploading) && 'opacity-40 cursor-not-allowed',
        )}
      >
        {uploading ? (
          <><Loader2 className="h-4 w-4 animate-spin" />Importing…</>
        ) : (
          <><FileSpreadsheet className="h-4 w-4" />Import Tickets from Excel</>
        )}
      </button>
    </div>
  )
}
