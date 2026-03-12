const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on'])

function isTruthy(value: string | undefined): boolean {
  if (!value) return false
  return TRUE_VALUES.has(value.trim().toLowerCase())
}

export function isFeatureTechPagesEnabled(): boolean {
  return isTruthy(process.env.NEXT_PUBLIC_FEATURE_TECH_PAGES) || isTruthy(process.env.FEATURE_TECH_PAGES)
}

export function isFeatureExperimentalGraphEnabled(): boolean {
  return (
    isTruthy(process.env.NEXT_PUBLIC_FEATURE_EXPERIMENTAL_GRAPH) ||
    isTruthy(process.env.FEATURE_EXPERIMENTAL_GRAPH)
  )
}
