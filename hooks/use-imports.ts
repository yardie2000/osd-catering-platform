import { useQuery } from '@tanstack/react-query'
import { importsService } from '@/services/imports.service'

export const IMPORTS_KEY = ['imports'] as const

export function useImportJobs() {
  return useQuery({
    queryKey: IMPORTS_KEY,
    queryFn: () => importsService.getJobs(),
    refetchInterval: 5000,
  })
}

export function useImportJob(id: string) {
  return useQuery({
    queryKey: [...IMPORTS_KEY, id],
    queryFn: () => importsService.getJob(id),
    enabled: !!id,
  })
}

export function useImportLogs(jobId: string) {
  return useQuery({
    queryKey: [...IMPORTS_KEY, jobId, 'logs'],
    queryFn: () => importsService.getLogs(jobId),
    enabled: !!jobId,
  })
}
