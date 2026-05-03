#!/usr/bin/env node
import { config } from 'dotenv'
import pg from 'pg'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { shouldIncludeInSportsHierarchy } from '../src/lib/sports-hierarchy-taxonomy.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: resolve(__dirname, '..', '.env'), quiet: true })

const args = new Set(process.argv.slice(2))
const DRY_RUN = !args.has('--apply')
const MODE = String(process.argv.find((arg) => arg.startsWith('--mode='))?.split('=')[1] || 'safe').trim().toLowerCase()
const OUT_PATH = String(process.argv.find((arg) => arg.startsWith('--out='))?.split('=')[1] || '').trim()

function createPgPool() {
  if (process.env.DATABASE_URL) {
    return new pg.Pool({ connectionString: process.env.DATABASE_URL })
  }
  return new pg.Pool({
    host: process.env.PGHOST || 'localhost',
    port: Number(process.env.PGPORT || 5432),
    database: process.env.PGDATABASE || 'signal_noise_app',
    user: process.env.PGUSER || process.env.USER,
    password: process.env.PGPASSWORD || undefined,
  })
}

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeCountry(value) {
  const raw = String(value || '').trim()
  if (!raw) return ''
  const normalized = raw.toLowerCase()
  if (normalized === 'usa' || normalized === 'us' || normalized === 'u.s.a.' || normalized === 'united states of america') return 'United States'
  if (normalized === 'uk' || normalized === 'great britain' || normalized === 'britain') return 'United Kingdom'
  if (normalized === 'turkey') return 'Türkiye'
  if (normalized === 'england & wales' || normalized === 'england/france') return 'England'
  if (normalized === 'chinese taipei') return 'Taiwan'
  return raw
}

function titleCase(value) {
  return String(value || '')
    .split(' ')
    .filter(Boolean)
    .map((token) => token[0].toUpperCase() + token.slice(1))
    .join(' ')
}

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

