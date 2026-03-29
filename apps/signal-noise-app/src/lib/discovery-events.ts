export type DiscoveryEventPriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'

export type DiscoveryEventType =
  | 'connection_established'
  | 'ping'
  | 'dossier_generation_status'
  | 'dossier_phase_update'
  | 'pipeline_lane_update'
  | 'scout_update'
  | 'enrichment_update'
  | 'validation_update'
  | 'graph_update'
  | 'system_status'
  | 'memory_updated'
  | 'batch_enrichment_complete'
  | 'tier1_rfp_analyzed'
  | string

export interface DiscoveryEvent {
  type: DiscoveryEventType
  timestamp: string
  priority: DiscoveryEventPriority
  data: Record<string, unknown>
}

export interface DiscoveryEventFilters {
  entityId?: string
  streamType?: string
  tier?: number
  sport?: string
  minFitScore?: number
}

type DiscoveryEventListener = (event: DiscoveryEvent) => void

interface DiscoveryEventSubscription {
  id: string
  filters: DiscoveryEventFilters | null
  listener: DiscoveryEventListener
}

interface DiscoveryEventStreamOptions {
  filters?: DiscoveryEventFilters
  heartbeatMs?: number
}

const MAX_RECENT_EVENTS = 200
const DEFAULT_HEARTBEAT_MS = 30_000
const EVENT_SOURCE_HEADER = 'text/event-stream'

function normalizePriority(value: unknown): DiscoveryEventPriority {
  const candidate = String(value ?? '').trim().toUpperCase()
  if (candidate === 'CRITICAL' || candidate === 'HIGH' || candidate === 'MEDIUM' || candidate === 'LOW') {
    return candidate
  }
  return 'MEDIUM'
}

function toTimestamp(value: unknown): string {
  if (typeof value === 'string' && value.trim()) return value
  return new Date().toISOString()
}

function normalizeDiscoveryData(data: unknown): Record<string, unknown> {
  if (!data || typeof data !== 'object') return {}
  return { ...(data as Record<string, unknown>) }
}

function normalizeDiscoveryEvent(input: Partial<DiscoveryEvent> & Record<string, unknown>): DiscoveryEvent {
  return {
    type: String(input.type ?? 'system_status'),
    timestamp: toTimestamp(input.timestamp),
    priority: normalizePriority(input.priority),
    data: normalizeDiscoveryData(input.data ?? input),
  }
}

function getEntityId(event: DiscoveryEvent): string | null {
  const candidate = event.data.entityId ?? event.data.entity_id ?? event.data.entity ?? null
  const normalized = String(candidate ?? '').trim()
  return normalized || null
}

function getSport(event: DiscoveryEvent): string | null {
  const candidate = event.data.sport ?? event.data.sport_name ?? null
  const normalized = String(candidate ?? '').trim()
  return normalized || null
}

function getFitScore(event: DiscoveryEvent): number | null {
  const raw = event.data.fit_score ?? event.data.fitScore ?? null
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : null
}

function matchesFilters(event: DiscoveryEvent, filters: DiscoveryEventFilters | null): boolean {
  if (!filters) return true

  if (filters.entityId) {
    const entityId = getEntityId(event)
    if (entityId !== filters.entityId) return false
  }

  if (filters.streamType) {
    const streamType = String(event.data.stream_type ?? event.data.streamType ?? '').trim()
    if (streamType && streamType !== filters.streamType) return false
  }

  if (filters.tier) {
    const tier = Number(event.data.entity_tier ?? event.data.tier)
    if (Number.isFinite(tier) && tier !== filters.tier) return false
  }

  if (filters.sport) {
    const sport = getSport(event)
    if (sport && sport !== filters.sport) return false
  }

  if (filters.minFitScore != null) {
    const fitScore = getFitScore(event)
    if (fitScore != null && fitScore < filters.minFitScore) return false
  }

  return true
}

function encodeSseEvent(_eventName: string, payload: unknown): Uint8Array {
  const encoder = new TextEncoder()
  return encoder.encode(`data: ${JSON.stringify(payload)}\n\n`)
}

function parseFiltersFromUrl(url: URL): DiscoveryEventFilters {
  const entityId = url.searchParams.get('entityId') ?? url.searchParams.get('entity_id') ?? undefined
  const streamType = url.searchParams.get('streamType') ?? url.searchParams.get('stream_type') ?? undefined
  const tier = url.searchParams.get('tier')
  const sport = url.searchParams.get('sport') ?? undefined
  const minFitScore = url.searchParams.get('min_fit_score') ?? url.searchParams.get('minFitScore')

  return {
    entityId: entityId || undefined,
    streamType: streamType || undefined,
    tier: tier ? Number.parseInt(tier, 10) : undefined,
    sport,
    minFitScore: minFitScore ? Number.parseInt(minFitScore, 10) : undefined,
  }
}

class DiscoveryEventHub {
  private recentEvents: DiscoveryEvent[] = []
  private subscriptions = new Map<string, DiscoveryEventSubscription>()

