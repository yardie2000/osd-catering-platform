'use client'

import { useState, useRef } from 'react'
import { useImportJobs, useImportLogs } from '@/hooks/use-imports'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Separator } from '@/components/ui/separator'
import { Upload, FileUp, CheckCircle, XCircle, AlertTriangle, Clock, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { getErrorMessage } from '@/lib/errors'
import { formatDate } from '@/lib/utils'
import type { ImportJob } from '@/types'

function StatusBadge({ status }: { status: string }) {
  if (status === 'completed') return <Badge variant="success"><CheckCircle className="h-3 w-3 mr-1" />Completed</Badge>
  if (status === 'failed') return <Badge variant="error"><XCircle className="h-3 w-3 mr-1" />Failed</Badge>
  if (status === 'dry_run') return <Badge variant="warning"><Clock className="h-3 w-3 mr-1" />Dry Run</Badge>
  if (status === 'running') return <Badge variant="secondary"><RefreshCw className="h-3 w-3 mr-1 animate-spin" />Running</Badge>
  return <Badge variant="outline">{status}</Badge>
}

function JobLogs({ jobId }: { jobId: string }) {
  const { data: logs = [] } = useImportLogs(jobId)
  return (
    <div className="space-y-1 max-h-64 overflow-y-auto">
      {logs.length === 0 ? (
        <p className="text-sm text-muted-foreground">No log entries.</p>
      ) : (
        logs.map((log) => (
          <div key={log.id} className={`text-xs flex gap-2 p-1.5 rounded ${
            log.severity === 'error' ? 'bg-red-500/10 text-red-400' :
            log.severity === 'warning' ? 'bg-amber-500/10 text-amber-400' :
            'text-muted-foreground'
          }`}>
            <span className="shrink-0 font-mono">{log.row_number != null ? `R${log.row_number}` : '   '}</span>
            <span className="shrink-0">[{log.source_sheet ?? 'sys'}]</span>
            <span>{log.message}</span>
          </div>
        ))
      )}
    </div>
  )
}

export default function ImportsPage() {
  const { data: jobs = [], refetch } = useImportJobs()
  const [selectedJob, setSelectedJob] = useState<ImportJob | null>(null)
  const [uploading, setUploading] = useState(false)
  const [dryRun, setDryRun] = useState(true)
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleUpload(file: File, dry: boolean) {
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('dryRun', String(dry))

      const response = await fetch('/api/imports', {
        method: 'POST',
        body: formData,
      })
      const result = await response.json()

      if (!response.ok) throw new Error(result.error ?? 'Import failed')

      toast.success(
        dry
          ? `Dry run complete — ${result.totalInserted} would be inserted`
          : `Import complete — ${result.totalInserted} inserted, ${result.totalUpdated} updated`
      )
      refetch()
    } catch (e) {
      toast.error(getErrorMessage(e))
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    handleUpload(file, dryRun)
  }

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Import Center"
        description="Upload Excel workbooks to import units, ingredients, recipes, and menus"
      />
      <div className="p-8 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileUp className="h-4 w-4" /> Upload Excel Workbook
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              The workbook must contain sheets named: <code className="text-foreground bg-muted px-1 rounded">units</code>, <code className="text-foreground bg-muted px-1 rounded">ingredients</code>, <code className="text-foreground bg-muted px-1 rounded">recipes</code>, <code className="text-foreground bg-muted px-1 rounded">recipe_ingredients</code>, and optionally <code className="text-foreground bg-muted px-1 rounded">menus</code>.
            </p>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={dryRun}
                  onChange={(e) => setDryRun(e.target.checked)}
                  className="rounded"
                />
                Dry Run (preview only, no changes to database)
              </label>
            </div>
            <div
              className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm font-medium">Click to upload or drag & drop</p>
              <p className="text-xs text-muted-foreground mt-1">.xlsx files only</p>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx"
                className="hidden"
                onChange={onFileChange}
              />
            </div>
            {uploading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <RefreshCw className="h-4 w-4 animate-spin" />
                {dryRun ? 'Running dry run…' : 'Importing…'}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-5">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Import History</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {jobs.length === 0 ? (
                <p className="text-sm text-muted-foreground p-4">No imports yet.</p>
              ) : (
                <div className="divide-y">
                  {jobs.map((job) => (
                    <button
                      key={job.id}
                      onClick={() => setSelectedJob(job)}
                      className={`w-full text-left p-4 hover:bg-accent transition-colors ${selectedJob?.id === job.id ? 'bg-accent' : ''}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{job.filename}</p>
                          <p className="text-xs text-muted-foreground">{formatDate(job.started_at)}</p>
                        </div>
                        <StatusBadge status={job.status} />
                      </div>
                      <div className="mt-1.5 flex gap-3 text-xs text-muted-foreground">
                        <span className="text-emerald-400">↑{job.inserted}</span>
                        <span className="text-blue-400">↻{job.updated}</span>
                        <span className="text-red-400">✗{job.errors}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {selectedJob && (
            <Card className="lg:col-span-3">
              <CardHeader>
                <CardTitle className="text-base">
                  {selectedJob.filename}
                  <span className="ml-2"><StatusBadge status={selectedJob.status} /></span>
                </CardTitle>
                <p className="text-xs text-muted-foreground">{formatDate(selectedJob.started_at)}</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-4 gap-3 text-center">
                  {[
                    { label: 'Total', value: selectedJob.total_rows },
                    { label: 'Inserted', value: selectedJob.inserted, color: 'text-emerald-400' },
                    { label: 'Updated', value: selectedJob.updated, color: 'text-blue-400' },
                    { label: 'Errors', value: selectedJob.errors, color: 'text-red-400' },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="rounded-md bg-muted p-3">
                      <p className={`text-xl font-bold ${color ?? ''}`}>{value}</p>
                      <p className="text-xs text-muted-foreground">{label}</p>
                    </div>
                  ))}
                </div>
                <Separator />
                <div>
                  <p className="text-sm font-medium mb-2">Log</p>
                  <JobLogs jobId={selectedJob.id} />
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