function isAliasLeagueValue(value) {
  const n = normalizeText(value)
  if (!n) return false
  return Object.values(LEAGUE_ALIASES).some((aliases) => aliases.map(normalizeText).includes(n))
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

function isKnownCountryAlias(value) {
  const raw = String(value || '').trim().toLowerCase()
  return raw === 'usa' || raw === 'us' || raw === 'u.s.a.' || raw === 'united states of america' || raw === 'uk' || raw === 'great britain' || raw === 'britain' || raw === 'turkey' || raw === 'england & wales' || raw === 'england/france' || raw === 'chinese taipei'
}

async function fetchAllEntities(pool) {
  const rows = []
  const chunk = 1000
  let offset = 0
  while (true) {
    const result = await pool.query(
      `
        select id, name, normalized_name, entity_type, sport, league, country, canonical_key,
               league_canonical_entity_id, parent_canonical_entity_id, properties
        from canonical_entities
        order by id asc
        offset $1
        limit $2
      `,
      [offset, chunk],
    )
    const page = result.rows || []
    rows.push(...page)
    if (page.length < chunk) break
    offset += chunk
  }
  return rows
}

function summarizePatch(before, after) {
  return Object.keys(after).filter((key) => {
    return JSON.stringify(before?.[key]) !== JSON.stringify(after[key])
  })
}

async function run() {
  const pool = createPgPool()

  try {
    const rows = await fetchAllEntities(pool)
    const safeUpdates = []
    const manualReview = []
    const noTouch = []

    for (const row of rows) {
      const patch = {}
      const props = { ...(row.properties || {}) }
      const entityType = String(row.entity_type || '').trim()
      const rawLeague = String(row.league || props.league || props.level || '').trim()

      if (entityType === 'League') {
        const canonicalName = canonicalizeLeague(row.name || row.normalized_name || '')
        const canonicalDisplay = /^[A-Z]{2,5}$/.test(String(row.name || '').trim())
          ? String(row.name).trim()
          : titleCase(canonicalName)

        if (canonicalName && canonicalName !== normalizeText(row.normalized_name || '')) {
          patch.normalized_name = canonicalName
          props.normalized_name = canonicalName
        }
        if (canonicalName && normalizeText(canonicalDisplay) !== normalizeText(row.name || '')) {
          patch.name = canonicalDisplay
          props.name = canonicalDisplay
        }
      }

      if (entityType === 'Club' || entityType === 'Organisation') {
        if (isJunkLeagueValue(rawLeague)) {
          const hadLeague = String(row.league || '').trim()
          const hadLevel = String(row.properties?.level || '').trim()
          if (hadLeague) {
            patch.league = ''
            props.league = ''
          }
          if (hadLevel) {
            props.level = ''
          }
        } else {
          const canonicalLeague = canonicalizeLeague(rawLeague)
          if (isAliasLeagueValue(rawLeague)) {
            const displayLeague = /^[A-Z]{2,5}$/.test(rawLeague) ? rawLeague : titleCase(canonicalLeague)
            if (displayLeague && normalizeText(displayLeague) !== normalizeText(row.league || '')) {
              patch.league = displayLeague
            }
            props.league = displayLeague
          } else if (MODE === 'review') {
            manualReview.push({
              id: row.id,
              name: row.name,
              entity_type: row.entity_type,
              league: row.league,
              country: row.country,
              sport: row.sport,
              rawLeague,
            })
          }
        }
        if (props.country && isKnownCountryAlias(props.country)) {
          const normalizedCountry = normalizeCountry(props.country)
          if (normalizedCountry && normalizedCountry !== props.country) {
            props.country = normalizedCountry
            patch.country = normalizedCountry
          }
        }
      }

      if (!shouldIncludeInSportsHierarchy(row) && (row.league_canonical_entity_id || row.parent_canonical_entity_id)) {
        patch.league_canonical_entity_id = null
        patch.parent_canonical_entity_id = null
        props.league_canonical_entity_id = null
        props.parent_canonical_entity_id = null
      }

      if (Object.keys(patch).length > 0 || JSON.stringify(props) !== JSON.stringify(row.properties || {})) {
        patch.properties = props
        const changeBucket = entityType === 'League' || isJunkLeagueValue(rawLeague) || isAliasLeagueValue(rawLeague) || isKnownCountryAlias(props.country)
          ? 'safe'
          : 'manual'
        const record = {
          id: row.id,
          name: row.name,
          entity_type: row.entity_type,
          fields: summarizePatch(row, patch),
          patch,
        }
        if (changeBucket === 'safe') {
          safeUpdates.push(record)
        } else {
          manualReview.push(record)
        }
      } else {
        noTouch.push({
          id: row.id,
          name: row.name,
          entity_type: row.entity_type,
        })
      }
    }

    console.log(JSON.stringify({
      dry_run: DRY_RUN,
      mode: MODE,
      rows_scanned: rows.length,
      safe_updates: safeUpdates.length,
      manual_review: manualReview.length,
      no_touch: noTouch.length,
      sample_safe: safeUpdates.slice(0, 20),
      sample_manual: manualReview.slice(0, 20),
    }, null, 2))

    const updates = MODE === 'review' ? manualReview : safeUpdates

    if (OUT_PATH) {
      const report = {
        generated_at: new Date().toISOString(),
        mode: MODE,
        dry_run: DRY_RUN,
        rows_scanned: rows.length,
        safe_updates: safeUpdates.length,
        manual_review: manualReview.length,
        no_touch: noTouch.length,
        sample_safe: safeUpdates.slice(0, 50),
        sample_manual: manualReview.slice(0, 100),
      }
      mkdirSync(String(OUT_PATH).split('/').slice(0, -1).join('/') || '.', { recursive: true })
      writeFileSync(OUT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
    }

    if (DRY_RUN || updates.length === 0 || MODE === 'review') {
      return
    }

    await pool.query('BEGIN')
    try {
      for (const update of updates) {
        const entries = Object.entries(update.patch)
        const setSql = entries.map((entry, index) => `"${entry[0]}" = $${index + 2}`).join(', ')
        const params = [update.id, ...entries.map((entry) => entry[1])]
        await pool.query(`UPDATE canonical_entities SET ${setSql} WHERE id = $1`, params)
      }
      await pool.query('COMMIT')
    } catch (error) {
      await pool.query('ROLLBACK')
      throw error
    }

    console.log(JSON.stringify({
      applied: true,
      rows_updated: updates.length,
    }, null, 2))
  } catch (error) {
    console.error('remediate-taxonomy-hygiene-local failed:', error?.message || error)
    process.exitCode = 1
  } finally {
    await pool.end()
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run()
}
