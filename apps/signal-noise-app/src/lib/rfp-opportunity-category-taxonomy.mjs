const CATEGORY_LABELS = new Set([
  'ai & automation',
  'commerce',
  'content & social',
  'crm',
  'data & analytics',
  'digital platform',
  'digital transformation',
  'event operations',
  'fan engagement',
  'governance & procurement',
  'sponsorship & partnerships',
  'sports technology',
  'streaming & media',
  'ticketing & payments',
  'venue technology',
  'website redesign',
])

const CATEGORY_LABEL_BY_NORMALIZED = new Map(
  Array.from(CATEGORY_LABELS).map((label) => [normalizeLabel(label), label])
)

const CATEGORY_ALIASES = new Map([
  ['ai', 'ai & automation'],
  ['ai analytics cloud fan engagement', 'ai & automation'],
  ['ai automation', 'ai & automation'],
  ['ai cybersecurity', 'ai & automation'],
  ['automation', 'ai & automation'],
  ['commerce', 'commerce'],
  ['content', 'content & social'],
  ['content management', 'content & social'],
  ['agency of record media and promotion', 'content & social'],
  ['digital communications', 'content & social'],
  ['digital marketing', 'content & social'],
  ['social media', 'content & social'],
  ['branding', 'content & social'],
  ['brand and communications', 'content & social'],
  ['crm', 'crm'],
  ['ticketing crm', 'crm'],
  ['member registration technology platform', 'crm'],
  ['membership platform', 'crm'],
  ['data analytics', 'data & analytics'],
  ['analytics', 'data & analytics'],
  ['analytics platform', 'data & analytics'],
  ['data', 'data & analytics'],
  ['digital ecosystem', 'digital platform'],
  ['digital platform', 'digital platform'],
  ['digital platform adoption', 'digital platform'],
  ['digital platform web development', 'digital platform'],
  ['digital technology', 'digital platform'],
  ['mobile application', 'digital platform'],
  ['mobile app development', 'digital platform'],
  ['mobile platform', 'digital platform'],
  ['platform', 'digital platform'],
  ['software procurement', 'digital platform'],
  ['sports operations administration system', 'digital platform'],
  ['team management platform', 'digital platform'],
  ['digital innovation', 'digital transformation'],
  ['digital modernization', 'digital transformation'],
  ['digital strategy', 'digital transformation'],
  ['digital transformation', 'digital transformation'],
  ['event management', 'event operations'],
  ['event operations', 'event operations'],
  ['major event procurement', 'event operations'],
  ['venue operations', 'event operations'],
  ['fan engagement', 'fan engagement'],
  ['fan engagement platform', 'fan engagement'],
  ['fan experience', 'fan engagement'],
  ['fan technology', 'fan engagement'],
  ['governance', 'governance & procurement'],
  ['government procurement', 'governance & procurement'],
  ['procurement', 'governance & procurement'],
  ['rfp', 'governance & procurement'],
  ['tender', 'governance & procurement'],
  ['commercial partnership', 'sponsorship & partnerships'],
  ['commercial rights', 'sponsorship & partnerships'],
  ['partnership', 'sponsorship & partnerships'],
  ['partnerships', 'sponsorship & partnerships'],
  ['sponsorship', 'sponsorship & partnerships'],
  ['sports technology', 'sports technology'],
  ['gaming', 'sports technology'],
  ['broadcast', 'streaming & media'],
  ['broadcast production', 'streaming & media'],
  ['digital media fan growth signal', 'streaming & media'],
  ['media rights', 'streaming & media'],
  ['multimedia rights digital fan engagement', 'streaming & media'],
  ['streaming', 'streaming & media'],
  ['video social content production', 'streaming & media'],
  ['video', 'streaming & media'],
  ['payments', 'ticketing & payments'],
  ['ticketing', 'ticketing & payments'],
  ['venue technology', 'venue technology'],
  ['stadium technology', 'venue technology'],
  ['web design development', 'website redesign'],
  ['web design', 'website redesign'],
  ['web development', 'website redesign'],
  ['website design', 'website redesign'],
  ['website redesign', 'website redesign'],
  ['website rebuild', 'website redesign'],
])

