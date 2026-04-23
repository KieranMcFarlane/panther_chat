export type OperationalFreshnessState = 'fresh' | 'stale'

type ActivityCandidate = {
  heartbeat_at?: string | null
  generated_at?: string | null
  started_at?: string | null
  updated_at?: string | null
  completed_at?: string | null
}

type FreshnessInput = {
  snapshotAt: string | null
  freshnessThresholdSeconds: number
  now?: string | number | Date
  currentRun?: ActivityCandidate | null
  runningEntities?: ActivityCandidate[] | null
  staleActiveRows?: ActivityCandidate[] | null
  completedEntities?: ActivityCandidate[] | null
}

type OperationalFreshnessCheckpoint = {
  last_activity_at: string | null
  freshness_state: OperationalFreshnessState
}

function parseTimestamp(value: unknown) {
  if (!value) return null
  const timestamp = new Date(String(value)).getTime()
  return Number.isNaN(timestamp) ? null : timestamp
}

function pickLatestActivityTimestamp(candidates: ActivityCandidate[] | null | undefined) {
  let latest: { value: string; timestamp: number } | null = null
  for (const candidate of candidates ?? []) {
    const values = [
      candidate.heartbeat_at,
      candidate.updated_at,
      candidate.completed_at,
      candidate.generated_at,
      candidate.started_at,
    ]
    for (const value of values) {
      const timestamp = parseTimestamp(value)
      if (timestamp === null || !value) continue
      if (!latest || timestamp > latest.timestamp) {
        latest = { value, timestamp }
      }
    }
  }
  return latest?.value ?? null
}

export function deriveOperationalFreshnessCheckpoint(input: FreshnessInput): OperationalFreshnessCheckpoint {
  const primaryActivity = pickLatestActivityTimestamp([
    ...(input.currentRun ? [input.currentRun] : []),
    ...(input.runningEntities ?? []),
  ])
  const secondaryActivity = pickLatestActivityTimestamp([
    ...(input.completedEntities ?? []),
    ...(input.staleActiveRows ?? []),
  ])
  const lastActivityAt = primaryActivity || secondaryActivity || input.snapshotAt || null

  const nowTimestamp = input.now instanceof Date
    ? input.now.getTime()
    : typeof input.now === 'number'
      ? input.now
      : input.now
        ? new Date(input.now).getTime()
        : Date.now()
  const lastActivityTimestamp = parseTimestamp(lastActivityAt)
  const freshnessState: OperationalFreshnessState = (
    lastActivityTimestamp !== null
    && Number.isFinite(nowTimestamp)
    && nowTimestamp - lastActivityTimestamp > input.freshnessThresholdSeconds * 1000
  )
    ? 'stale'
    : 'fresh'

  return {
    last_activity_at: lastActivityAt,
    freshness_state: freshnessState,
  }
}
