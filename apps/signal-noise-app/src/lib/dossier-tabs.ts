export interface DossierTabDefinition {
  value: string
  label: string
  description: string
  hasData: boolean
  status?: 'filled' | 'partial' | 'missing'
}

type DossierSectionInput = Record<string, any> | null | undefined
type DossierHumanContextInput = Record<string, any> | null | undefined
type DossierTabOptions = {
  entityType?: string
}

const SECTION_DEFINITIONS: Array<{
  value: string
  label: string
  description: string
  keys: string[]
}> = [
  {
    value: 'questions',
    label: 'Questions',
    description: 'Canonical Yellow Panther question pack and Ralph writeback',
    keys: ['metadata'],
  },
  {
    value: 'overview',
    label: 'Overview',
    description: 'Core identity, metadata, and dossier snapshot',
    keys: ['core_info', 'entity', 'metadata'],
  },
  {
    value: 'commercial-digital-context',
    label: 'Commercial',
    description: 'Commercial motion, digital maturity, and fan/data signals',
    keys: ['core_info', 'digital_transformation', 'metadata'],
  },
  {
    value: 'temporal-relational-context',
    label: 'Temporal',
    description: 'Timeline anchors, freshness, and graph-backed relationships',
    keys: ['metadata', 'linkedin_connection_analysis'],
  },
  {
    value: 'procurement',
    label: 'Procurement',
    description: 'Buying signals, timelines, and roadmap phases',
    keys: ['implementation_roadmap', 'metadata'],
  },
  {
    value: 'digital-transformation',
    label: 'Digital',
    description: 'Digital maturity and platform posture',
    keys: ['digital_transformation'],
  },
  {
    value: 'strategic-analysis',
    label: 'AI Insights',
    description: 'Reasoner assessment and priority fit',
    keys: ['strategic_analysis'],
  },
  {
    value: 'opportunities',
    label: 'Opportunities',
    description: 'Commercial opportunities and decision paths',
    keys: ['strategic_analysis', 'implementation_roadmap'],
  },
  {
    value: 'leadership',
    label: 'Leadership',
    description: 'Decision makers, influence, and contact anchors',
    keys: ['linkedin_connection_analysis'],
  },
  {
    value: 'connections',
    label: 'Connections',
    description: 'Relationship paths and bridge contacts',
    keys: ['linkedin_connection_analysis'],
  },
  {
    value: 'implementation-roadmap',
    label: 'Roadmap',
    description: 'Phase-by-phase activation plan',
    keys: ['implementation_roadmap'],
  },
  {
    value: 'contact',
    label: 'Contact',
    description: 'Web, HQ, and outreach anchors',
    keys: ['core_info', 'metadata'],
  },
  {
    value: 'outreach',
    label: 'Outreach',
    description: 'Recommended approach and next step',
    keys: ['linkedin_connection_analysis', 'metadata'],
  },
  {
    value: 'system',
    label: 'System',
    description: 'Persisted writeback, provenance, and source health',
    keys: ['metadata', 'entity'],
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
  humanContextOrOptions: DossierHumanContextInput | DossierTabOptions = {},
  options: DossierTabOptions = {},
): DossierTabDefinition[] {
  const normalizedDossier = dossier ?? {}
  const hasHumanContext = Boolean(
    humanContextOrOptions &&
      typeof humanContextOrOptions === 'object' &&
      'sections' in humanContextOrOptions &&
      humanContextOrOptions.sections &&
      typeof humanContextOrOptions.sections === 'object',
  )
  const humanContext = hasHumanContext ? humanContextOrOptions : null
  const resolvedOptions = (hasHumanContext ? options : humanContextOrOptions) as DossierTabOptions
  const hasAnyDossierData = Object.values(normalizedDossier).some(hasValue)
  const hasAnyHumanContextData = Boolean(
    humanContext &&
      Object.values((humanContext as Record<string, any>).sections || {}).some((section: any) => {
        if (!section || typeof section !== 'object') return false
        return hasValue(section.content) || section.status === 'filled' || section.status === 'partial'
      }),
  )

  if (!hasAnyDossierData && !hasAnyHumanContextData) {
    return [
      {
        value: 'overview',
        label: resolvedOptions.entityType ? `${resolvedOptions.entityType} dossier` : 'Dossier',
        description: 'No persisted dossier data is available yet',
        hasData: false,
      },
    ]
  }

  return SECTION_DEFINITIONS.map((section) => ({
    ...section,
    hasData:
      section.keys.some((key) => hasValue(normalizedDossier[key])) ||
      Boolean(
        humanContext &&
          (section.value === 'questions' ||
            (section.value === 'commercial-digital-context' &&
              hasValue((humanContext as Record<string, any>).sections?.commercial_digital_context)) ||
            (section.value === 'temporal-relational-context' &&
              hasValue((humanContext as Record<string, any>).sections?.temporal_relational_context)) ||
            (section.value === 'system' &&
              hasValue((humanContext as Record<string, any>).sections?.evidence_confidence))),
      ),
  }))
}
