'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { buildWideRfpResearchPrompt } from '@/lib/rfp-wide-research-prompt.mjs'

function toText(value: unknown): string {
  return value === null || value === undefined ? '' : String(value).trim()
}

function dedupeNames(values: string[]): string[] {
  const seen = new Set<string>()
  const names: string[] = []

  for (const value of values) {
    const name = toText(value)
    if (!name) continue
    const key = name.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    names.push(name)
  }

  return names
}

function buildYearOptions(baseYear = new Date().getFullYear()): number[] {
  const years = new Set<number>([2024, 2025, 2026, baseYear, baseYear + 1])
  return Array.from(years).sort((a, b) => a - b)
}

type ResearchDepth = 'safe' | 'standard' | 'deep'

type WideResearchRefreshButtonProps = {
  alreadyFoundTitles?: string[]
  defaultTargetYear?: number | null
  yearOptions?: number[]
}

type ManusUsageSummary = {
  configured?: boolean
  available?: boolean
  today?: { credits?: number | null; task_count?: number | null }
  month?: { credits?: number | null; task_count?: number | null }
  manual_snapshot?: {
    plan?: string | null
    renewal_date?: string | null
    captured_at?: string | null
    total_credits?: number | null
    free_credits?: number | null
    monthly_used?: number | null
    monthly_limit?: number | null
    monthly_remaining?: number | null
    daily_refresh_remaining?: number | null
    daily_refresh_limit?: number | null
  } | null
  recent_tasks?: Array<{
    id?: string
    title?: string | null
    status?: string | null
    credit_usage?: number | null
  }>
  budget?: {
    monthly_limit?: number | null
    estimated_remaining?: number | null
  }
  error?: string
}

