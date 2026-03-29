import type { DossierTabDefinition } from '@/lib/dossier-tabs'

type LiveEvent = {
  type?: string
  timestamp?: string
  data?: {
    phaseIndex?: number
    phase_index?: number
    stage?: string
    sectionStatuses?: Record<string, unknown>
    section_statuses?: Record<string, unknown>
    [key: string]: unknown
  }
}

const TAB_PHASE_THRESHOLDS: Record<string, number> = {
  questions: 0,
  overview: 0,
  'commercial-digital-context': 1,
  'temporal-relational-context': 1,
  procurement: 1,
  'digital-transformation': 1,
  'strategic-analysis': 2,
  opportunities: 2,
  leadership: 3,
  connections: 3,
  contact: 3,
  outreach: 3,
  'implementation-roadmap': 4,
  system: 5,
}

function toTimestamp(value: string | undefined): number {
  const timestamp = Date.parse(String(value || ''))
  return Number.isFinite(timestamp) ? timestamp : 0
}

function latestEvent(events: LiveEvent[]): LiveEvent | null {
  if (!Array.isArray(events) || events.length === 0) return null

  return [...events].sort((left, right) => toTimestamp(right.timestamp) - toTimestamp(left.timestamp))[0] ?? null
}

function resolvePhaseIndex(event: LiveEvent | null): number | null {
  if (!event) return null

  const numeric = Number(event.data?.phaseIndex ?? event.data?.phase_index)
  return Number.isFinite(numeric) ? numeric : null
}

function isCompletionEvent(event: LiveEvent | null, phaseIndex: number | null): boolean {
  if (!event) return false
  const stage = String(event.data?.stage || '').toLowerCase()
  return event.type === 'graph_update' || stage === 'completed' || (phaseIndex != null && phaseIndex >= 5)
}

function normalizeStatus(value: unknown): 'filled' | 'partial' | 'missing' | null {
  const normalized = String(value ?? '').trim().toLowerCase()
  if (normalized === 'filled' || normalized === 'complete' || normalized === 'completed') return 'filled'
  if (normalized === 'partial' || normalized === 'in_progress' || normalized === 'active') return 'partial'
  if (normalized === 'missing' || normalized === 'pending' || normalized === 'not_started') return 'missing'
  return null
}

export function applyLiveTabStatus(
  tabs: DossierTabDefinition[],
  liveEvents: LiveEvent[] | null | undefined,
): DossierTabDefinition[] {
  if (!Array.isArray(tabs) || tabs.length === 0 || !Array.isArray(liveEvents) || liveEvents.length === 0) {
    return tabs
  }

  const event = latestEvent(liveEvents)
  const phaseIndex = resolvePhaseIndex(event)

  if (isCompletionEvent(event, phaseIndex)) {
    return tabs.map((tab) => ({ ...tab, status: 'filled' }))
  }

  const sectionStatuses = event?.data?.sectionStatuses ?? event?.data?.section_statuses
  if (sectionStatuses && typeof sectionStatuses === 'object' && !Array.isArray(sectionStatuses)) {
    const applied = tabs.map((tab) => {
      const override = normalizeStatus(sectionStatuses[tab.value])
      if (!override) return tab
      return { ...tab, status: override }
    })

    if (phaseIndex == null) {
      return applied
    }

    return applied.map((tab) => {
      if (tab.status === 'filled') return tab
      const threshold = TAB_PHASE_THRESHOLDS[tab.value]
      if (threshold == null || phaseIndex < threshold) return tab
      return tab.status === 'missing' ? { ...tab, status: 'partial' } : tab
    })
  }

  if (phaseIndex == null) {
    return tabs
  }

  return tabs.map((tab) => {
    if (tab.status === 'filled') return tab

    const threshold = TAB_PHASE_THRESHOLDS[tab.value]
    if (threshold == null) return tab

    if (phaseIndex >= threshold) {
      return { ...tab, status: 'partial' }
    }

    return tab
  })
}
