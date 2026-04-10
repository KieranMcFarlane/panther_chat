function toNormalizedText(value) {
  if (value === null || value === undefined) return ''
  return String(value).trim().replace(/\s+/g, ' ')
}

function normalizeFacetKey(value) {
  return toNormalizedText(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

function normalizeFacetLabel(value) {
  return toNormalizedText(value)
}

function toDisplayLabel(value) {
  const text = normalizeFacetLabel(value)
  if (!text) return ''

  const acronyms = new Set(['EOI', 'RFP', 'RFI', 'RFQ', 'RFT', 'IOC', 'IFA', 'FIFA', 'UEFA', 'NBA', 'NFL', 'MLB', 'NHL', 'WPL', 'IPL', 'UCI', 'USA', 'UK', 'EU'])
  return text
    .split(' ')
    .filter(Boolean)
    .map((word) => {
      const upper = word.toUpperCase()
      if (acronyms.has(upper)) return upper
      if (/^[ivxlcdm]+$/i.test(word)) return upper
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    })
    .join(' ')
}

function firstNonEmpty(...values) {
  for (const value of values) {
    const text = normalizeFacetLabel(value)
    if (text) return text
  }
  return ''
}

function normalizeTextKey(value) {
  return normalizeFacetKey(value)
}

function includesAny(value, needles) {
  const haystack = normalizeTextKey(value)
  const haystackTokens = haystack.split(' ').filter(Boolean)
  return needles.some((needle) => {
    const normalizedNeedle = normalizeTextKey(needle)
    if (!normalizedNeedle) return false

    if (!normalizedNeedle.includes(' ')) {
      return haystackTokens.includes(normalizedNeedle)
    }

    return haystack.includes(normalizedNeedle)
  })
}

function resolveCanonicalEntity(opportunity, canonicalEntities = []) {
  const directId = normalizeFacetKey(opportunity.canonical_entity_id)
  const directName = normalizeFacetKey(opportunity.canonical_entity_name)

  for (const entity of canonicalEntities || []) {
    const entityId = normalizeFacetKey(entity?.id || entity?.neo4j_id || entity?.graph_id)
    const entityName = normalizeFacetKey(entity?.properties?.name)

    if (directId && entityId && directId === entityId) return entity
    if (directName && entityName && directName === entityName) return entity
  }

  return null
}

function inferEntityRoleFromEntity(entity) {
  const properties = entity?.properties || {}
  const type = normalizeTextKey(properties.type || properties.entityClass || properties.entity_class || entity?.labels?.[0] || '')

  if (includesAny(type, ['club'])) return 'Club'
  if (includesAny(type, ['team'])) return 'Team'
  if (includesAny(type, ['league', 'competition'])) return 'League'
  if (includesAny(type, ['federation', 'association', 'union'])) return 'Federation'
  if (includesAny(type, ['organizer', 'committee', 'event'])) return 'Organizer'
  if (includesAny(type, ['venue', 'stadium', 'arena'])) return 'Venue'
  if (includesAny(type, ['government', 'agency', 'ministry', 'commission'])) return 'Government'
  if (includesAny(type, ['brand'])) return 'Brand'
  if (includesAny(type, ['university', 'college'])) return 'Institution'
  if (includesAny(type, ['organization'])) return 'Organization'

  return ''
}

function inferSport(text, opportunity) {
  const knownSportRules = [
    { sport: 'Football', needles: ['football', 'soccer', 'epl', 'premier league', 'champions league', 'uefa', 'fifa world cup', 'la liga', 'bundesliga', 'serie a', 'wsl', 'womens super league'] },
    { sport: 'Cricket', needles: ['cricket', 'ipl', 'wpl', 'major league cricket', 'icc', 'bcci'] },
    { sport: 'Tennis', needles: ['tennis', 'wimbledon', 'australian open', 'roland garros', 'us open'] },
    { sport: 'Rugby', needles: ['rugby', 'six nations', 'world rugby'] },
    { sport: 'Basketball', needles: ['basketball', 'nba', 'wnba'] },
    { sport: 'Motorsport', needles: ['motorsport', 'formula 1', 'formula one', 'f1', 'grand prix'] },
    { sport: 'Athletics', needles: ['athletics', 'world athletics', 'diamond league'] },
    { sport: 'Cycling', needles: ['cycling', 'uci', 'tour de france'] },
    { sport: 'Canoeing', needles: ['canoe', 'canoeing', 'canoe sprint', 'canoe slalom'] },
    { sport: 'Biathlon', needles: ['biathlon'] },
    { sport: 'Archery', needles: ['archery', 'world archery'] },
    { sport: 'Aquatics', needles: ['aquatics', 'swimming', 'diving', 'water polo'] },
    { sport: 'Rowing', needles: ['rowing', 'regatta'] },
    { sport: 'Volleyball', needles: ['volleyball'] },
    { sport: 'Golf', needles: ['golf', 'pga tour', 'the open championship'] },
    { sport: 'Baseball', needles: ['baseball', 'mlb'] },
    { sport: 'Hockey', needles: ['hockey', 'nhl'] },
    { sport: 'Multi-Sport', needles: ['olympic', 'olympics', 'ioc', 'multi-sport'] },
  ]

  for (const rule of knownSportRules) {
    if (includesAny(text, rule.needles)) return rule.sport
  }

  const entitySport = normalizeFacetLabel(opportunity?.canonical_entity_sport)
  if (entitySport) return entitySport

  return ''
}

function inferCompetition(text, opportunity, entity) {
  const competitionRules = [
    { competition: 'Premier League', sport: 'Football', role: 'League', needles: ['premier league', 'english premier league', 'epl'] },
    { competition: 'UEFA Champions League', sport: 'Football', role: 'League', needles: ['uefa champions league', 'champions league'] },
    { competition: 'La Liga', sport: 'Football', role: 'League', needles: ['la liga', 'laliga'] },
    { competition: 'Bundesliga', sport: 'Football', role: 'League', needles: ['bundesliga'] },
    { competition: 'Serie A', sport: 'Football', role: 'League', needles: ['serie a'] },
    { competition: 'Major League Cricket', sport: 'Cricket', role: 'League', needles: ['major league cricket', 'mlc'] },
    { competition: 'Indian Premier League', sport: 'Cricket', role: 'League', needles: ['indian premier league', 'ipl'] },
    { competition: "Women's Premier League", sport: 'Cricket', role: 'League', needles: ['women s premier league', "women's premier league", 'wpl'] },
    { competition: 'Wimbledon', sport: 'Tennis', role: 'Tournament', needles: ['wimbledon', 'the championships'] },
    { competition: 'Australian Open', sport: 'Tennis', role: 'Tournament', needles: ['australian open'] },
    { competition: 'FIFA World Cup', sport: 'Football', role: 'Tournament', needles: ['fifa world cup', 'world cup'] },
    { competition: 'Olympic Games', sport: 'Multi-Sport', role: 'Organizer', needles: ['olympic games', 'olympics'] },
    { competition: 'World Athletics', sport: 'Athletics', role: 'Federation', needles: ['world athletics'] },
    { competition: 'World Rugby', sport: 'Rugby', role: 'Federation', needles: ['world rugby'] },
    { competition: 'NBA', sport: 'Basketball', role: 'League', needles: ['nba'] },
    { competition: 'WNBA', sport: 'Basketball', role: 'League', needles: ['wnba'] },
    { competition: 'NFL', sport: 'Football', role: 'League', needles: ['nfl'] },
    { competition: 'MLB', sport: 'Baseball', role: 'League', needles: ['mlb'] },
    { competition: 'NHL', sport: 'Hockey', role: 'League', needles: ['nhl'] },
    { competition: 'PGA Tour', sport: 'Golf', role: 'Tour', needles: ['pga tour'] },
    { competition: 'UCI Cycling Esports World Championships', sport: 'Cycling', role: 'Tournament', needles: ['uci cycling esports world championships'] },
  ]

  for (const rule of competitionRules) {
    if (includesAny(text, rule.needles)) {
      return { competition: rule.competition, sport: rule.sport, role: rule.role }
    }
  }

  const entityRole = inferEntityRoleFromEntity(entity)
  const entityName = normalizeFacetLabel(entity?.properties?.name)
  if (entityRole === 'League' && entityName) {
    return { competition: entityName, sport: normalizeFacetLabel(entity?.properties?.sport), role: entityRole }
  }
  if (entityRole === 'Organizer' && includesAny(entityName, ['olympic', 'world athletics', 'world rugby', 'fifa', 'uefa'])) {
    return { competition: entityName, sport: normalizeFacetLabel(entity?.properties?.sport), role: entityRole }
  }

  return { competition: '', sport: '', role: '' }
}

function inferOpportunityKind(text, opportunity) {
  const kindRules = [
    { kind: 'RFP', needles: ['request for proposal', 'rfp', 'request for information', 'rfi', 'expression of interest', 'eoi'] },
    { kind: 'Tender', needles: ['request for tender', 'rft', 'invitation to tender', 'itt', 'tender'] },
    { kind: 'Procurement', needles: ['procurement', 'purchase', 'bid invitation', 'supplier selection'] },
    { kind: 'Partnership', needles: ['partnership', 'partner', 'commercial partnership', 'sponsorship', 'activation'] },
    { kind: 'Grant', needles: ['grant', 'funding', 'investment', 'award'] },
    { kind: 'Hosting', needles: ['host', 'hosting', 'venue', 'event delivery'] },
  ]

  const sourceText = [
    opportunity?.type,
    opportunity?.category,
    opportunity?.subcategory,
    opportunity?.status,
    text,
  ].join(' ')

  for (const rule of kindRules) {
    if (includesAny(sourceText, rule.needles)) return rule.kind
  }

  return ''
}

function inferTheme(text, opportunity) {
  const themeRules = [
    { theme: 'Digital Transformation', needles: ['digital transformation', 'website', 'web development', 'mobile app', 'mobile application', 'platform', 'technology infrastructure', 'modernization', 'cms', 'api', 'cloud migration', 'software development'] },
    { theme: 'Fan Engagement', needles: ['fan engagement', 'fan experience', 'personalization', 'loyalty', 'community', 'supporter', 'membership'] },
    { theme: 'Ticketing', needles: ['ticketing', 'tickets', 'ticket sales', 'ticketing system'] },
    { theme: 'Content', needles: ['content', 'broadcast', 'media', 'streaming', 'video', 'rights management', 'cms'] },
    { theme: 'Analytics', needles: ['analytics', 'data', 'statistics', 'results', 'performance', 'insights', 'dashboard'] },
    { theme: 'Infrastructure', needles: ['infrastructure', 'venue', 'stadium', 'operations platform', 'operating platform', 'control solution'] },
    { theme: 'Operations', needles: ['operations', 'management', 'procurement', 'services', 'service provider', 'delivery'] },
    { theme: 'Commerce', needles: ['commerce', 'e-commerce', 'merchandise', 'store', 'payment', 'crm'] },
  ]

  const sourceText = [
    opportunity?.title,
    opportunity?.description,
    opportunity?.category,
    opportunity?.type,
    text,
  ].join(' ')

  for (const rule of themeRules) {
    if (includesAny(sourceText, rule.needles)) return rule.theme
  }

  return ''
}

function buildTaxonomyFromSources(opportunity, canonicalEntities = []) {
  const resolvedEntity = resolveCanonicalEntity(opportunity, canonicalEntities)
  const resolvedEntityRole = inferEntityRoleFromEntity(resolvedEntity)
  const sourceText = [
    opportunity?.title,
    opportunity?.organization,
    opportunity?.category,
    opportunity?.subcategory,
    opportunity?.type,
    opportunity?.description,
    opportunity?.status,
    opportunity?.source,
    opportunity?.location,
    resolvedEntity?.properties?.name,
    resolvedEntity?.properties?.sport,
  ].join(' ')

  const competitionInference = inferCompetition(sourceText, opportunity, resolvedEntity)
  const sport =
    competitionInference.sport ||
    inferSport(sourceText, opportunity) ||
    normalizeFacetLabel(resolvedEntity?.properties?.sport) ||
    ''

  const competition =
    competitionInference.competition ||
    firstNonEmpty(
      resolvedEntity?.properties?.competition,
      resolvedEntity?.properties?.league,
    )

  const entity_role =
    competitionInference.role ||
    resolvedEntityRole

  const opportunity_kind =
    inferOpportunityKind(sourceText, opportunity)

  const theme =
    inferTheme(sourceText, opportunity) ||
    ''

  return {
    sport: sport ? toDisplayLabel(sport) : '',
    competition: competition ? toDisplayLabel(competition) : '',
    entity_role: entity_role ? toDisplayLabel(entity_role) : '',
    opportunity_kind: opportunity_kind ? toDisplayLabel(opportunity_kind) : '',
    theme: theme ? toDisplayLabel(theme) : '',
  }
}

function toFacetOptions(values) {
  const seen = new Set()
  const options = []
  for (const value of values) {
    const label = toDisplayLabel(value)
    const key = normalizeFacetKey(label)
    if (!key || seen.has(key)) continue
    seen.add(key)
    options.push({ label, value: label })
  }
  options.sort((left, right) => left.label.localeCompare(right.label))
  return [{ label: 'All', value: 'all' }, ...options]
}

export function normalizeOpportunityTaxonomy(opportunity, canonicalEntities = []) {
  return buildTaxonomyFromSources(opportunity, canonicalEntities)
}

export function buildOpportunityFacetOptions(opportunities = []) {
  const taxonomyValues = {
    sport: new Set(),
    competition: new Set(),
    entity_role: new Set(),
    opportunity_kind: new Set(),
    theme: new Set(),
  }

  for (const opportunity of opportunities || []) {
    const taxonomy = opportunity?.taxonomy || normalizeOpportunityTaxonomy(opportunity)
    taxonomyValues.sport.add(taxonomy.sport)
    taxonomyValues.competition.add(taxonomy.competition)
    taxonomyValues.entity_role.add(taxonomy.entity_role)
    taxonomyValues.opportunity_kind.add(taxonomy.opportunity_kind)
    taxonomyValues.theme.add(taxonomy.theme)
  }

  return {
    sport: toFacetOptions(Array.from(taxonomyValues.sport).filter(Boolean)),
    competition: toFacetOptions(Array.from(taxonomyValues.competition).filter(Boolean)),
    entity_role: toFacetOptions(Array.from(taxonomyValues.entity_role).filter(Boolean)),
    opportunity_kind: toFacetOptions(Array.from(taxonomyValues.opportunity_kind).filter(Boolean)),
    theme: toFacetOptions(Array.from(taxonomyValues.theme).filter(Boolean)),
  }
}

export function getOpportunityTaxonomyDisplayValues(taxonomy) {
  return {
    sport: taxonomy?.sport || '',
    competition: taxonomy?.competition || '',
    entity_role: taxonomy?.entity_role || '',
    opportunity_kind: taxonomy?.opportunity_kind || '',
    theme: taxonomy?.theme || '',
  }
}
