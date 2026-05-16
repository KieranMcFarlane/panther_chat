import { NextRequest, NextResponse } from 'next/server'

import { requireApiSession, UnauthorizedError } from '@/lib/server-auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type UsageBucket = {
  credits: number | null
  task_count: number | null
}

type ManusUsageSummary = {
  configured: boolean
  available: boolean
  currency: 'credits'
  today: UsageBucket
  month: UsageBucket
  manual_snapshot: ManualCreditSnapshot | null
  usage_sources: Array<'team_usage' | 'task_telemetry' | 'manual_snapshot'>
  recent_tasks: Array<{
    id: string
    title: string | null
    status: string | null
    credit_usage: number | null
    updated_at: string | null
    task_url: string | null
  }>
  budget: {
    monthly_limit: number | null
    estimated_remaining: number | null
    source: 'MANUS_MONTHLY_CREDIT_LIMIT' | 'manual_snapshot' | 'not_configured'
  }
  provider_latency_note?: string
  error?: string
}

type ManualCreditSnapshot = {
  source: 'manual_snapshot'
  plan: string | null
  renewal_date: string | null
  captured_at: string | null
  total_credits: number | null
  free_credits: number | null
  monthly_used: number | null
  monthly_limit: number | null
  monthly_remaining: number | null
  daily_refresh_remaining: number | null
  daily_refresh_limit: number | null
}

export async function GET(request: NextRequest) {
  try {
    await requireApiSession(request)
    return NextResponse.json(await loadManusUsageSummary())
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }

    console.error('Manus usage lookup failed', { error })
    return NextResponse.json(
      buildUnavailableSummary('usage_unavailable', Boolean(process.env.MANUS_API)),
      { status: 200 },
    )
  }
}

async function loadManusUsageSummary(): Promise<ManusUsageSummary> {
  const manusKey = process.env.MANUS_API
  if (!manusKey) {
    return buildUnavailableSummary('manus_api_not_configured', false)
  }

  const now = new Date()
  const startOfToday = new Date(now)
  startOfToday.setHours(0, 0, 0, 0)
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  const [todayResult, monthResult, taskResult] = await Promise.all([
    fetchTeamUsage(manusKey, startOfToday, now),
    fetchTeamUsage(manusKey, startOfMonth, now),
    fetchRecentTasks(manusKey),
  ])

  const taskAvailable = taskResult.ok
  const teamUsageAvailable = todayResult.ok && monthResult.ok
  const manualSnapshot = readManualCreditSnapshot()
  const monthlyLimit = parseMonthlyLimit(process.env.MANUS_MONTHLY_CREDIT_LIMIT)
  const monthCredits = monthResult.ok ? monthResult.bucket.credits : null
  const snapshotMonthlyLimit = manualSnapshot?.monthly_limit ?? null
  const snapshotMonthlyRemaining = manualSnapshot?.monthly_remaining ?? null
  const usageSources: ManusUsageSummary['usage_sources'] = [
    ...(teamUsageAvailable ? ['team_usage' as const] : []),
    ...(taskAvailable ? ['task_telemetry' as const] : []),
    ...(manualSnapshot ? ['manual_snapshot' as const] : []),
  ]

  return {
    configured: true,
    available: taskAvailable || teamUsageAvailable || Boolean(manualSnapshot),
    currency: 'credits',
    today: todayResult.ok ? todayResult.bucket : emptyBucket(),
    month: monthResult.ok ? monthResult.bucket : emptyBucket(),
    manual_snapshot: manualSnapshot,
    usage_sources: usageSources,
    recent_tasks: taskResult.ok ? taskResult.tasks : [],
    budget: {
      monthly_limit: monthlyLimit ?? snapshotMonthlyLimit,
      estimated_remaining:
        monthlyLimit !== null && typeof monthCredits === 'number'
          ? Math.max(0, monthlyLimit - monthCredits)
          : snapshotMonthlyRemaining,
      source:
        monthlyLimit !== null
          ? 'MANUS_MONTHLY_CREDIT_LIMIT'
          : snapshotMonthlyLimit !== null
            ? 'manual_snapshot'
            : 'not_configured',
    },
    provider_latency_note:
      'Manus team usage can be delayed for some Enterprise teams; recent task credits are shown when available.',
    error: teamUsageAvailable ? undefined : taskAvailable ? 'team_usage_unavailable' : 'usage_unavailable',
  }
}

async function fetchTeamUsage(
  manusKey: string,
  start: Date,
  end: Date,
): Promise<{ ok: true; bucket: UsageBucket } | { ok: false; reason: string }> {
  const url = new URL('https://api.manus.ai/v2/usage.teamLog')
  url.searchParams.set('start_date', Math.floor(start.getTime() / 1000).toString())
  url.searchParams.set('end_date', Math.floor(end.getTime() / 1000).toString())
  url.searchParams.set('limit', '100')
  url.searchParams.set('sort_by', 'credits')

  const payload = await fetchJson(url, manusKey)
  if (!payload.ok) {
    return { ok: false, reason: payload.reason }
  }

  const rows = Array.isArray(payload.data?.data) ? payload.data.data : []
  return {
    ok: true,
    bucket: rows.reduce(
      (bucket: UsageBucket, row: any) => ({
        credits: (bucket.credits || 0) + normalizeNumber(row?.credits),
        task_count: (bucket.task_count || 0) + normalizeNumber(row?.task_count),
      }),
      { credits: 0, task_count: 0 },
    ),
  }
}

