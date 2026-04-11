'use client'

import { useEffect, useState } from 'react'
import { BarChart3, ChevronDown, ChevronUp, PauseCircle, PlayCircle } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  getCachedOperationalDrilldownPayload,
  loadOperationalDrilldownPayload,
  refreshOperationalDrilldownPayload,
  primeOperationalDrilldownPayload,
  type OperationalDrilldownPayload,
} from '@/lib/operational-drilldown-client'
import { resolvePipelineStartTarget, type OperationalStartSection } from '@/lib/operational-start-target'

interface OperationalStatusStripProps {
  drawerOpen: boolean
  activeSection: OperationalStartSection
  onToggleDrawer: () => void
}
export function OperationalStatusStrip({
  drawerOpen,
  activeSection,
  onToggleDrawer,
}: OperationalStatusStripProps) {
  const [drilldown, setDrilldown] = useState<OperationalDrilldownPayload | null>(null)
  const [controlState, setControlState] = useState<OperationalDrilldownPayload['control'] | null>(null)
  const [isTogglingPipeline, setIsTogglingPipeline] = useState(false)
  const [isExpanded, setIsExpanded] = useState(true)

  function formatRunningDuration(value: string | null | undefined) {
    if (!value) return 'running for unknown duration'
    const timestamp = new Date(value).getTime()
    if (Number.isNaN(timestamp)) return 'running for unknown duration'
    const elapsedMs = Math.max(0, Date.now() - timestamp)
    const minutes = Math.floor(elapsedMs / 60000)
    const hours = Math.floor(minutes / 60)
    if (hours > 0) {
      const remainingMinutes = minutes % 60
      return `running for ${hours}h ${remainingMinutes}m`
    }
    if (minutes > 0) {
      return `running for ${minutes}m`
    }
    return `running for ${Math.max(1, Math.floor(elapsedMs / 1000))}s`
  }

  function formatQuestionProgress(questionId: string | null | undefined) {
    if (!questionId) return 'Question unavailable'
    const match = String(questionId).match(/q(\d+)/i)
    if (!match) return `Question ${questionId}`
    return `Question ${Number(match[1])} of 15`
  }

  useEffect(() => {
    let cancelled = false
    void fetch('/api/home/pipeline-control', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) return null
        const payload = await response.json()
        return payload?.control ?? null
      })
      .then((control) => {
        if (!cancelled && control) {
          setControlState(control)
        }
      })
      .catch(() => {
        // keep the default state
      })

    primeOperationalDrilldownPayload()
    const cachedPayload = getCachedOperationalDrilldownPayload()
    if (cachedPayload && !cancelled) {
      setDrilldown(cachedPayload)
    }
    void loadOperationalDrilldownPayload()
      .then((payload) => {
        if (!cancelled) {
          setDrilldown(payload)
          setControlState(payload.control ?? null)
        }
      })
      .catch(() => {
        // leave summary fallback in place
      })

    return () => {
      cancelled = true
    }
  }, [])

  const inProgressEntity = drilldown?.queue?.in_progress_entity ?? null
  const queuedEntityCount = drilldown?.queue?.upcoming_entities?.length ?? 0
  const pipelinePaused = controlState?.is_paused === true
  const ignitionState = controlState?.transition_state
    || controlState?.observed_state
    || (pipelinePaused ? 'paused' : 'running')
  const repairFocus = Boolean(
    inProgressEntity && (
      inProgressEntity.repair_state === 'repairing'
      || inProgressEntity.next_repair_status === 'running'
    ),
  )
  const playerStatusLabel = pipelinePaused
    ? 'Paused'
    : repairFocus
      ? 'Repairing'
      : inProgressEntity
        ? 'Now playing'
        : 'Waiting'
  const activeQuestionLabel = inProgressEntity
    ? formatQuestionProgress(inProgressEntity.current_question_id || inProgressEntity.active_question_id)
    : null
  const liveEntityTicker = inProgressEntity
    ? `${repairFocus ? 'Repairing' : 'Now playing'} — ${inProgressEntity.entity_name} — Enrichment — ${activeQuestionLabel ?? 'Question unavailable'} — Pipeline Active — ${formatRunningDuration(inProgressEntity.started_at || inProgressEntity.generated_at)}`
    : pipelinePaused
      ? 'Paused'
      : queuedEntityCount > 0
        ? `Waiting for claimable work — ${queuedEntityCount} queued entities`
        : 'Waiting for claimable work.'
  const compactTicker = liveEntityTicker
  const loopStatus = drilldown?.loop_status
  const statusItems = [
    {
      label: 'Entities active',
      value: String(loopStatus?.total_scheduled ?? '…'),
      tone: 'text-white',
    },
    {
      label: 'Pipeline live',
      value: String(loopStatus?.runtime_counts?.running ?? '…'),
      tone: 'text-sky-300',
    },
    {
      label: 'Blocked',
      value: String(loopStatus?.quality_counts?.blocked ?? '…'),
      tone: 'text-amber-300',
    },
    {
      label: 'Recent completions',
      value: String(loopStatus?.completed ?? '…'),
      tone: 'text-emerald-300',
    },
  ] as const

  async function togglePipelinePaused() {
    setIsTogglingPipeline(true)
    try {
      if (pipelinePaused) {
        const startTarget = resolvePipelineStartTarget({
          activeSection,
          drilldown,
        })
        if (startTarget) {
          const response = await fetch(`/api/entities/${encodeURIComponent(startTarget.entityId)}/dossier/rerun`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              mode: startTarget.mode,
              question_id: startTarget.questionId,
              cascade_dependents: true,
              rerun_reason: 'Pipeline start from Live Ops',
            }),
          })
          if (!response.ok) {
            throw new Error(`Failed to queue start target (${response.status})`)
          }
        }
      }

      const response = await fetch('/api/home/pipeline-control', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: pipelinePaused ? 'start' : 'stop',
          is_paused: !pipelinePaused,
          pause_reason: !pipelinePaused ? 'Paused from Live Ops' : null,
        }),
      })
      if (!response.ok) {
        throw new Error(`Failed to update pipeline control (${response.status})`)
      }
      const payload = await response.json()
      const refreshedPayload = await refreshOperationalDrilldownPayload()
      setDrilldown(refreshedPayload)
      setControlState(refreshedPayload.control ?? payload?.control ?? null)
    } catch {
      setControlState((current) => current)
    } finally {
      setIsTogglingPipeline(false)
    }
  }

  return (
    <section
      className="overflow-hidden rounded-2xl border border-custom-border bg-custom-box px-4 shadow-sm transition-[max-height] duration-300 ease-out"
      style={{ maxHeight: isExpanded ? '40rem' : '7rem' }}
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4 xl:justify-items-start">
            {statusItems.map((item) => (
              <button
                key={item.label}
                type="button"
                className="min-w-[146px] rounded-lg border border-custom-border bg-custom-bg/70 px-2.5 py-2 text-left transition hover:border-white/30"
              >
                <div className="text-[0.55rem] uppercase tracking-[0.14em] text-slate-300">{item.label}</div>
                <div className={`mt-0.5 text-lg font-semibold leading-none ${item.tone}`}>{item.value}</div>
              </button>
            ))}
          </div>

          <div className="flex min-w-0 flex-1 flex-col gap-2 xl:pl-3">
            <div className="flex items-center gap-2 overflow-hidden rounded-full border border-custom-border bg-custom-bg/70 px-3 py-2">
              <Badge variant="outline" className="shrink-0 border-sky-500/30 text-sky-300">
                {playerStatusLabel}
              </Badge>
              <div className="min-w-0 overflow-hidden">
                <div className="animate-marquee flex w-max items-center gap-8 whitespace-nowrap text-[0.72rem] font-medium uppercase tracking-[0.12em] text-fm-light-grey">
                  <span>{compactTicker}</span>
                  <span aria-hidden="true">{compactTicker}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2">
              <span className="text-[0.55rem] uppercase tracking-[0.16em] text-slate-400">Transport</span>
              <Button
                variant="outline"
                className="h-9 border-custom-border px-3 py-1.5"
                onClick={togglePipelinePaused}
                disabled={isTogglingPipeline}
                aria-label={pipelinePaused ? 'Start pipeline' : 'Stop intake'}
                title={pipelinePaused ? 'Start pipeline' : 'Stop intake'}
              >
                {pipelinePaused ? <PlayCircle className="mr-2 h-4 w-4" /> : <PauseCircle className="mr-2 h-4 w-4" />}
                {pipelinePaused ? 'Start' : 'Stop'}
              </Button>
              <Button
                variant="outline"
                className="h-9 border-custom-border px-3 py-1.5"
                onClick={() => setIsExpanded((current) => !current)}
                aria-expanded={isExpanded}
                aria-label={isExpanded ? 'Minimize live ops header' : 'Expand live ops header'}
                title={isExpanded ? 'Minimize' : 'Expand'}
              >
                {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                <span className="sr-only">{isExpanded ? 'Minimize' : 'Expand'}</span>
              </Button>
              <Button
                variant="outline"
                className="h-9 border-custom-border px-3 py-1.5"
                onClick={onToggleDrawer}
                aria-label={drawerOpen ? 'Hide run details' : 'Show run details'}
                title={drawerOpen ? 'Hide run details' : 'Show run details'}
              >
                <BarChart3 className="h-4 w-4" />
                <span className="sr-only">{drawerOpen ? 'Hide run details' : 'Show run details'}</span>
              </Button>
            </div>
          </div>
        </div>

        {isExpanded ? (
          <div className="rounded-xl border border-custom-border bg-black/20 px-3 py-2 text-[0.72rem] uppercase tracking-[0.12em] text-fm-light-grey">
            {liveEntityTicker}
          </div>
        ) : null}
      </div>
    </section>
  )
}
