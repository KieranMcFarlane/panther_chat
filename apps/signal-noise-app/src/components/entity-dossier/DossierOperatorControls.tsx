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
  questions?: Array<Record<string, any>>
  dossier?: Record<string, any> | null
}

function toText(value: unknown): string {
  return String(value ?? '').trim()
}

type QueueFeedback = {
  reusedBatchId: string | null
  queuedBatchId: string | null
}

function formatRepairState(value: string): string {
  if (value === 'queued') return 'Auto-repair queued'
  if (value === 'repairing') return 'Repairing'
  if (value === 'exhausted') return 'Exhausted'
  return 'Idle'
}

function formatReconciliationState(value: string): string {
  if (value === 'pending') return 'Reconciliation pending'
  if (value === 'retrying') return 'Reconciliation pending'
  if (value === 'exhausted') return 'Exhausted'
  return 'Healthy'
}

const REPAIR_CHAINS = [
  ['q11_decision_owner', 'q12_connections', 'q15_outreach_strategy'],
  ['q7_procurement_signal', 'q8_explicit_rfp', 'q13_capability_gap', 'q14_yp_fit', 'q15_outreach_strategy'],
] as const

function getQuestionState(question: Record<string, any>): string {
  return toText(
    question?.terminal_state
    || question?.question_first_answer?.terminal_state
    || question?.answer?.terminal_state
    || question?.validation_state
    || question?.question_first_answer?.validation_state,
  ).toLowerCase()
}

function isRepairableQuestion(question: Record<string, any> | null | undefined): boolean {
  if (!question) return false
  const state = getQuestionState(question)
  return state === 'blocked' || state === 'no_signal'
}

function deriveRecommendedRepairChains(questions: Array<Record<string, any>>) {
  const questionMap = new Map(
    questions
      .map((question) => [toText(question?.question_id), question] as const)
      .filter(([questionId]) => Boolean(questionId)),
  )

  return REPAIR_CHAINS
    .map((questionIds) => {
      const rootQuestionId = questionIds[0]
      const rootQuestion = questionMap.get(rootQuestionId)
      if (!isRepairableQuestion(rootQuestion)) {
        return null
      }
      const blockedSteps = questionIds.filter((questionId) => isRepairableQuestion(questionMap.get(questionId)))
      if (blockedSteps.length === 0) {
        return null
      }
      return {
        rootQuestionId,
        blockedSteps,
        chainLabel: questionIds.join(' -> '),
      }
    })
    .filter(Boolean)
}

function getRepairRun(dossier: Record<string, any> | null | undefined): Record<string, any> | null {
  const candidates = [
    dossier?.question_first_run?.repair_run,
    dossier?.question_first?.repair_run,
    dossier?.metadata?.question_first?.repair_run,
  ]
  for (const candidate of candidates) {
    if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) {
      return candidate as Record<string, any>
    }
  }
  return null
}

