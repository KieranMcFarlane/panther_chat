export interface FallbackDossierNarrativeOptions {
  signal?: string
  route?: string
}

export function normalizeDossierLanguage(text: string): string {
  return String(text || '')
    .trim()
    .replace(/^Start with /i, 'Lead with ')
    .replace(/proof of concept/gi, 'proof of value')
}

export function buildFallbackDossierNarrative(
  entityName: string,
  entityType = 'Club',
  signal = 'fan intelligence',
  route = 'commercial and innovation',
): {
  overallAssessment: string
  yellowPantherOpportunity: string
  recommendedApproach: string
} {
  const name = String(entityName || 'This entity')
  const focus = String(signal || 'fan intelligence')
  const entryRoute = String(route || 'commercial and innovation')

  return {
    overallAssessment: `${name} is in a transition from prudence to investment. The dossier points to a narrow, evidence-backed pilot rather than a broad vendor pitch.`,
    yellowPantherOpportunity: `Use Yellow Panther to prove value through ${focus} before widening the scope.`,
    recommendedApproach: `Lead with a proof of value in ${focus}, confirm the stakeholders, and expand only after the first pilot lands through the ${entryRoute} path.`,
  }
}

export function buildFallbackConnectionGuidance(entityName: string, route = 'commercial or innovation team'): string {
  const name = String(entityName || 'This entity')
  return `${name} is best approached through the ${route}, ideally via a warm partner path.`
}

export function buildFallbackIntroductionStrategy(signal = 'commercial and innovation'): string {
  const focus = String(signal || 'commercial and innovation')
  return `Use a warm introduction through the ${focus} network and keep the ask tied to a visible pilot.`
}