  publish(eventLike: Partial<DiscoveryEvent> & Record<string, unknown>): DiscoveryEvent {
    const event = normalizeDiscoveryEvent(eventLike)
    this.recentEvents = [event, ...this.recentEvents.filter((item) => this.eventKey(item) !== this.eventKey(event))].slice(0, MAX_RECENT_EVENTS)

    for (const subscription of this.subscriptions.values()) {
      if (matchesFilters(event, subscription.filters)) {
        subscription.listener(event)
      }
    }

    return event
  }

  seed(events: Array<Partial<DiscoveryEvent> & Record<string, unknown>>) {
    const normalizedEvents = events.map((event) => normalizeDiscoveryEvent(event))
    this.recentEvents = [
      ...normalizedEvents.reverse(),
      ...this.recentEvents,
    ]
      .filter((event, index, array) => array.findIndex((candidate) => this.eventKey(candidate) === this.eventKey(event)) === index)
      .slice(0, MAX_RECENT_EVENTS)
  }

  subscribe(listener: DiscoveryEventListener, filters: DiscoveryEventFilters | null = null): () => void {
    const id = `subscription_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
    this.subscriptions.set(id, { id, listener, filters })
    return () => {
      this.subscriptions.delete(id)
    }
  }

  getRecent(filters: DiscoveryEventFilters | null = null, limit = 50): DiscoveryEvent[] {
    return this.recentEvents.filter((event) => matchesFilters(event, filters)).slice(0, limit)
  }

  resetForTests() {
    this.recentEvents = []
    this.subscriptions.clear()
  }

  createSseResponse(input: { request: Request; filters?: DiscoveryEventFilters; heartbeatMs?: number }): Response {
    const encoder = new TextEncoder()
    const heartbeatMs = input.heartbeatMs ?? DEFAULT_HEARTBEAT_MS
    let unsubscribe = () => {}
    let heartbeat: ReturnType<typeof setInterval> | null = null
    let closed = false

    const cleanup = (controller?: ReadableStreamDefaultController<Uint8Array>) => {
      if (closed) return
      closed = true

      if (heartbeat) {
        clearInterval(heartbeat)
        heartbeat = null
      }

      unsubscribe()
      controller?.close()
    }

    const stream = new ReadableStream({
      start: (controller) => {
        controller.enqueue(encodeSseEvent('connection_established', {
          type: 'connection_established',
          timestamp: new Date().toISOString(),
          message: 'Connected to Yellow Panther discovery stream',
          filters: input.filters ?? null,
        }))

        for (const event of this.getRecent(input.filters ?? null)) {
          controller.enqueue(encodeSseEvent(event.type, event))
        }

        unsubscribe = this.subscribe((event) => {
          controller.enqueue(encodeSseEvent(event.type, event))
        }, input.filters ?? null)

        heartbeat = setInterval(() => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            type: 'ping',
            timestamp: new Date().toISOString(),
          })}\n\n`))
        }, heartbeatMs)

        input.request.signal.addEventListener('abort', () => {
          cleanup(controller)
        })
      },
      cancel: () => {
        cleanup()
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': EVENT_SOURCE_HEADER,
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      },
    })
  }

  private eventKey(event: DiscoveryEvent): string {
    return `${event.type}:${event.timestamp}:${JSON.stringify(event.data)}`
  }
}

function getGlobalDiscoveryEventHub(): DiscoveryEventHub {
  const globalScope = globalThis as typeof globalThis & {
    __yellowPantherDiscoveryEventHub__?: DiscoveryEventHub
  }

  if (!globalScope.__yellowPantherDiscoveryEventHub__) {
    globalScope.__yellowPantherDiscoveryEventHub__ = new DiscoveryEventHub()
  }

  return globalScope.__yellowPantherDiscoveryEventHub__
}

export function publishDiscoveryEvent(eventLike: Partial<DiscoveryEvent> & Record<string, unknown>): DiscoveryEvent {
  return getGlobalDiscoveryEventHub().publish(eventLike)
}

export function seedDiscoveryEvents(events: Array<Partial<DiscoveryEvent> & Record<string, unknown>>) {
  getGlobalDiscoveryEventHub().seed(events)
}

export function subscribeDiscoveryEvents(
  listener: DiscoveryEventListener,
  filters?: DiscoveryEventFilters | null,
): () => void {
  return getGlobalDiscoveryEventHub().subscribe(listener, filters ?? null)
}

export function getRecentDiscoveryEvents(filters?: DiscoveryEventFilters | null, limit = 50): DiscoveryEvent[] {
  return getGlobalDiscoveryEventHub().getRecent(filters ?? null, limit)
}

export function createDiscoveryEventResponse(requestOrUrl: Request | URL | string): Response {
  const url = typeof requestOrUrl === 'string'
    ? new URL(requestOrUrl, 'http://localhost')
    : requestOrUrl instanceof URL
      ? requestOrUrl
      : new URL(requestOrUrl.url)
  return getGlobalDiscoveryEventHub().createSseResponse({
    request: requestOrUrl instanceof Request ? requestOrUrl : new Request(url.toString()),
    filters: parseFiltersFromUrl(url),
  })
}

export function resetDiscoveryEventHubForTests() {
  getGlobalDiscoveryEventHub().resetForTests()
}
