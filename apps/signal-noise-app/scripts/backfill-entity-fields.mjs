#!/usr/bin/env node
/**
 * Backfill missing sport/country in canonical_entities by inferring from entity names.
 *
 * Usage:
 *   node scripts/backfill-entity-fields.mjs            # dry-run (report only)
 *   node scripts/backfill-entity-fields.mjs --apply     # apply changes
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

// ── Sport inference from name keywords ───────────────────────────────────────

const SPORT_KEYWORDS = {
  'Football': ['football', 'soccer', ' fc ', ' fc)', ' f.c.', ' cf ', ' cf)', ' c.f.', ' sc ', ' sc)', ' s.c.'],
  'Basketball': ['basketball', 'b.c.', ' nba'],
  'Cricket': ['cricket', ' ipl'],
  'Baseball': ['baseball', ' mlb'],
  'Rugby': ['rugby', ' rfu', ' rfc', 'super rugby'],
  'Ice Hockey': ['hockey', ' nhl'],
  'Tennis': ['tennis', ' atp', ' wta'],
  'Golf': ['golf', ' pga'],
  'Motorsport': ['motorsport', 'formula', ' f1', 'motogp', 'racing'],
  'Cycling': ['cycling', 'tour de'],
  'Athletics': ['athletics', 'track and field', ' iaaf'],
  'Volleyball': ['volleyball', ' fivb'],
  'Handball': ['handball', ' ihf'],
  'Esports': ['esports', 'e-sports', 'gaming'],
  'Swimming': ['swimming', 'aquatics', ' fina'],
  'Boxing': ['boxing', ' wbc', ' wba', ' ibf'],
  'Skiing': [' skiing', ' fis '],
  'Rowing': ['rowing', ' fisa'],
  'Gymnastics': ['gymnastics', ' fig'],
  'Wrestling': ['wrestling'],
  'Badminton': ['badminton', ' bwf'],
  'Table Tennis': ['table tennis'],
  'Equestrian': ['equestrian', ' fei'],
  'Archery': ['archery'],
  'Fencing': ['fencing'],
  'Surfing': ['surfing'],
  'Weightlifting': ['weightlifting'],
  'Polo': ['polo'],
  'Shooting': ['shooting', ' issf'],
  'Skating': ['skating', ' isu'],
  'Curling': ['curling', ' wcf'],
  'Multi-sport': ['olympic', 'ioc ', 'commonwealth games', 'multi-sport'],
}

function inferSportFromName(name) {
  const padded = ` ${String(name || '').toLowerCase()} `
  for (const [sport, keywords] of Object.entries(SPORT_KEYWORDS)) {
    if (keywords.some(kw => padded.includes(kw))) {
      return sport
    }
  }
  return ''
}

// ── Country inference from demonyms and parenthetical hints ──────────────────

// Known country names for parenthetical validation
const KNOWN_COUNTRIES = new Set([
  'united states', 'usa', 'us', 'united kingdom', 'uk', 'england', 'scotland',
  'wales', 'ireland', 'germany', 'france', 'spain', 'italy', 'netherlands',
  'belgium', 'switzerland', 'austria', 'portugal', 'greece', 'poland',
  'croatia', 'serbia', 'czech republic', 'czechia', 'denmark', 'sweden',
  'norway', 'finland', 'iceland', 'russia', 'ukraine', 'turkey', 'türkiye',
  'brazil', 'argentina', 'mexico', 'colombia', 'chile', 'peru', 'uruguay',
  'paraguay', 'ecuador', 'venezuela', 'bolivia', 'cuba', 'jamaica',
  'australia', 'new zealand', 'canada', 'japan', 'south korea', 'china',
  'india', 'pakistan', 'bangladesh', 'sri lanka', 'thailand', 'vietnam',
  'indonesia', 'malaysia', 'philippines', 'singapore', 'taiwan',
  'south africa', 'nigeria', 'egypt', 'morocco', 'tunisia', 'algeria',
  'ghana', 'kenya', 'ethiopia', 'cameroon', 'senegal', 'ivory coast',
  'saudi arabia', 'uae', 'iran', 'iraq', 'israel', 'qatar',
  'georgia', 'armenia', 'azerbaijan', 'kazakhstan', 'uzbekistan',
])

const DEMONYMS = [
  ['united states', 'United States'],
  ['u.s.', 'United States'],
  ['american', 'United States'],
  ['united kingdom', 'United Kingdom'],
  ['u.k.', 'United Kingdom'],
  ['british', 'United Kingdom'],
  ['english', 'England'],
  ['scottish', 'Scotland'],
  ['welsh', 'Wales'],
  ['irish', 'Ireland'],
  ['german', 'Germany'],
  ['french', 'France'],
  ['spanish', 'Spain'],
  ['italian', 'Italy'],
  ['dutch', 'Netherlands'],
  ['belgian', 'Belgium'],
  ['swiss', 'Switzerland'],
  ['austrian', 'Austria'],
  ['portuguese', 'Portugal'],
  ['greek', 'Greece'],
  ['polish', 'Poland'],
  ['croatian', 'Croatia'],
  ['serbian', 'Serbia'],
  ['czech', 'Czech Republic'],
  ['danish', 'Denmark'],
  ['swedish', 'Sweden'],
  ['norwegian', 'Norway'],
  ['finnish', 'Finland'],
  ['russian', 'Russia'],
  ['ukrainian', 'Ukraine'],
  ['turkish', 'Türkiye'],
  ['brazilian', 'Brazil'],
  ['argentin', 'Argentina'],
  ['mexican', 'Mexico'],
  ['colombian', 'Colombia'],
  ['chilean', 'Chile'],
  ['peruvian', 'Peru'],
  ['australian', 'Australia'],
  ['canadian', 'Canada'],
  ['japanese', 'Japan'],
  ['korean', 'South Korea'],
  ['chinese', 'China'],
  ['indian', 'India'],
  ['pakistani', 'Pakistan'],
  ['south african', 'South Africa'],
  ['nigerian', 'Nigeria'],
  ['egyptian', 'Egypt'],
  ['saudi', 'Saudi Arabia'],
  ['new zealand', 'New Zealand'],
  ['tunis', 'Tunisia'],
  ['moroccan', 'Morocco'],
]

const PARENTHETICAL = /\(([A-Z][A-Za-z]+(?:\s[A-Z][A-Za-z]+)*)\)/

function inferCountryFromName(name) {
  const raw = String(name || '').trim()
  if (!raw) return ''
  const padded = ` ${raw.toLowerCase()} `

  // Check demonym prefixes
  for (const [prefix, country] of DEMONYMS) {
    if (padded.includes(` ${prefix} `) || padded.startsWith(`${prefix} `) || padded.endsWith(` ${prefix} `)) {
      return country
    }
  }

  // Check parenthetical hint — only accept known country names
  const parenMatch = raw.match(PARENTHETICAL)
  if (parenMatch) {
    const inner = parenMatch[1].trim().toLowerCase()
    if (KNOWN_COUNTRIES.has(inner)) {
      // Title-case the country name
      return inner.split(' ').map(w => w[0].toUpperCase() + w.slice(1)).join(' ')
    }
  }

  return ''
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function fetchEntitiesWithMissingFields() {
  const rows = []
  const pageSize = 1000
  let offset = 0
  while (true) {
    const { data, error } = await supabase
      .from('canonical_entities')
      .select('id, name, entity_type, sport, country, properties')
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
  console.log(`backfill-entity-fields @ ${new Date().toISOString()}`)
  console.log(`  dry-run: ${DRY_RUN}`)

  const rows = await fetchEntitiesWithMissingFields()
  console.log(`  rows fetched: ${rows.length}`)

  const missingSport = rows.filter(r => !r.sport?.trim())
  const missingCountry = rows.filter(r => !r.country?.trim())
  console.log(`  missing sport: ${missingSport.length}`)
  console.log(`  missing country: ${missingCountry.length}`)

  let sportBackfilled = 0
  let countryBackfilled = 0
  let totalUpdated = 0

  const sportDetail = new Map()
  const countryDetail = new Map()

  for (const row of rows) {
    const patch = {}
    const props = { ...(row.properties || {}) }
    let changed = false

    // Infer sport if missing
    if (!row.sport?.trim()) {
      const inferred = inferSportFromName(row.name)
      if (inferred) {
        patch.sport = inferred
        props.sport = inferred
        sportBackfilled += 1
        changed = true
        const key = `${inferred} (from name)`
        sportDetail.set(key, (sportDetail.get(key) || 0) + 1)
      }
    }

    // Infer country if missing
    if (!row.country?.trim()) {
      const inferred = inferCountryFromName(row.name)
      if (inferred) {
        patch.country = inferred
        props.country = inferred
        countryBackfilled += 1
        changed = true
        const key = `${inferred} (from name)`
        countryDetail.set(key, (countryDetail.get(key) || 0) + 1)
      }
    }

    if (changed) {
      if (JSON.stringify(props) !== JSON.stringify(row.properties || {})) {
        patch.properties = props
      }
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
  console.log(`  Sport backfilled: ${sportBackfilled}`)
  console.log(`  Country backfilled: ${countryBackfilled}`)
  console.log(`  Total rows updated: ${totalUpdated}`)

  const pad = (n) => String(n).padStart(4, ' ')

  if (sportDetail.size > 0) {
    console.log('\n=== Sport inferences ===')
    for (const [label, count] of [...sportDetail.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${pad(count)}  ${label}`)
    }
  }

  if (countryDetail.size > 0) {
    console.log('\n=== Country inferences ===')
    for (const [label, count] of [...countryDetail.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${pad(count)}  ${label}`)
    }
  }

  if (DRY_RUN) {
    console.log('\n  (dry-run — no changes written. Use --apply to write.)')
  }
}

run().catch((error) => {
  console.error('backfill-entity-fields failed:', error?.message || error)
  process.exit(1)
})