async function fetchRecentTasks(
  manusKey: string,
): Promise<{ ok: true; tasks: ManusUsageSummary['recent_tasks'] } | { ok: false; reason: string }> {
  const url = new URL('https://api.manus.ai/v2/task.list')
  url.searchParams.set('limit', '10')
  url.searchParams.set('order', 'desc')
  url.searchParams.set('scope', 'standard')

  const payload = await fetchJson(url, manusKey)
  if (!payload.ok) {
    return { ok: false, reason: payload.reason }
  }

  const rows = Array.isArray(payload.data?.data) ? payload.data.data : []
  return {
    ok: true,
    tasks: rows.map((task: any) => ({
      id: toText(task?.id),
      title: nullableText(task?.title),
      status: nullableText(task?.status),
      credit_usage: nullableNumber(task?.credit_usage),
      updated_at: unixSecondsToIso(task?.updated_at),
      task_url: nullableText(task?.task_url),
    })),
  }
}

async function fetchJson(url: URL, manusKey: string): Promise<{ ok: true; data: any } | { ok: false; reason: string }> {
  try {
    const response = await fetch(url, {
      headers: {
        'x-manus-api-key': manusKey,
      },
      cache: 'no-store',
    })
    const data = await response.json().catch(() => null)
    if (!response.ok || data?.ok === false) {
      const reason = toText(data?.error?.code || data?.code || data?.message || data?.error) || `http_${response.status}`
      return { ok: false, reason }
    }
    return { ok: true, data }
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : 'request_failed' }
  }
}

function buildUnavailableSummary(error: string, configured: boolean): ManusUsageSummary {
  const manualSnapshot = readManualCreditSnapshot()
  const monthlyLimit = parseMonthlyLimit(process.env.MANUS_MONTHLY_CREDIT_LIMIT)

  return {
    configured,
    available: Boolean(manualSnapshot),
    currency: 'credits',
    today: emptyBucket(),
    month: emptyBucket(),
    manual_snapshot: manualSnapshot,
    usage_sources: manualSnapshot ? ['manual_snapshot'] : [],
    recent_tasks: [],
    budget: {
      monthly_limit: monthlyLimit ?? manualSnapshot?.monthly_limit ?? null,
      estimated_remaining: manualSnapshot?.monthly_remaining ?? null,
      source: monthlyLimit !== null
        ? 'MANUS_MONTHLY_CREDIT_LIMIT'
        : manualSnapshot?.monthly_limit !== null && manualSnapshot?.monthly_limit !== undefined
          ? 'manual_snapshot'
          : 'not_configured',
    },
    error,
  }
}

function readManualCreditSnapshot(): ManualCreditSnapshot | null {
  const totalCredits = nullableNumber(process.env.MANUS_CREDIT_SNAPSHOT_TOTAL)
  const monthlyUsed = nullableNumber(process.env.MANUS_CREDIT_SNAPSHOT_MONTHLY_USED)
  const monthlyLimit = nullableNumber(process.env.MANUS_CREDIT_SNAPSHOT_MONTHLY_LIMIT)
  const dailyRefreshRemaining = nullableNumber(process.env.MANUS_CREDIT_SNAPSHOT_DAILY_REFRESH_REMAINING)
  const dailyRefreshLimit = nullableNumber(process.env.MANUS_CREDIT_SNAPSHOT_DAILY_REFRESH_LIMIT)

  if (
    totalCredits === null &&
    monthlyUsed === null &&
    monthlyLimit === null &&
    dailyRefreshRemaining === null &&
    dailyRefreshLimit === null
  ) {
    return null
  }

  return {
    source: 'manual_snapshot',
    plan: nullableText(process.env.MANUS_CREDIT_SNAPSHOT_PLAN),
    renewal_date: nullableText(process.env.MANUS_CREDIT_SNAPSHOT_RENEWAL_DATE),
    captured_at: nullableText(process.env.MANUS_CREDIT_SNAPSHOT_CAPTURED_AT),
    total_credits: totalCredits,
    free_credits: nullableNumber(process.env.MANUS_CREDIT_SNAPSHOT_FREE),
    monthly_used: monthlyUsed,
    monthly_limit: monthlyLimit,
    monthly_remaining:
      monthlyLimit !== null && monthlyUsed !== null
        ? Math.max(0, monthlyLimit - monthlyUsed)
        : null,
    daily_refresh_remaining: dailyRefreshRemaining,
    daily_refresh_limit: dailyRefreshLimit,
  }
}

function emptyBucket(): UsageBucket {
  return { credits: null, task_count: null }
}

function parseMonthlyLimit(value: string | undefined): number | null {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function normalizeNumber(value: unknown): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function nullableNumber(value: unknown): number | null {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function nullableText(value: unknown): string | null {
  const text = toText(value)
  return text || null
}

function toText(value: unknown): string {
  return value === null || value === undefined ? '' : String(value).trim()
}

function unixSecondsToIso(value: unknown): string | null {
  const seconds = Number(value)
  if (!Number.isFinite(seconds) || seconds <= 0) return null
  return new Date(seconds * 1000).toISOString()
}
