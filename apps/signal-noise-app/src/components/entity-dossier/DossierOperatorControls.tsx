'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

type DossierOpsPayload = {
  ops?: {
    review_status: 'needs_review' | 'in_review' | 'resolved'
    review_note: string | null
    rerun_reason: string | null
    missing_evidence_summary: string[]
  }
  dossier_status?: string
}

type Props = {
  entityId: string
  dossierStatus: string
}

export function DossierOperatorControls({ entityId, dossierStatus }: Props) {
  const [data, setData] = useState<DossierOpsPayload | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    const load = async () => {
      try {
        const response = await fetch(`/api/entities/${entityId}/dossier/ops`, { cache: 'no-store' })
        if (!response.ok) return
        const payload = await response.json()
        setData(payload)
      } catch {
        setData(null)
      }
    }

    load()
  }, [entityId])

  if (!['stale', 'rerun_needed'].includes(dossierStatus)) {
    return null
  }

  const handleRerun = async () => {
    setIsSubmitting(true)
    try {
      await fetch(`/api/entities/${entityId}/dossier/rerun`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rerun_reason: 'Operator requested refresh from dossier page' }),
      })
      const refreshed = await fetch(`/api/entities/${entityId}/dossier/ops`, { cache: 'no-store' })
      if (refreshed.ok) {
        setData(await refreshed.json())
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleMarkForReview = async () => {
    setIsSubmitting(true)
    try {
      await fetch(`/api/entities/${entityId}/dossier/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          review_status: 'needs_review',
          review_note: 'Marked from the dossier page operator controls.',
        }),
      })
      const refreshed = await fetch(`/api/entities/${entityId}/dossier/ops`, { cache: 'no-store' })
      if (refreshed.ok) {
        setData(await refreshed.json())
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Card id="missing-evidence" className="mb-6 border border-amber-700/40 bg-amber-950/30 text-amber-50 shadow-lg">
      <CardContent className="space-y-4 p-5">
        <div className="space-y-1">
          <div className="text-sm font-semibold uppercase tracking-[0.16em] text-amber-300">Operator controls</div>
          <p className="text-sm leading-6 text-amber-50/85">
            This dossier needs operator attention before it should be treated as a fresh client-facing record.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={handleRerun} disabled={isSubmitting} className="bg-amber-400 text-black hover:bg-amber-300">
            Rerun dossier
          </Button>
          <Button onClick={handleMarkForReview} disabled={isSubmitting} variant="outline" className="border-amber-400/40 bg-amber-500/10 text-amber-100 hover:bg-amber-500/20">
            Mark for review
          </Button>
          <Button asChild variant="ghost" className="text-amber-100 hover:bg-amber-500/10 hover:text-amber-50">
            <Link href={`#missing-evidence`}>Inspect missing evidence</Link>
          </Button>
        </div>

        {data?.ops && (
          <div className="grid gap-3 lg:grid-cols-2">
            <div className="rounded-xl border border-amber-400/20 bg-black/20 p-3">
              <div className="text-xs uppercase tracking-[0.16em] text-amber-200/70">Review state</div>
              <div className="mt-1 text-sm font-semibold text-amber-50">{data.ops.review_status}</div>
              <div className="mt-1 text-sm text-amber-50/75">{data.ops.rerun_reason || data.ops.review_note || 'No operator note yet.'}</div>
            </div>
            <div className="rounded-xl border border-amber-400/20 bg-black/20 p-3">
              <div className="text-xs uppercase tracking-[0.16em] text-amber-200/70">Missing evidence</div>
              <ul className="mt-1 space-y-1 text-sm text-amber-50/75">
                {(data.ops.missing_evidence_summary || []).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default DossierOperatorControls
