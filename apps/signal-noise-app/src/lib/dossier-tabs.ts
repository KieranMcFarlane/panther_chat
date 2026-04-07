export interface DossierTabDefinition {
  value: string
  label: string
  description: string
  hasData: boolean
}

type DossierSectionInput = Record<string, any> | null | undefined

const SECTION_DEFINITIONS: Array<{
  value: string
  label: string
  description: string
  hasData: (dossier: Record<string, any>) => boolean
}> = [
  {
    value: 'overview',
    label: 'Overview',
    description: 'Entity identity, run status, and discovery summary',
    hasData: (dossier) =>
      hasValue(dossier.entity_name) ||
      hasValue(dossier.entity_type) ||
      hasValue(dossier.run_rollup) ||
      hasValue(dossier.question_first),
  },
  {
    value: 'digital-stack',
    label: 'Digital Stack',
    description: 'Observed platforms, stack clues, and digital posture',
    hasData: (dossier) =>
      hasValue(dossier.digital_transformation) ||
      hasValue(dossier.question_first?.discovery_summary?.digital_stack) ||
      hasValue(dossier.answers),
  },
  {
    value: 'procurement-ecosystem',
    label: 'Procurement / Ecosystem',
    description: 'Buying motion, timing, incumbent vendors, and ecosystem signals',
    hasData: (dossier) =>
      hasValue(dossier.question_first?.discovery_summary?.timing_procurement_markers) ||
      hasValue(dossier.question_first?.discovery_summary?.timing_and_procurement) ||
      hasValue(dossier.question_first?.discovery_summary?.opportunity_signals) ||
      hasValue(dossier.run_rollup),
  },
  {
    value: 'decision-owners-pois',
    label: 'Decision Owners / POIs',
    description: 'Decision owners, people of interest, and relationship graph',
    hasData: (dossier) =>
      hasValue(dossier.question_first?.discovery_summary?.decision_owners) ||
      hasValue(dossier.poi_graph) ||
      hasValue(dossier.question_first?.poi_graph),
  },
  {
    value: 'evidence-sources',
    label: 'Evidence / Sources',
    description: 'Promoted evidence, source URLs, and question timing detail',
    hasData: (dossier) =>
      hasValue(dossier.question_first?.evidence_items) ||
      hasValue(dossier.question_first?.dossier_promotions) ||
      hasValue(dossier.question_timings) ||
      hasValue(dossier.metadata?.question_first),
  },
]

function hasValue(value: any): boolean {
  if (Array.isArray(value)) {
    return value.length > 0
  }

  if (value && typeof value === 'object') {
    return Object.keys(value).length > 0
  }

  return value !== null && value !== undefined && value !== ''
}

export function buildDossierTabs(
  dossier: DossierSectionInput,
  options: { entityType?: string } = {},
): DossierTabDefinition[] {
  const normalizedDossier = dossier ?? {}
  const hasAnyDossierData = Object.values(normalizedDossier).some(hasValue)

  if (!hasAnyDossierData) {
    return [
      {
        value: 'overview',
        label: options.entityType ? `${options.entityType} dossier` : 'Dossier',
        description: 'No persisted dossier data is available yet',
        hasData: false,
      },
    ]
  }

  return SECTION_DEFINITIONS.map((section) => ({
    value: section.value,
    label: section.label,
    description: section.description,
    hasData: section.hasData(normalizedDossier),
  }))
}
