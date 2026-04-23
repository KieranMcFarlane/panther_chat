#!/usr/bin/env node
/**
 * Normalize sport, country, and entity_type values in the canonical_entities table.
 *
 * Usage:
 *   node scripts/normalize-canonical-entities.mjs            # dry-run (report only)
 *   node scripts/normalize-canonical-entities.mjs --apply     # apply changes
 */
import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const DRY_RUN = !process.argv.includes('--apply')

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing Supabase environment variables.')
  process.exit(2)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

// ── Sport normalization ──────────────────────────────────────────────────────

const SPORT_ALIASES = {
  Football: [
    'football', 'soccer', 'football club', 'football league', 'futsal',
    'beach soccer', 'association football',
  ],
  Basketball: [
    'basketball', 'basketball club', 'basketball league',
  ],
  Cricket: [
    'cricket', 'cricket team', 'cricket club', 'cricket governing body',
    'cricket (first-class)', 'cricket (t20)', "cricket (women's)",
    'national cricket federation',
  ],
  Baseball: [
    'baseball', 'baseball club', 'baseball federation', 'baseball/softball',
  ],
  Cycling: [
    'cycling', 'cycling team', 'cycling federation', 'cycling race',
  ],
  Motorsport: [
    'motorsport', 'motorsport team', 'motorsport venue', 'motorsport championship',
    'formula 1 team', 'formula one', 'motorcycling', 'formula 1', 'f1',
  ],
  Rugby: [
    'rugby', 'rugby union', 'rugby league', 'rugby club', 'rugby federation',
    'rugby league federation',
  ],
  Volleyball: [
    'volleyball', 'volleyball club', 'volleyball league',
  ],
  Golf: [
    'golf', 'golf tournament', 'golf tour',
  ],
  Handball: [
    'handball', 'handball club',
  ],
  'Ice Hockey': [
    'ice hockey', 'ice hockey club',
  ],
  'Australian Rules Football': [
    'australian football', 'australian rules football',
  ],
  'American Football': [
    'american football',
  ],
  Athletics: [
    'athletics', 'athletics federation', 'athletics (track & field)',
  ],
  'Multi-sport': [
    'multi-sport', 'multi-sport (aquatics)', 'multi-sport university',
  ],
}

// Non-sport / tech-business entity types — leave these untouched
const NON_SPORT_ENTRIES = new Set([
  'analytics_platform', 'ai/ml', 'backend development', 'crm_upgrade',
  'data engineering', 'digital_transformation', 'fan engagement',
  'gamification', 'mobile development', 'system integration',
  'ticketing_system', 'vendor_management', 'procurement', 'design',
  'e-commerce', 'web development', 'analytics', 'leadership',
  'sports investment', 'sports tech',
])

const sportLookup = new Map()
for (const [canonical, aliases] of Object.entries(SPORT_ALIASES)) {
  for (const alias of aliases) {
    sportLookup.set(alias.toLowerCase().trim(), canonical)
  }
}

function normalizeSport(value) {
  const raw = String(value || '').trim()
  if (!raw) return ''
  const key = raw.toLowerCase().trim()
  if (NON_SPORT_ENTRIES.has(key)) return raw // leave tech/business as-is
  return sportLookup.get(key) || raw
}

// ── Country normalization ────────────────────────────────────────────────────

const COUNTRY_ALIASES = {
  'United States': [
    'usa', 'us', 'united states of america', 'u.s.a.',
    'us virgin islands',
  ],
  'United Kingdom': [
    'uk', 'great britain', 'britain',
  ],
  'Türkiye': [
    'turkey',
  ],
  England: [
    'england & wales', 'england/france',
  ],
  Taiwan: [
    'chinese taipei',
  ],
}

const countryLookup = new Map()
for (const [canonical, aliases] of Object.entries(COUNTRY_ALIASES)) {
  for (const alias of aliases) {
    countryLookup.set(alias.toLowerCase().trim(), canonical)
  }
}

// US states → United States
const US_STATES = new Set([
  'alabama', 'alaska', 'arizona', 'arkansas', 'california', 'colorado',
  'connecticut', 'delaware', 'florida', 'hawaii', 'idaho',
  'illinois', 'indiana', 'iowa', 'kansas', 'kentucky', 'louisiana',
  'maine', 'maryland', 'massachusetts', 'michigan', 'minnesota',
  'mississippi', 'missouri', 'montana', 'nebraska', 'nevada',
  'new hampshire', 'new jersey', 'new mexico', 'new york',
  'north carolina', 'north dakota', 'ohio', 'oklahoma', 'oregon',
  'pennsylvania', 'rhode island', 'south carolina', 'south dakota',
  'tennessee', 'texas', 'utah', 'vermont', 'virginia', 'washington',
  'west virginia', 'wisconsin', 'wyoming', 'washington dc', 'dc',
])

// Regional labels — these are multi-region descriptors, not single countries
const REGIONAL_LABELS = new Set([
  'north/central america, caribbean',
  'north america, caribbean',
  'europe/africa',
  'russia/euro-asia',
  'germany/europe',
  'australia/nz/pacific',
  'belgium/netherlands',
  'germany/uk',
  'germany/usa',
  'austria/uk',
  'france/uk',
])

// Multi-country patterns — take the first listed country (only matches /)
const MULTI_COUNTRY_SPLIT = /^(.+?)\s*\/\s*(.+)$/

// City, Region, Country — extract country part
const CITY_REGION_COUNTRY = /^(.+?),\s*(.+?),\s*(.+)$/

