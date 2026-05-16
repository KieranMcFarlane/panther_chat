export const LEGACY_MERGED_WIDE_RFP_RUN_ID = 'manus-rfp-wide-research-merged'

export function hasWideResearchRecordSignal(row) {
  return Boolean(row?.has_signal && row?.batch)
}

export function resolveLatestWideRfpResearchRecord(rows = []) {
  const signalRows = rows.filter(hasWideResearchRecordSignal)
  return (
    signalRows.find((row) => row.run_id !== LEGACY_MERGED_WIDE_RFP_RUN_ID) ||
    signalRows.find((row) => row.run_id === LEGACY_MERGED_WIDE_RFP_RUN_ID) ||
    rows.find((row) => row?.batch) ||
    rows[0] ||
    null
  )
}

export function sortWideRfpResearchRecordsForDisplay(rows = []) {
  return [...rows].sort((left, right) => {
    const leftSignal = hasWideResearchRecordSignal(left) ? 1 : 0
    const rightSignal = hasWideResearchRecordSignal(right) ? 1 : 0
    if (leftSignal !== rightSignal) return rightSignal - leftSignal

    const leftLegacy = left?.run_id === LEGACY_MERGED_WIDE_RFP_RUN_ID ? 1 : 0
    const rightLegacy = right?.run_id === LEGACY_MERGED_WIDE_RFP_RUN_ID ? 1 : 0
    if (leftLegacy !== rightLegacy) return leftLegacy - rightLegacy

    const leftTime = Date.parse(left?.generated_at || left?.batch?.generated_at || '') || 0
    const rightTime = Date.parse(right?.generated_at || right?.batch?.generated_at || '') || 0
    return rightTime - leftTime
  })
}
