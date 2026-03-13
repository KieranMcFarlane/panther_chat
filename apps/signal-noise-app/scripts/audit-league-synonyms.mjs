#!/usr/bin/env node
import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import path from 'node:path'

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

const KNOWN_ALIAS_GROUPS = [
  ['premier league', 'english premier league', 'epl'],
  ['indian premier league', 'ipl'],
  ['la liga', 'laliga', 'spanish laliga', 'la liga santander'],
  ['major league soccer', 'mls'],
  ['bundesliga', 'german bundesliga'],
  ['serie a', 'italian serie a'],
  ['ligue 1', 'french ligue 1'],
  ['efl championship', 'english league championship'],
  ['uefa champions league', 'champions league', 'ucl'],
]

const COUNTRYISH_TOKENS = new Set([
  'english', 'scottish', 'welsh', 'irish', 'french', 'german', 'italian', 'spanish', 'portuguese',
  'ukrainian', 'egyptian', 'nigerian', 'israeli', 'australian', 'austrian', 'russian', 'indian',
  'bangladesh', 'sri', 'lanka', 'argentine', 'brazilian', 'japanese', 'korean', 'chinese', 'saudi',
  'qatar', 'uae', 'mexican', 'us', 'usa', 'american', 'european', 'african',
])

const GENERIC_LEAGUE_FORMS = new Set([
  'premier league',
  'championship',
  'league one',
  'league two',
  'serie a',
  'ligue 1',
  'champions league',
])

const QUALIFIER_TOKENS = new Set([
  'women', 'womens', 'frau', 'frauen', 'men', 'mens', 'youth', 'junior', 'u17', 'u18', 'u19', 'u20', 'u21', 'u23',
  'reserve', 'reserves', 'first', 'second', 'third', '2', 'ii', 'one', 'two',
])

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function title(value) {
  return String(value || '')
    .split(' ')
    .filter(Boolean)
    .map((t) => t.charAt(0).toUpperCase() + t.slice(1))
    .join(' ')
}

function tokenSet(value) {
  return new Set(normalizeText(value).split(' ').filter(Boolean))
}

function jaccard(a, b) {
  const inter = [...a].filter((t) => b.has(t)).length
  const union = new Set([...a, ...b]).size
  return union === 0 ? 0 : inter / union
}

function acronym(value) {
  return normalizeText(value)
    .split(' ')
    .filter((token) => token.length > 2)
    .map((token) => token[0])
    .join('')
}

function inKnownAliasGroup(a, b) {
  const na = normalizeText(a)
  const nb = normalizeText(b)
  return KNOWN_ALIAS_GROUPS.some((group) => {
    const g = group.map(normalizeText)
    return g.includes(na) && g.includes(nb)
  })
}

function countryishTokens(tokens) {
  return [...tokens].filter((t) => COUNTRYISH_TOKENS.has(t))
}

function isLikelyUnsafeGeographicMerge(aNorm, bNorm, aTokens, bTokens) {
  const aCountries = countryishTokens(aTokens)
  const bCountries = countryishTokens(bTokens)
  const hasCountryMismatch =
    aCountries.some((t) => !bTokens.has(t)) || bCountries.some((t) => !aTokens.has(t))

  if (!hasCountryMismatch) return false

  const aGeneric = GENERIC_LEAGUE_FORMS.has(aNorm)
  const bGeneric = GENERIC_LEAGUE_FORMS.has(bNorm)

  return aGeneric || bGeneric
}

function hasConflictingQualifiers(aTokens, bTokens) {
  const aQual = [...aTokens].filter((t) => QUALIFIER_TOKENS.has(t))
  const bQual = [...bTokens].filter((t) => QUALIFIER_TOKENS.has(t))
  if (aQual.length === 0 && bQual.length === 0) return false
  const mismatchA = aQual.some((t) => !bTokens.has(t))
  const mismatchB = bQual.some((t) => !aTokens.has(t))
  return mismatchA || mismatchB
}

