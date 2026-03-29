export function normalizeDossierPayload(dossier: unknown): Record<string, any> | null {
  if (!dossier) {
    return null
  }

  if (typeof dossier === 'string') {
    try {
      const parsed = JSON.parse(dossier)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, any>
      }
    } catch {
      return null
    }

    return null
  }

  if (typeof dossier === 'object' && !Array.isArray(dossier)) {
    return dossier as Record<string, any>
  }

  return null
}
