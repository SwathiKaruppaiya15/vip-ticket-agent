import apiClient from './client'

interface ApiEnvelope<T> { success: boolean; data: T; message?: string }

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ImportRowError {
  row:   number
  error: string
}

export interface ImportResult {
  total_rows:  number
  created:     number
  failed:      number
  errors:      ImportRowError[]
  ticket_ids:  string[]
}

export interface ExtractedTicket {
  employee_name:     string
  role:              string
  department:        string
  issue_title:       string
  issue_description: string
  severity:          'low' | 'medium' | 'high' | 'critical'
  /** Optional employee_id; user may fill this in */
  employee_id?:      string
}

export interface PdfExtractResult {
  extracted:          ExtractedTicket[]
  total_extracted:    number
  raw_text_preview:   string
  message?:           string
  /** Present when create_immediately=true */
  total_rows?:        number
  created?:           number
  failed?:            number
  errors?:            ImportRowError[]
  ticket_ids?:        string[]
}

// ── API calls ─────────────────────────────────────────────────────────────────

export const importsApi = {
  /**
   * Upload an Excel/CSV file and bulk-create tickets.
   * `onProgress` receives 0–100 percent.
   */
  importExcel: async (
    file: File,
    onProgress?: (pct: number) => void,
  ): Promise<ImportResult> => {
    const form = new FormData()
    form.append('file', file)

    const { data } = await apiClient.post<ApiEnvelope<ImportResult>>(
      '/api/v1/tickets/import/excel',
      form,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (e) => {
          if (onProgress && e.total) {
            onProgress(Math.round((e.loaded / e.total) * 100))
          }
        },
      },
    )
    return data.data
  },

  /**
   * Upload a PDF/image, extract ticket data with AI.
   * If `createImmediately=true`, tickets are created server-side.
   */
  importPdf: async (
    file: File,
    options: {
      employeeId?:       string
      createImmediately?: boolean
      onProgress?:       (pct: number) => void
    } = {},
  ): Promise<PdfExtractResult> => {
    const form = new FormData()
    form.append('file', file)
    if (options.employeeId)       form.append('employee_id', options.employeeId)
    if (options.createImmediately) form.append('create_immediately', 'true')

    const { data } = await apiClient.post<ApiEnvelope<PdfExtractResult>>(
      '/api/v1/tickets/import/pdf',
      form,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (e) => {
          if (options.onProgress && e.total) {
            options.onProgress(Math.round((e.loaded / e.total) * 100))
          }
        },
      },
    )
    return data.data
  },

  /**
   * Confirm a previewed PDF extraction — create tickets from the (possibly edited) list.
   */
  confirmPdfImport: async (
    tickets: ExtractedTicket[],
    employeeId = '',
  ): Promise<ImportResult> => {
    const { data } = await apiClient.post<ApiEnvelope<ImportResult>>(
      '/api/v1/tickets/import/pdf/confirm',
      { employee_id: employeeId, tickets },
    )
    return data.data
  },

  /**
   * Download the sample Excel template.
   */
  downloadTemplate: async (): Promise<void> => {
    const response = await apiClient.get('/api/v1/tickets/template', {
      responseType: 'blob',
    })
    const url  = URL.createObjectURL(new Blob([response.data]))
    const link = document.createElement('a')
    link.href  = url
    link.download = 'vipulse_ticket_template.xlsx'
    link.click()
    URL.revokeObjectURL(url)
  },
}
