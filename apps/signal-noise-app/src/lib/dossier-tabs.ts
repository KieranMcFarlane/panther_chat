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
  keys: string[]
}> = [
  {
    value: 'overview',
    label: 'Overview',
    description: 'Core identity, metadata, and dossier snapshot',
    keys: ['core_info', 'entity', 'metadata'],
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
    ...section,
    hasData: section.keys.some((key) => hasValue(normalizedDossier[key])),
  }))
}
