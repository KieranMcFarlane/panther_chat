function readString(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function readNumber(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export function isHighSignalGraphitiInsightRow(row) {
  const rawPayload = row && typeof row.raw_payload === 'object' && row.raw_payload !== null
    ? row.raw_payload
    : {}

  const signalBasis = readString(rawPayload.signal_basis).toLowerCase()
  const validatedSignalCount = readNumber(rawPayload.validated_signal_count)
  const salesReadiness = readString(rawPayload.sales_readiness).toUpperCase()
  const activeProbability = readNumber(rawPayload.active_probability)
  const title = readString(row.title).toLowerCase()
  const confidence = readNumber(row.confidence)

  if (signalBasis && ['validated_signal', 'question_first', 'sales_readiness'].includes(signalBasis)) {
    return true
  }

  if (validatedSignalCount > 0) {
    return true
  }

  if (salesReadiness === 'LIVE' || activeProbability >= 0.8) {
    return true
  }

  return confidence >= 0.7 && !title.includes('context refreshed')
}

export function filterHighSignalGraphitiInsightRows(rows) {
  return rows.filter((row) => isHighSignalGraphitiInsightRow(row))
}