export function DossierOperatorControls({ entityId, dossierStatus, questions = [], dossier = null }: Props) {
  const [data, setData] = useState<DossierOpsPayload | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [queueFeedback, setQueueFeedback] = useState<QueueFeedback | null>(null)

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

  if (!['stale', 'rerun_needed', 'blocked', 'partial'].includes(dossierStatus)) {
    return null
  }

  const recommendedRepairChains = deriveRecommendedRepairChains(questions)
  const repairCandidates = questions
    .filter((question) => isRepairableQuestion(question))
    .slice(0, 3)
  const repairRun = getRepairRun(dossier)
  const metadataQuestionFirst = (dossier?.metadata?.question_first && typeof dossier.metadata.question_first === 'object')
    ? dossier.metadata.question_first as Record<string, any>
    : {}
  const publicationStatus = toText(
    metadataQuestionFirst.publication_status
    || metadataQuestionFirst.publish_status
    || dossier?.question_first?.publication_status
    || dossier?.question_first?.publish_status
    || dossier?.publish_status,
  ) || 'unknown'
  const publicationMode = toText(
    metadataQuestionFirst.publication_mode
    || dossier?.question_first?.publication_mode
    || (repairRun ? 'repair' : 'full'),
  ) || 'full'
  const reconcileRequired = Boolean(
    metadataQuestionFirst.reconcile_required
    || dossier?.question_first?.reconcile_required
    || dossier?.reconcile_required,
  )
  const repairedQuestionIds = Array.isArray(repairRun?.repaired_question_ids)
    ? repairRun.repaired_question_ids.map((value: unknown) => toText(value)).filter(Boolean)
    : []
  const repairState = toText(metadataQuestionFirst.repair_state || dossier?.question_first?.repair_state || dossier?.repair_state).toLowerCase() || 'idle'
  const repairRetryCount = Number(
    metadataQuestionFirst.repair_retry_count
    ?? dossier?.question_first?.repair_retry_count
    ?? dossier?.repair_retry_count
    ?? 0,
  )
  const repairRetryBudget = Number(
    metadataQuestionFirst.repair_retry_budget
    ?? dossier?.question_first?.repair_retry_budget
    ?? dossier?.repair_retry_budget
    ?? 0,
  )
  const nextRepairQuestionId = toText(
    metadataQuestionFirst.next_repair_question_id
    || dossier?.question_first?.next_repair_question_id
    || dossier?.next_repair_question_id,
  ) || null
  const reconciliationState = toText(
    metadataQuestionFirst.reconciliation_state
    || dossier?.question_first?.reconciliation_state
    || dossier?.reconciliation_state,
  ).toLowerCase() || 'healthy'

  const refreshOperatorState = async () => {
    const refreshed = await fetch(`/api/entities/${entityId}/dossier/ops`, { cache: 'no-store' })
    if (refreshed.ok) {
      setData(await refreshed.json())
    }
  }

  const submitRerun = async (body: Record<string, unknown>) => {
    setIsSubmitting(true)
    try {
      const response = await fetch(`/api/entities/${entityId}/dossier/rerun`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (response.ok) {
        const payload = await response.json()
        setQueueFeedback({
          reusedBatchId: toText(payload?.reused_batch_id) || null,
          queuedBatchId: toText(payload?.batch_id) || null,
        })
      }
      await refreshOperatorState()
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleRerun = async () => {
    await submitRerun({ rerun_reason: 'Operator requested refresh from dossier page' })
  }

  const handleRepairQuestion = async (questionId: string) => {
    await submitRerun({
      mode: 'question',
      question_id: questionId,
      cascade_dependents: true,
      rerun_reason: `Operator requested question repair for ${questionId}`,
    })
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
          {repairCandidates.map((question) => (
            <Button
              key={toText(question?.question_id)}
              onClick={() => handleRepairQuestion(toText(question?.question_id))}
              disabled={isSubmitting}
              variant="outline"
              className="border-sky-400/40 bg-sky-500/10 text-sky-100 hover:bg-sky-500/20"
            >
              Repair question {toText(question?.question_id)}
            </Button>
          ))}
          <Button onClick={handleMarkForReview} disabled={isSubmitting} variant="outline" className="border-amber-400/40 bg-amber-500/10 text-amber-100 hover:bg-amber-500/20">
            Mark for review
          </Button>
          <Button asChild variant="ghost" className="text-amber-100 hover:bg-amber-500/10 hover:text-amber-50">
            <Link href={`#missing-evidence`}>Inspect missing evidence</Link>
          </Button>
        </div>

        {(recommendedRepairChains.length > 0 || repairRun || queueFeedback || data?.ops) && (
          <div className="grid gap-3 lg:grid-cols-2">
            {recommendedRepairChains.length > 0 ? (
              <div className="rounded-xl border border-sky-400/20 bg-black/20 p-3">
                <div className="text-xs uppercase tracking-[0.16em] text-sky-200/70">Recommended repairs</div>
                <div className="mt-2 space-y-3 text-sm text-sky-50/85">
                  {recommendedRepairChains.map((chain) => (
                    <div key={chain.rootQuestionId} className="rounded-lg border border-sky-400/10 bg-sky-500/5 p-3">
                      <div className="font-semibold text-sky-100">Blocker chain</div>
                      <div className="mt-1 text-xs uppercase tracking-[0.14em] text-sky-200/70">{chain.chainLabel}</div>
                      <div className="mt-2 text-xs text-sky-100/80">
                        Repairing {chain.rootQuestionId} will cascade across {chain.blockedSteps.join(', ')}.
                      </div>
                      <Button
                        onClick={() => handleRepairQuestion(chain.rootQuestionId)}
                        disabled={isSubmitting}
                        variant="outline"
                        className="mt-3 border-sky-400/30 bg-sky-500/10 text-sky-100 hover:bg-sky-500/20"
                      >
                        Repair question {chain.rootQuestionId}
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {repairRun || queueFeedback || repairState !== 'idle' ? (
              <div className="rounded-xl border border-emerald-400/20 bg-black/20 p-3">
                <div className="text-xs uppercase tracking-[0.16em] text-emerald-200/70">Repair provenance</div>
                <div className="mt-2 space-y-1 text-sm text-emerald-50/80">
                  <div>{formatRepairState(repairState)}</div>
                  <div>retry budget: {repairRetryCount}/{repairRetryBudget || 0}</div>
                  <div>next repair root: {nextRepairQuestionId || 'n/a'}</div>
                  <div>publication mode: {publicationMode}</div>
                  <div>publication status: {publicationStatus}</div>
                  <div>reconcile_required: {reconcileRequired ? 'true' : 'false'}</div>
                  <div>{formatReconciliationState(reconciliationState)}</div>
                  <div>repair_source_run_id: {toText(repairRun?.repair_source_run_id) || 'n/a'}</div>
                  <div>repair_source_run_path: {toText(repairRun?.repair_source_run_path) || 'n/a'}</div>
                  <div>repaired_question_ids: {repairedQuestionIds.length > 0 ? repairedQuestionIds.join(', ') : 'n/a'}</div>
                  {queueFeedback?.reusedBatchId ? <div>reused_batch_id: {queueFeedback.reusedBatchId}</div> : null}
                  {!queueFeedback?.reusedBatchId && queueFeedback?.queuedBatchId ? <div>queued_batch_id: {queueFeedback.queuedBatchId}</div> : null}
                  {publicationStatus === 'published_degraded' ? <div>published_degraded: secondary reconciliation is still pending.</div> : null}
                </div>
              </div>
            ) : null}

            {data?.ops ? (
            <div className="rounded-xl border border-amber-400/20 bg-black/20 p-3">
              <div className="text-xs uppercase tracking-[0.16em] text-amber-200/70">Review state</div>
              <div className="mt-1 text-sm font-semibold text-amber-50">{data.ops.review_status}</div>
              <div className="mt-1 text-sm text-amber-50/75">{data.ops.rerun_reason || data.ops.review_note || 'No operator note yet.'}</div>
            </div>
            ) : null}
            {data?.ops ? (
            <div className="rounded-xl border border-amber-400/20 bg-black/20 p-3">
              <div className="text-xs uppercase tracking-[0.16em] text-amber-200/70">Missing evidence</div>
              <ul className="mt-1 space-y-1 text-sm text-amber-50/75">
                {(data.ops.missing_evidence_summary || []).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default DossierOperatorControls
