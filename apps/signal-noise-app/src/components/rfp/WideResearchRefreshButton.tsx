'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw } from 'lucide-react'

import { Button } from '@/components/ui/button'

function toText(value: unknown): string {
  return value === null || value === undefined ? '' : String(value).trim()
}

export function WideResearchRefreshButton() {
  const router = useRouter()
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleRefresh = async () => {
    if (isRefreshing) return

    setIsRefreshing(true)
    setError(null)

    try {
      const response = await fetch('/api/rfp-wide-research/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok || payload?.ok === false) {
        throw new Error(toText(payload?.reason || payload?.error) || `Refresh failed with ${response.status}`)
      }
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh wide research')
    } finally {
      setIsRefreshing(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="outline" onClick={handleRefresh} disabled={isRefreshing}>
        <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
        {isRefreshing ? 'Refreshing…' : 'Refresh wide research'}
      </Button>
      {error ? <span className="text-xs text-amber-500">{error}</span> : null}
    </div>
  )
}
