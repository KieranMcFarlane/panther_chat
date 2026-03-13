import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-client'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const limit = Math.min(Math.max(Number.parseInt(searchParams.get('limit') || '50', 10), 1), 200)
    const status = (searchParams.get('status') || 'all').toLowerCase()
    const trigger = (searchParams.get('trigger') || '').trim()

    const supabase = getSupabaseAdmin()
    let query = supabase
      .from('canonical_maintenance_audit')
      .select('id,sync_run_id,trigger,status,started_at,completed_at,duration_ms,steps,error_message,metadata,created_at')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (status !== 'all') {
      query = query.eq('status', status)
    }
    if (trigger) {
      query = query.eq('trigger', trigger)
    }

    const { data, error } = await query
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const rows = data || []
    return NextResponse.json({
      rows,
      total: rows.length,
      filters: { limit, status, trigger: trigger || 'all' },
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch canonical maintenance audit rows' },
      { status: 500 },
    )
  }
}
