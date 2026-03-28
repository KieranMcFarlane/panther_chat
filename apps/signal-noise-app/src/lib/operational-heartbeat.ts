export type OperationalHeartbeatFreshness = 'fresh' | 'stale'

export type OperationalHeartbeatSource = 'heartbeat_at' | 'started_at' | 'generated_at' | 'missing'

export type OperationalHeartbeatDetails = {
  heartbeat_at: string | null
  heartbeat_age_seconds: number | null
  heartbeat_source: OperationalHeartbeatSource
  freshness_state: OperationalHeartbeatFreshness
}

export const OPERATIONAL_HEARTBEAT_STALE_SECONDS = 5 * 60

function toText(value: unknown): string {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

function parseTimestamp(value: unknown): number | null {
  const text = toText(value)
  if (!text) return null
  const timestamp = Date.parse(text)
  return Number.isFinite(timestamp) ? timestamp : null
}

export function resolveOperationalHeartbeatDetails(input: {
  heartbeat_at?: unknown
  started_at?: unknown
  generated_at?: unknown
  now_ms?: number
  stale_after_seconds?: number
}): OperationalHeartbeatDetails {
  const nowMs = Number.isFinite(input.now_ms) ? Number(input.now_ms) : Date.now()
  const staleAfterSeconds = Number.isFinite(input.stale_after_seconds)
    ? Number(input.stale_after_seconds)
    : OPERATIONAL_HEARTBEAT_STALE_SECONDS

  const heartbeatAt = toText(input.heartbeat_at) || null
  const startedAt = toText(input.started_at) || null
  const generatedAt = toText(input.generated_at) || null
  const resolvedHeartbeatAt = heartbeatAt || startedAt || generatedAt || null
  const heartbeatSource: OperationalHeartbeatSource = heartbeatAt
    ? 'heartbeat_at'
    : startedAt
      ? 'started_at'
      : generatedAt
        ? 'generated_at'
        : 'missing'

  const timestamp = resolvedHeartbeatAt ? parseTimestamp(resolvedHeartbeatAt) : null
  if (timestamp === null) {
    return {
      heartbeat_at: resolvedHeartbeatAt,
      heartbeat_age_seconds: null,
      heartbeat_source: heartbeatSource,
      freshness_state: 'stale',
    }
  }

  const heartbeatAgeSeconds = Math.max(0, Math.floor((nowMs - timestamp) / 1000))
  return {
    heartbeat_at: resolvedHeartbeatAt,
    heartbeat_age_seconds: heartbeatAgeSeconds,
    heartbeat_source: heartbeatSource,
    freshness_state: heartbeatAgeSeconds <= staleAfterSeconds ? 'fresh' : 'stale',
  }
}
