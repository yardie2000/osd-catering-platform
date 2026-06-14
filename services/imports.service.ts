import { supabase } from '@/lib/supabase/client'
import type { ImportJob, ImportJobInsert, DataImportLog } from '@/types'

export const importsService = {
  async getJobs(): Promise<ImportJob[]> {
    const { data, error } = await supabase
      .from('import_jobs')
      .select('*')
      .order('started_at', { ascending: false })
    if (error) throw error
    return data
  },

  async getJob(id: string): Promise<ImportJob> {
    const { data, error } = await supabase
      .from('import_jobs')
      .select('*')
      .eq('id', id)
      .single()
    if (error) throw error
    return data
  },

  async createJob(payload: ImportJobInsert): Promise<ImportJob> {
    const { data, error } = await supabase
      .from('import_jobs')
      .insert(payload)
      .select()
      .single()
    if (error) throw error
    return data
  },

  async getLogs(jobId: string): Promise<DataImportLog[]> {
    const { data, error } = await supabase
      .from('data_import_log')
      .select('*')
      .eq('import_job_id', jobId)
      .order('created_at')
    if (error) throw error
    return data
  },

  async getLogsBySeverity(
    jobId: string,
    severity: 'info' | 'warning' | 'error'
  ): Promise<DataImportLog[]> {
    const { data, error } = await supabase
      .from('data_import_log')
      .select('*')
      .eq('import_job_id', jobId)
      .eq('severity', severity)
      .order('created_at')
    if (error) throw error
    return data
  },
}
