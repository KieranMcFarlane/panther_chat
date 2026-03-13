#!/usr/bin/env node
import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const DRY_RUN = process.argv.includes('--dry-run')

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

const LEAGUE_ALIASES = {
  'premier league': ['premier league', 'english premier league', 'epl'],
  'indian premier league': ['indian premier league', 'ipl'],
  'la liga': ['la liga', 'laliga', 'spanish laliga', 'la liga santander'],
  'major league soccer': ['major league soccer', 'mls'],
  'bundesliga': ['bundesliga', 'german bundesliga'],
  'serie a': ['serie a', 'italian serie a'],
  'ligue 1': ['ligue 1', 'french ligue 1'],
  'efl championship': ['efl championship', 'english league championship'],
  'uefa champions league': ['uefa champions league', 'champions league', 'ucl'],
}

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function titleCase(value) {
  return String(value || '')
    .split(' ')
    .filter(Boolean)
    .map((token) => token[0].toUpperCase() + token.slice(1))
    .join(' ')
}

function canonicalizeLeague(value) {
  const n = normalizeText(value)
  if (!n) return ''
  for (const [canonical, aliases] of Object.entries(LEAGUE_ALIASES)) {
    if (aliases.map(normalizeText).includes(n)) {
      return canonical
    }
  }
  return n
}

function isJunkLeagueValue(value) {
  const raw = String(value || '').trim()
  const n = normalizeText(value)
  if (!n) return true
  if (/^[0-9]+$/.test(n)) return true
  if (/^tier[\s_-]*[0-9]+$/.test(n)) return true
  if (/^(unknown|professional|elite|division|tier|first|second|third|n\/a|na|null|none)$/.test(n)) return true
  if (/^entity\s+[0-9]+$/.test(n)) return true
  if (/^(type|system|location)$/.test(n)) return true
  const isUpperAcronym = /^[A-Z]{2,5}$/.test(raw)
  if (n.length < 4 && !isUpperAcronym) return true
  return false
}

async function fetchAllEntities() {
  const rows = []
  const chunk = 1000
  let offset = 0
  while (true) {
    const { data, error } = await supabase
      .from('canonical_entities')
      .select('id,name,normalized_name,entity_type,league,properties')
      .order('id', { ascending: true })
      .range(offset, offset + chunk - 1)
    if (error) throw error
    const page = data || []
    rows.push(...page)
    if (page.length < chunk) break
    offset += chunk
  }
  return rows
}

async function run() {
  const rows = await fetchAllEntities()
  let updated = 0
  let normalizedLeagueAliases = 0
  let coercedJunkLeagueToNull = 0
  let canonicalizedLeagueNameRows = 0

  for (const row of rows) {
    const patch = {}
    const props = { ...(row.properties || {}) }
    const entityType = normalizeText(row.entity_type)
    const rawLeague = String(row.league || props.league || props.level || '').trim()

    if (entityType === 'league') {
      const canonicalName = canonicalizeLeague(row.name || row.normalized_name || '')
      const canonicalDisplay = /^[A-Z]{2,5}$/.test(String(row.name || '').trim())
        ? String(row.name).trim()
        : titleCase(canonicalName)

      if (canonicalName && canonicalName !== normalizeText(row.normalized_name || '')) {
        patch.normalized_name = canonicalName
        props.normalized_name = canonicalName
        canonicalizedLeagueNameRows += 1
      }
      if (canonicalName && normalizeText(canonicalDisplay) !== normalizeText(row.name || '')) {
        patch.name = canonicalDisplay
        props.name = canonicalDisplay
      }
    }

    if (entityType === 'team' || entityType === 'organisation') {
      if (isJunkLeagueValue(rawLeague)) {
        if (String(row.league || '').trim()) {
          patch.league = ''
          coercedJunkLeagueToNull += 1
        }
        if (props.league) props.league = ''
        if (props.level) props.level = ''
      } else {
        const canonicalLeague = canonicalizeLeague(rawLeague)
        const displayLeague = /^[A-Z]{2,5}$/.test(rawLeague) ? rawLeague : titleCase(canonicalLeague)
        if (displayLeague && normalizeText(displayLeague) !== normalizeText(row.league || '')) {
          patch.league = displayLeague
          normalizedLeagueAliases += 1
        }
        props.league = displayLeague
      }
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
      updated += 1
    }
  }

  console.log(`taxonomy-hygiene remediation @ ${new Date().toISOString()}`)
  console.log(`- Dry run: ${DRY_RUN}`)
  console.log(`- Rows scanned: ${rows.length}`)
  console.log(`- Rows updated: ${updated}`)
  console.log(`- Team/org league aliases normalized: ${normalizedLeagueAliases}`)
  console.log(`- Team/org junk league values cleared: ${coercedJunkLeagueToNull}`)
  console.log(`- League entities canonicalized: ${canonicalizedLeagueNameRows}`)
}

run().catch((error) => {
  console.error('remediate-taxonomy-hygiene failed:', error?.message || error)
  process.exit(1)
})
