import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const client = createServerClient()
    const { data: job, error: jobError } = await client
      .from('import_jobs')
      .select('*')
      .eq('id', id)
      .single()

    if (jobError) throw jobError

    const { data: logs, error: logsError } = await client
      .from('data_import_log')
      .select('*')
      .eq('import_job_id', id)
      .order('created_at')

    if (logsError) throw logsError

    return NextResponse.json({ job, logs })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const client = createServerClient()
    const { error } = await client
      .from('import_jobs')
      .update({ status: 'rolled_back' })
      .eq('id', id)

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