export function WideResearchRefreshButton({
  alreadyFoundTitles = [],
  defaultTargetYear = new Date().getFullYear(),
  yearOptions = buildYearOptions(defaultTargetYear || new Date().getFullYear()),
}: WideResearchRefreshButtonProps) {
  const router = useRouter()
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [targetYear, setTargetYear] = useState<string>(defaultTargetYear ? String(defaultTargetYear) : '')
  const [researchMode, setResearchMode] = useState<'live' | 'backtest'>('live')
  const [researchDepth, setResearchDepth] = useState<ResearchDepth>('safe')
  const [usage, setUsage] = useState<ManusUsageSummary | null>(null)
  const [usageError, setUsageError] = useState<string | null>(null)
  const [isLoadingUsage, setIsLoadingUsage] = useState(false)
  const excludeTitles = dedupeNames(alreadyFoundTitles)
  const promptPreview = buildWideRfpResearchPrompt({
    currentRfpPage: '/rfps',
    currentIntakePage: '/rfps',
    targetYear: targetYear ? Number(targetYear) : null,
    researchMode,
    researchDepth,
    excludeTitles,
  })

  const refreshUsage = useCallback(async () => {
    setIsLoadingUsage(true)
    setUsageError(null)

    try {
      const response = await fetch('/api/admin/manus-usage', { cache: 'no-store' })
      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(toText(payload?.error) || `Usage lookup failed with ${response.status}`)
      }
      setUsage(payload)
      if (payload?.available === false) {
        setUsageError(toText(payload?.error) || 'Usage unavailable')
      }
    } catch (err) {
      setUsage(null)
      setUsageError(err instanceof Error ? err.message : 'Usage unavailable')
    } finally {
      setIsLoadingUsage(false)
    }
  }, [])

  useEffect(() => {
    void refreshUsage()
  }, [refreshUsage])

  const handleRefresh = async () => {
    if (isRefreshing) return

    setIsRefreshing(true)
    setError(null)
    setStatus(null)

    try {
      const response = await fetch('/api/rfp-wide-research/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          targetYear: targetYear ? Number(targetYear) : null,
          researchMode,
          researchDepth,
          maxKnownUrls: 75,
          excludeNames: excludeTitles,
          excludeTitles,
        }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok || payload?.ok === false) {
        throw new Error(toText(payload?.reason || payload?.error) || `Refresh failed with ${response.status}`)
      }
      setStatus(
        payload?.result?.data?.summary
          ? `Normalized and saved for ${targetYear || 'any year'} (${researchMode}): ${payload.result.data.summary.total_opportunities ?? 'unknown'} opportunities`
          : 'Normalized and saved to the canonical batch',
      )
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh wide research')
    } finally {
      setIsRefreshing(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>Target year</span>
        <select
          className="h-9 rounded-md border border-border bg-background px-2 text-sm text-foreground"
          value={targetYear}
          onChange={(event) => setTargetYear(event.target.value)}
          disabled={isRefreshing}
          aria-label="Target year for Manus prompt"
        >
          <option value="">Any year</option>
          {dedupeNames(yearOptions.map(String)).map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>Manual run mode</span>
        <select
          className="h-9 rounded-md border border-border bg-background px-2 text-sm text-foreground"
          value={researchMode}
          onChange={(event) => setResearchMode(event.target.value === 'backtest' ? 'backtest' : 'live')}
          disabled={isRefreshing}
          aria-label="Manual Manus research mode"
        >
          <option value="live">Live scout</option>
          <option value="backtest">Backtest</option>
        </select>
      </label>
      <Button variant="outline" onClick={handleRefresh} disabled={isRefreshing}>
        <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
        {isRefreshing ? 'Triggering Manus…' : 'Run Manus scout now'}
      </Button>
      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>Run depth</span>
        <select
          className="h-9 rounded-md border border-border bg-background px-2 text-sm text-foreground"
          value={researchDepth}
          onChange={(event) => setResearchDepth(normalizeResearchDepth(event.target.value))}
          disabled={isRefreshing}
          aria-label="Manual Manus run depth"
        >
          <option value="safe">Safe</option>
          <option value="standard">Standard</option>
          <option value="deep">Deep</option>
        </select>
      </label>
      <div className="w-full rounded-md border border-border/60 bg-background/70 px-3 py-3 text-xs text-muted-foreground">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="font-medium text-foreground">Manus usage</p>
            <p>Recent tasks come from Manus telemetry. Pro balance can use a manual snapshot when team usage is unavailable.</p>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={refreshUsage} disabled={isLoadingUsage}>
            <RefreshCw className={`mr-2 h-3.5 w-3.5 ${isLoadingUsage ? 'animate-spin' : ''}`} />
            Refresh usage
          </Button>
        </div>
        {usageError ? <p className="mt-2 text-amber-500">Usage unavailable: {usageError}</p> : null}
        {usage?.manual_snapshot ? (
          <div className="mt-3 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-medium text-foreground">Manual Pro snapshot</p>
                <p>
                  {usage.manual_snapshot.plan || 'Manus Pro'}
                  {usage.manual_snapshot.renewal_date ? ` · renews ${usage.manual_snapshot.renewal_date}` : ''}
                </p>
              </div>
              {usage.manual_snapshot.captured_at ? (
                <span className="text-[11px] uppercase tracking-wide">Captured {usage.manual_snapshot.captured_at}</span>
              ) : null}
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <SnapshotMetric
                label="Total credits"
                value={usage.manual_snapshot.total_credits}
                helper={`Free credits: ${formatCredits(usage.manual_snapshot.free_credits)}`}
              />
              <SnapshotMetric
                label="Monthly credits"
                value={usage.manual_snapshot.monthly_remaining}
                helper={`${formatCredits(usage.manual_snapshot.monthly_used)} used of ${formatCredits(usage.manual_snapshot.monthly_limit)}`}
              />
              <SnapshotMetric
                label="Daily refresh"
                value={usage.manual_snapshot.daily_refresh_remaining}
                helper={`Refreshes to ${formatCredits(usage.manual_snapshot.daily_refresh_limit)} daily`}
              />
            </div>
          </div>
        ) : null}
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <UsageMetric label="Today" credits={usage?.today?.credits} taskCount={usage?.today?.task_count} />
          <UsageMetric label="This month" credits={usage?.month?.credits} taskCount={usage?.month?.task_count} />
          <div className="rounded-md border border-border/50 px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Estimated remaining</p>
            <p className="mt-1 text-sm font-medium text-foreground">
              {formatCredits(usage?.budget?.estimated_remaining)}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {typeof usage?.budget?.monthly_limit === 'number'
                ? `of ${usage.budget.monthly_limit.toLocaleString()} monthly credits`
                : 'Configure MANUS_MONTHLY_CREDIT_LIMIT'}
            </p>
          </div>
        </div>
        <div className="mt-3">
          <p className="font-medium text-foreground">Latest Manus tasks</p>
          {usage?.recent_tasks?.length ? (
            <ul className="mt-2 space-y-1">
              {usage.recent_tasks.slice(0, 3).map((task, index) => (
                <li key={task.id || index} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted/40 px-2 py-1">
                  <span className="min-w-0 flex-1 truncate">{task.title || task.id || 'Untitled Manus task'}</span>
                  <span className="text-foreground">{formatCredits(task.credit_usage)}</span>
                  <span className="uppercase tracking-wide">{task.status || 'unknown'}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1">No recent task credit data available.</p>
          )}
        </div>
      </div>
      <details open className="w-full rounded-md border border-border/60 bg-background/70 px-3 py-2 text-xs text-muted-foreground">
        <summary className="cursor-pointer select-none font-medium text-foreground">
          Prompt preview (server adds delta memory at run time)
        </summary>
        <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap break-words text-[11px] leading-5 text-muted-foreground">
          {promptPreview}
        </pre>
      </details>
      {status ? <span className="text-xs text-emerald-500">{status}</span> : null}
      {error ? <span className="text-xs text-amber-500">{error}</span> : null}
    </div>
  )
}

function UsageMetric({
  label,
  credits,
  taskCount,
}: {
  label: string
  credits?: number | null
  taskCount?: number | null
}) {
  return (
    <div className="rounded-md border border-border/50 px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium text-foreground">{formatCredits(credits)}</p>
      <p className="mt-1 text-[11px] text-muted-foreground">{formatTasks(taskCount)}</p>
    </div>
  )
}

function SnapshotMetric({
  label,
  value,
  helper,
}: {
  label: string
  value?: number | null
  helper: string
}) {
  return (
    <div className="rounded-md border border-border/50 bg-background/50 px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium text-foreground">{formatCredits(value)}</p>
      <p className="mt-1 text-[11px] text-muted-foreground">{helper}</p>
    </div>
  )
}

function formatCredits(value?: number | null): string {
  return typeof value === 'number' ? `${value.toLocaleString()} credits` : 'Unavailable'
}

function formatTasks(value?: number | null): string {
  return typeof value === 'number' ? `${value.toLocaleString()} tasks` : 'task count unavailable'
}

function normalizeResearchDepth(value: string): ResearchDepth {
  return value === 'standard' || value === 'deep' ? value : 'safe'
}