function candidateScore(a, b) {
  const aNorm = normalizeText(a.name)
  const bNorm = normalizeText(b.name)
  if (!aNorm || !bNorm || aNorm === bNorm) return null

  if (inKnownAliasGroup(aNorm, bNorm)) return null
  if (a.sport && b.sport && normalizeText(a.sport) !== normalizeText(b.sport)) return null

  const aTokens = tokenSet(aNorm)
  const bTokens = tokenSet(bNorm)

  if (isLikelyUnsafeGeographicMerge(aNorm, bNorm, aTokens, bTokens)) return null
  if (hasConflictingQualifiers(aTokens, bTokens)) return null

  const reasons = []
  let score = 0

  const jac = jaccard(aTokens, bTokens)
  if (jac >= 0.7) {
    score += 0.45
    reasons.push(`high token overlap (${jac.toFixed(2)})`)
  } else if (jac >= 0.5) {
    score += 0.3
    reasons.push(`moderate token overlap (${jac.toFixed(2)})`)
  }

  const short = aNorm.length < bNorm.length ? aNorm : bNorm
  const long = aNorm.length < bNorm.length ? bNorm : aNorm
  if (long.includes(short) && short.length >= 8) {
    score += 0.25
    reasons.push('substring containment')
  }

  const aAcr = acronym(aNorm)
  const bAcr = acronym(bNorm)
  if ((aAcr && aAcr === bNorm.replace(/\s/g, '')) || (bAcr && bAcr === aNorm.replace(/\s/g, ''))) {
    score += 0.4
    reasons.push('acronym expansion match')
  }

  if (a.sport && b.sport && normalizeText(a.sport) === normalizeText(b.sport)) {
    score += 0.1
  }

  const highSignalTokens = ['uefa', 'efl', 'laliga', 'bundesliga', 'mls', 'champions']
  const sharedHighSignal = highSignalTokens.filter((token) => aTokens.has(token) && bTokens.has(token))
  if (sharedHighSignal.length > 0) {
    score += 0.1
    reasons.push(`shared markers (${sharedHighSignal.join(', ')})`)
  }

  if (score < 0.65) return null

  const recommendedCanonical = aNorm.length <= bNorm.length ? title(aNorm) : title(bNorm)
  return {
    a: a.name,
    b: b.name,
    sport: a.sport || b.sport || '',
    score: Number(score.toFixed(3)),
    reasons,
    recommended_canonical: recommendedCanonical,
  }
}

async function run() {
  const { data, error } = await supabase
    .from('canonical_entities')
    .select('name,entity_type,sport,league')
    .limit(10000)

  if (error) throw error

  const leagueValues = new Map()

  for (const row of data || []) {
    const type = normalizeText(row.entity_type)
    if (type === 'league' && row.name) {
      const key = normalizeText(row.name)
      if (key) leagueValues.set(key, { name: row.name, sport: row.sport || '' })
    }
    const l = normalizeText(row.league)
    if (l) {
      if (!leagueValues.has(l)) {
        leagueValues.set(l, { name: title(l), sport: row.sport || '' })
      }
    }
  }

  const leagues = [...leagueValues.values()].sort((x, y) => x.name.localeCompare(y.name))
  const candidates = []

  for (let i = 0; i < leagues.length; i += 1) {
    for (let j = i + 1; j < leagues.length; j += 1) {
      const cand = candidateScore(leagues[i], leagues[j])
      if (cand) candidates.push(cand)
    }
  }

  candidates.sort((a, b) => b.score - a.score || a.a.localeCompare(b.a) || a.b.localeCompare(b.b))

  const uniquePairs = []
  const seen = new Set()
  for (const c of candidates) {
    const key = [normalizeText(c.a), normalizeText(c.b)].sort().join('::')
    if (seen.has(key)) continue
    seen.add(key)
    uniquePairs.push(c)
  }

  const high = uniquePairs.filter((c) => c.score >= 0.85)
  const medium = uniquePairs.filter((c) => c.score >= 0.75 && c.score < 0.85)

  const now = new Date().toISOString()
  const day = now.slice(0, 10)
  const outDir = path.resolve('docs/reports')
  fs.mkdirSync(outDir, { recursive: true })
  const outPath = path.join(outDir, `${day}-league-synonym-audit.json`)

  const payload = {
    generated_at: now,
    total_unique_league_values: leagues.length,
    known_alias_groups: KNOWN_ALIAS_GROUPS,
    high_confidence_candidates: high,
    medium_confidence_candidates: medium,
    all_candidates: uniquePairs,
  }

  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2))

  console.log(`league-synonym-audit report: ${outPath}`)
  console.log(`- Unique league values scanned: ${leagues.length}`)
  console.log(`- High confidence candidates: ${high.length}`)
  console.log(`- Medium confidence candidates: ${medium.length}`)

  if (high.length > 0) {
    console.log('Top high-confidence candidates:')
    for (const c of high.slice(0, 15)) {
      console.log(`  - [${c.score}] ${c.a} <=> ${c.b} | canonical: ${c.recommended_canonical}`)
    }
  }
}

run().catch((err) => {
  console.error('audit-league-synonyms failed:', err?.message || err)
  process.exit(1)
})
