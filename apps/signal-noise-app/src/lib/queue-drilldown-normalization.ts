type FollowOnStateRecord = {
  batch_id?: string | null
  status?: string | null
  next_repair_status?: string | null
  next_repair_batch_id?: string | null
  next_repair_batch_status?: string | null
}

function toText(value: unknown): string {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

function isTerminalStatus(value: string | null | undefined) {
  return value === 'completed' || value === 'failed'
}

export function hasDistinctActiveFollowOnBatch(
  record: FollowOnStateRecord,
  activeBatchIds: Set<string>,
) {
  const nextBatchId = toText(record.next_repair_batch_id)
  const currentBatchId = toText(record.batch_id)
  if (!nextBatchId || nextBatchId === currentBatchId) {
    return false
  }
  return activeBatchIds.has(nextBatchId)
}

export function normalizeTerminalFollowOnMetadata(
  record: FollowOnStateRecord,
  activeBatchIds: Set<string>,
) {
  const currentBatchId = toText(record.batch_id) || null
  const status = toText(record.status).toLowerCase() || null
  const nextBatchId = toText(record.next_repair_batch_id) || null

  if (!isTerminalStatus(status)) {
    return record
  }

  if (!nextBatchId || nextBatchId === currentBatchId || !activeBatchIds.has(nextBatchId)) {
    return {
      ...record,
      next_repair_status: null,
      next_repair_batch_id: null,
      next_repair_batch_status: null,
    }
  }

  return record
}
