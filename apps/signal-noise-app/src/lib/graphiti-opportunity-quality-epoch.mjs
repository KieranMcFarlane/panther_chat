export const GRAPHITI_OPPORTUNITY_QUALITY_EPOCH = 'yp_graphiti_truth_v1'
export const GRAPHITI_OPPORTUNITY_PROCESSED_VERSION = 'graphiti_commercial_truth_v1'
export const GRAPHITI_OPPORTUNITY_QUALITY_CUTOFF_AT = '2026-05-08T13:26:48.989Z'

export function asGraphitiQualityEpochRecord(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

export function stampTrustedGraphitiQualityEpoch(payload, processedAt = new Date().toISOString()) {
  const record = asGraphitiQualityEpochRecord(payload)
  const { legacy_untrusted: _legacyUntrusted, legacy_untrusted_reason: _legacyReason, ...rest } = record

  return {
    ...rest,
    quality_epoch: GRAPHITI_OPPORTUNITY_QUALITY_EPOCH,
    processed_with_version: GRAPHITI_OPPORTUNITY_PROCESSED_VERSION,
    quality_cutoff_at: GRAPHITI_OPPORTUNITY_QUALITY_CUTOFF_AT,
    quality_processed_at: processedAt,
    legacy_untrusted: false,
  }
}

export function stampLegacyUntrustedGraphitiQualityEpoch(payload, reason = 'pre_quality_epoch_cutoff') {
  const record = asGraphitiQualityEpochRecord(payload)
  const { quality_epoch: _qualityEpoch, processed_with_version: _processedWithVersion, quality_processed_at: _processedAt, ...rest } = record

  return {
    ...rest,
    quality_cutoff_at: GRAPHITI_OPPORTUNITY_QUALITY_CUTOFF_AT,
    legacy_untrusted: true,
    legacy_untrusted_reason: reason,
  }
}

export function isTrustedGraphitiQualityEpochPayload(payload) {
  const record = asGraphitiQualityEpochRecord(payload)
  return record.quality_epoch === GRAPHITI_OPPORTUNITY_QUALITY_EPOCH
    && record.processed_with_version === GRAPHITI_OPPORTUNITY_PROCESSED_VERSION
    && record.legacy_untrusted !== true
}

export function isLegacyUntrustedGraphitiPayload(payload) {
  const record = asGraphitiQualityEpochRecord(payload)
  if (record.legacy_untrusted === true) return true
  return !isTrustedGraphitiQualityEpochPayload(record)
}
