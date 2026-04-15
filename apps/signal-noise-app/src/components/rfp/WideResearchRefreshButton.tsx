'use client'

import { useState } from 'react'
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
  return [baseYear - 2, baseYear - 1, baseYear, baseYear + 1]
}

type WideResearchRefreshButtonProps = {
  alreadyFoundTitles?: string[]
  defaultTargetYear?: number | null
  yearOptions?: number[]
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
  const excludeTitles = dedupeNames(alreadyFoundTitles)
  const promptPreview = buildWideRfpResearchPrompt({
    currentRfpPage: '/rfps',
    currentIntakePage: '/tenders',
    targetYear: targetYear ? Number(targetYear) : null,
    excludeTitles,
  })

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
          prompt: promptPreview,
          targetYear: targetYear ? Number(targetYear) : null,
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
          ? `Normalized and saved for ${targetYear || 'any year'}: ${payload.result.data.summary.total_opportunities ?? 'unknown'} opportunities`
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
      <Button variant="outline" onClick={handleRefresh} disabled={isRefreshing}>
        <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
        {isRefreshing ? 'Triggering Manus…' : 'Trigger Manus + normalize'}
      </Button>
      <details open className="w-full rounded-md border border-border/60 bg-background/70 px-3 py-2 text-xs text-muted-foreground">
        <summary className="cursor-pointer select-none font-medium text-foreground">
          Prompt preview
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