const RULES = [
  {
    label: 'website redesign',
    patterns: [
      /\bwebsite\s+(redesign|rebuild|revamp|revision|refresh|moderni[sz]ation|development|design|redevelopment)\b/,
      /\b(redesign|rebuild|revamp|revision|refresh|moderni[sz]ation|development|design|redevelopment)\s+(of\s+)?(official\s+)?website\b/,
      /\bweb\s+(design|development|designers|developers)\b/,
      /\bwebsite\s+services\b/,
      /\bwebsite\s+platform\s+(rebuild|redesign|moderni[sz]ation)\b/,
      /\bcontent management system\b/,
    ],
  },
  {
    label: 'crm',
    patterns: [
      /\bcrm\b/,
      /\bmartech\b/,
      /\bmember(ship)?\b/,
      /\bregistration\b/,
      /\bcustomer data\b/,
      /\bassociation management software\b/,
    ],
  },
  {
    label: 'ticketing & payments',
    patterns: [
      /\bticket(ing| payment| payments)?\b/,
      /\bpayment(s)?\b/,
      /\bpay\b/,
      /\bfintech\b/,
      /\bpatronmanager\b/,
    ],
  },
  {
    label: 'streaming & media',
    patterns: [
      /\bbroadcast\b/,
      /\bstream(ing)?\b/,
      /\bott\b/,
      /\bdtc\b/,
      /\bmedia rights?\b/,
      /\bvideo\b/,
      /\byoutube\b/,
      /\btv\b/,
      /\bcontent distribution\b/,
    ],
  },
  {
    label: 'venue technology',
    patterns: [
      /\bstadium\b/,
      /\barena\b/,
      /\bvenue\b/,
      /\bscoreboard\b/,
      /\bsignage\b/,
      /\bwayfinding\b/,
      /\bled\b/,
      /\bwifi\b/,
      /\bwi-fi\b/,
      /\b5g\b/,
      /\bconnectivity\b/,
      /\bcrowd\b/,
      /\bfacilit(y|ies)\b/,
    ],
  },
  {
    label: 'ai & automation',
    patterns: [
      /\bai\b/,
      /\bartificial intelligence\b/,
      /\bautomation\b/,
      /\bcybersecurity\b/,
      /\bmachine learning\b/,
      /\binnovation challenge\b/,
    ],
  },
  {
    label: 'data & analytics',
    patterns: [
      /\banalytics?\b/,
      /\bdata\b/,
      /\bintelligence\b/,
      /\bplatform data\b/,
      /\bcrowd intelligence\b/,
    ],
  },
  {
    label: 'fan engagement',
    patterns: [
      /\bfan engagement\b/,
      /\bfan experience\b/,
      /\bimmersive\b/,
      /\bshared reality\b/,
      /\bloyalty\b/,
    ],
  },
  {
    label: 'content & social',
    patterns: [
      /\bsocial media\b/,
      /\bcontent\b/,
      /\bbranding\b/,
      /\bcommunication(s)? agency\b/,
      /\bpublic relations\b/,
      /\bdigital asset management\b/,
    ],
  },
  {
    label: 'commerce',
    patterns: [
      /\be-?commerce\b/,
      /\bdigital commerce\b/,
      /\bmerchandise\b/,
      /\bretail\b/,
    ],
  },
  {
    label: 'sponsorship & partnerships',
    patterns: [
      /\bpartnership\b/,
      /\bpartner\b/,
      /\bsponsor(ship)?\b/,
      /\bcommercial rights\b/,
      /\bactivation\b/,
      /\bnaming rights\b/,
      /\bkit sponsor\b/,
      /\bstrategic refocus\b/,
    ],
  },
  {
    label: 'digital platform',
    patterns: [
      /\bdigital platform\b/,
      /\bplatform\b/,
      /\bportal\b/,
      /\bapp\b/,
      /\bmobile\b/,
      /\bsoftware\b/,
      /\bsystem\b/,
      /\bdigital suite\b/,
      /\belearning\b/,
      /\bgaming rights\b/,
      /\bdigital catalogue\b/,
    ],
  },
  {
    label: 'digital transformation',
    patterns: [
      /\bdigital transformation\b/,
      /\bdigital modernization\b/,
      /\bdigital modernisation\b/,
      /\bdigital strategy\b/,
      /\bdigital ecosystem\b/,
      /\bdigital evolution\b/,
      /\bdigital upgrade\b/,
    ],
  },
  {
    label: 'event operations',
    patterns: [
      /\bworld cup\b/,
      /\bla28\b/,
      /\bolympic\b/,
      /\bgames\b/,
      /\bevent\b/,
      /\bvolunteer\b/,
      /\bhost committee\b/,
      /\bsupplier program\b/,
      /\bvendor opportunities\b/,
    ],
  },
  {
    label: 'governance & procurement',
    patterns: [
      /\brfp\b/,
      /\btender\b/,
      /\bprocurement\b/,
      /\bprequalification\b/,
      /\bgrant(s)? consultant\b/,
      /\bfederal grants?\b/,
      /\bcommittee\b/,
      /\binquiry\b/,
      /\bgovernance\b/,
      /\bbill\b/,
    ],
  },
]

