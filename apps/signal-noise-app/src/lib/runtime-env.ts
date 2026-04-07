export function isProductionRuntime() {
  return process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production'
}

export function allowDemoFallbacks() {
  if (process.env.ALLOW_DEMO_FALLBACKS) {
    return process.env.ALLOW_DEMO_FALLBACKS === '1'
  }

  return !isProductionRuntime()
}

export function getGraphitiStaleWindowHours() {
  const parsed = Number(process.env.GRAPHITI_STALE_WINDOW_HOURS || '24')
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 24
}

export function getDossierStaleWindowDays() {
  const parsed = Number(process.env.DOSSIER_STALE_WINDOW_DAYS || '30')
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 30
}
