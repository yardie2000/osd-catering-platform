import type { DataImportLogInsert, ImportLogSeverity } from '@/types'

export class ImportLogger {
  private logs: DataImportLogInsert[] = []
  private jobId: string

  constructor(jobId: string) {
    this.jobId = jobId
  }

  info(message: string, opts?: Partial<Omit<DataImportLogInsert, 'import_job_id' | 'severity' | 'message'>>) {
    this.log('info', message, opts)
  }

  warn(message: string, opts?: Partial<Omit<DataImportLogInsert, 'import_job_id' | 'severity' | 'message'>>) {
    this.log('warning', message, opts)
  }

  error(message: string, opts?: Partial<Omit<DataImportLogInsert, 'import_job_id' | 'severity' | 'message'>>) {
    this.log('error', message, opts)
  }

  private log(
    severity: ImportLogSeverity,
    message: string,
    opts?: Partial<Omit<DataImportLogInsert, 'import_job_id' | 'severity' | 'message'>>
  ) {
    this.logs.push({
      import_job_id: this.jobId,
      severity,
      message,
      row_number: opts?.row_number ?? null,
      source_sheet: opts?.source_sheet ?? null,
      entity_type: opts?.entity_type ?? null,
      entity_code: opts?.entity_code ?? null,
    })
  }

  getLogs(): DataImportLogInsert[] {
    return this.logs
  }

  getErrorCount(): number {
    return this.logs.filter((l) => l.severity === 'error').length
  }

  getWarningCount(): number {
    return this.logs.filter((l) => l.severity === 'warning').length
  }

  clear() {
    this.logs = []
  }
}