function normalizeCountry(value) {
  const raw = String(value || '').trim()
  if (!raw) return ''

  const key = raw.toLowerCase().trim()

  // Direct alias lookup
  if (countryLookup.has(key)) return countryLookup.get(key)

  // Regional labels — pass through unchanged
  if (REGIONAL_LABELS.has(key)) return raw

  // US states
  if (US_STATES.has(key)) return 'United States'

  // "Barcelona, Catalonia, Spain" → extract "Spain"
  const cityMatch = raw.match(CITY_REGION_COUNTRY)
  if (cityMatch) {
    const country = cityMatch[3].trim()
    return normalizeCountry(country) || country
  }

  // "USA/Canada" → take first → "United States"
  const multiMatch = raw.match(MULTI_COUNTRY_SPLIT)
  if (multiMatch) {
    const first = multiMatch[1].trim()
    return normalizeCountry(first) || first
  }

  return raw
}

// ── Entity type normalization ────────────────────────────────────────────────

const ENTITY_TYPE_ALIASES = {
  Club: ['club', 'team', 'sports entity', 'sport entity', 'sport club', 'sports club'],
  League: ['league', 'competition', 'tournament'],
  Federation: ['federation', 'governing body', 'association', 'confederation'],
  Organisation: ['organisation', 'organization', 'org', 'company'],
  Person: ['person', 'individual'],
  Venue: ['venue', 'stadium', 'arena'],
  Product: ['product'],
  Initiative: ['initiative', 'yellowpanther'],
}

const entityTypeLookup = new Map()
for (const [canonical, aliases] of Object.entries(ENTITY_TYPE_ALIASES)) {
  for (const alias of aliases) {
    entityTypeLookup.set(alias.toLowerCase().trim(), canonical)
  }
}

function normalizeEntityType(value) {
  const raw = String(value || '').trim()
  if (!raw) return ''
  const key = raw.toLowerCase().trim()
  return entityTypeLookup.get(key) || raw
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function fetchAllEntities() {
  const rows = []
  const pageSize = 1000
  let offset = 0
  while (true) {
    const { data, error } = await supabase
      .from('canonical_entities')
      .select('id, name, entity_type, sport, league, country, canonical_key, properties')
      .order('id', { ascending: true })
      .range(offset, offset + pageSize - 1)
    if (error) throw error
    const page = data || []
    rows.push(...page)
    if (page.length < pageSize) break
    offset += pageSize
  }
  return rows
}

async function run() {
  console.log(`normalize-canonical-entities @ ${new Date().toISOString()}`)
  console.log(`  dry-run: ${DRY_RUN}`)

  const rows = await fetchAllEntities()
  console.log(`  rows fetched: ${rows.length}`)

  let sportChanges = 0
  let countryChanges = 0
  let typeChanges = 0
  let totalUpdated = 0

  const sportChangesDetail = new Map()
  const countryChangesDetail = new Map()
  const typeChangesDetail = new Map()

  for (const row of rows) {
    const patch = {}
    const props = { ...(row.properties || {}) }

    // Sport
    const currentSport = String(row.sport || '').trim()
    const newSport = normalizeSport(currentSport)
    if (newSport && newSport !== currentSport) {
      patch.sport = newSport
      props.sport = newSport
      sportChanges += 1
      const detailKey = `${currentSport} → ${newSport}`
      sportChangesDetail.set(detailKey, (sportChangesDetail.get(detailKey) || 0) + 1)
    }

    // Country
    const currentCountry = String(row.country || '').trim()
    const newCountry = normalizeCountry(currentCountry)
    if (newCountry && newCountry !== currentCountry) {
      patch.country = newCountry
      props.country = newCountry
      countryChanges += 1
      const detailKey = `${currentCountry} → ${newCountry}`
      countryChangesDetail.set(detailKey, (countryChangesDetail.get(detailKey) || 0) + 1)
    }

    // Entity type
    const currentType = String(row.entity_type || '').trim()
    const newType = normalizeEntityType(currentType)
    if (newType && newType !== currentType) {
      patch.entity_type = newType
      props.type = newType
      typeChanges += 1
      const detailKey = `${currentType} → ${newType}`
      typeChangesDetail.set(detailKey, (typeChangesDetail.get(detailKey) || 0) + 1)
    }

    if (Object.keys(patch).length > 0 || JSON.stringify(props) !== JSON.stringify(row.properties || {})) {
      patch.properties = props
      if (!DRY_RUN) {
        const { error: updateError } = await supabase
          .from('canonical_entities')
          .update(patch)
          .eq('id', row.id)
        if (updateError) throw updateError
      }
      totalUpdated += 1
    }
  }

  console.log('\n=== Summary ===')
  console.log(`  Sport normalizations: ${sportChanges}`)
  console.log(`  Country normalizations: ${countryChanges}`)
  console.log(`  Entity type normalizations: ${typeChanges}`)
  console.log(`  Total rows updated: ${totalUpdated}`)

  const pad = (n) => String(n).padStart(4, ' ')

  if (sportChangesDetail.size > 0) {
    console.log('\n=== Sport mappings applied ===')
    for (const [mapping, count] of [...sportChangesDetail.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${pad(count)}  ${mapping}`)
    }
  }

  if (countryChangesDetail.size > 0) {
    console.log('\n=== Country mappings applied ===')
    for (const [mapping, count] of [...countryChangesDetail.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${pad(count)}  ${mapping}`)
    }
  }

  if (typeChangesDetail.size > 0) {
    console.log('\n=== Entity type mappings applied ===')
    for (const [mapping, count] of [...typeChangesDetail.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${pad(count)}  ${mapping}`)
    }
  }

  if (DRY_RUN) {
    console.log('\n  (dry-run — no changes written. Use --apply to write.)')
  }
}

run().catch((error) => {
  console.error('normalize-canonical-entities failed:', error?.message || error)
  process.exit(1)
})