export function normalizeRfpOpportunityType(opportunity) {
  const metadata = opportunity?.metadata || {}
  const sourceType = normalizeLabel(metadata.source_type)
  const status = normalizeLabel(opportunity?.status)
  const title = text(opportunity?.title).toLowerCase()
  const originalCategory = normalizeLabel(metadata.original_category || opportunity?.category)
  const sourceText = [
    sourceType,
    status,
    title,
    originalCategory,
    text(opportunity?.description).toLowerCase(),
  ].join(' ')

  const directProcurement =
    /\b(rfp|rfq|rfi|request for proposal|request for proposals|request for qualification|tender|bid|procurement notice|procurement portal|official procurement|solicitation|prequalification|vendor opportunities)\b/.test(sourceText)
  const liveProcurementStatus =
    /\b(open|active procurement|tender active|in procurement|multiple open|prequalification|new)\b/.test(status)
  const signalOnly =
    /\b(market signal|partnership|partnership announcement|deployment announcement|award announcement|press release|official news|hiring signal|venue project|social media|news report|official announcement)\b/.test(sourceType) ||
    /\b(awarded|announced|deployed|launched|under construction|approved|planning|consultation|completed acquisition|proposed)\b/.test(status)

  if (directProcurement && (liveProcurementStatus || !signalOnly)) return 'rfp'
  if (directProcurement && /\b(official rfp|official tender|official procurement|government tender|commercial tender|procurement portal|official rfp document|official rfp page|official tenders page)\b/.test(sourceType)) return 'rfp'

  return 'signal'
}

export function formatRfpOpportunityType(value) {
  return value === 'rfp' ? 'RFP' : 'Signal'
}

export function normalizeRfpCategoryLabel(value) {
  const normalized = normalizeLabel(value)
  if (!normalized) return ''
  if (CATEGORY_LABEL_BY_NORMALIZED.has(normalized)) return CATEGORY_LABEL_BY_NORMALIZED.get(normalized)
  return CATEGORY_ALIASES.get(normalized) || ''
}

export function normalizeRfpOpportunityCategory(opportunity) {
  const existing = normalizeRfpCategoryLabel(opportunity?.category)
  if (existing && existing !== 'governance & procurement') return existing

  const searchable = buildSearchableText(opportunity)
  for (const rule of RULES) {
    if (rule.patterns.some((pattern) => pattern.test(searchable))) {
      return rule.label
    }
  }

  return existing || 'sports technology'
}

export function normalizeRfpOpportunityForCategory(opportunity, source = 'rfp_taxonomy_20260518') {
  const originalCategory = text(opportunity?.category)
  const category = normalizeRfpOpportunityCategory(opportunity)
  const opportunityType = normalizeRfpOpportunityType(opportunity)
  const metadata = {
    ...(opportunity?.metadata || {}),
    normalized_category_source: source,
    opportunity_type: opportunityType,
  }

  if (originalCategory && normalizeLabel(originalCategory) !== category) {
    metadata.original_category = metadata.original_category || originalCategory
  }

  return {
    ...opportunity,
    category,
    opportunity_type: opportunityType,
    metadata,
  }
}

function buildSearchableText(opportunity) {
  const metadata = opportunity?.metadata || {}
  const evidence = Array.isArray(metadata.evidence) ? metadata.evidence.join(' ') : ''
  const scopeTags = Array.isArray(metadata.scope_tags) ? metadata.scope_tags.join(' ') : ''
  return [
    opportunity?.category,
    opportunity?.title,
    opportunity?.organization,
    opportunity?.entity_name,
    opportunity?.canonical_entity_name,
    opportunity?.description,
    opportunity?.status,
    metadata.digital_fit_rationale,
    metadata.source_type,
    metadata.temporal_basis,
    metadata.delta_reason,
    evidence,
    scopeTags,
  ]
    .map(text)
    .join(' ')
    .toLowerCase()
}

function normalizeLabel(value) {
  return text(value)
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[/_+-]+/g, ' ')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\band\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^digital platform web development$/, 'digital platform')
}

function text(value) {
  return value === null || value === undefined ? '' : String(value).trim()
}
