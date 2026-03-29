import { deriveDossierPhaseSnapshot } from '@/components/discovery/discovery-phase-model'

type DossierLike = Record<string, any> | null | undefined

export interface EntityDossierSummary {
  hasDossier: boolean
  source: 'persisted' | 'embedded' | 'missing'
  phaseIndex: number
  completionPercent: number
  confidence: number | null
  freshness: 'fresh' | 'warm' | 'stale'
  nextAction: string
  questionCount: number
  signalState: string
}

function parseEmbeddedDossier(value: unknown): Record<string, any> | null {
  if (!value) return null
  if (typeof value === 'object') return value as Record<string, any>
  if (typeof value !== 'string') return null

  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

function countQuestions(dossier: Record<string, any>): number {
  const questions = dossier.questions
  const hypotheses = dossier.hypotheses

  if (Array.isArray(questions) && questions.length > 0) return questions.length
  if (Array.isArray(hypotheses) && hypotheses.length > 0) return hypotheses.length
  return 0
}

export function getEntityDossierSummary(
  entity: { properties?: Record<string, any> } | null | undefined,
  dossier?: DossierLike
): EntityDossierSummary {
  const embeddedDossier = parseEmbeddedDossier(entity?.properties?.dossier_data)
  const resolvedDossier = (dossier && typeof dossier === 'object' ? dossier : embeddedDossier) || null
  const source = dossier
    ? 'persisted'
    : embeddedDossier
      ? 'embedded'
      : 'missing'

  const snapshot = deriveDossierPhaseSnapshot(resolvedDossier)

  return {
    hasDossier: Boolean(resolvedDossier),
    source,
    phaseIndex: snapshot.currentPhaseIndex,
    completionPercent: snapshot.completionPercent,
    confidence: snapshot.confidence,
    freshness: snapshot.freshness,
    nextAction: snapshot.nextAction,
    questionCount: resolvedDossier ? countQuestions(resolvedDossier) : 0,
    signalState: String(
      resolvedDossier?.metadata?.signal_state ??
      resolvedDossier?.signal_state ??
      resolvedDossier?.state ??
      ''
    ).trim(),
  }
}

export function buildDossierSourceLabel(summary: EntityDossierSummary): string {
  if (!summary.hasDossier) return 'Dossier pending'
  if (summary.source === 'persisted') return 'Persisted dossier'
  if (summary.source === 'embedded') return 'Embedded dossier'
  return 'Dossier available'
}
