import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import {
  buildWideRfpDeltaMemoryPack,
  buildWideRfpResearchPrompt,
  normalizeWideRfpResearchBatch,
  readLatestWideRfpResearchArtifact,
} from '../src/lib/rfp-wide-research.mjs'

test('buildWideRfpResearchPrompt includes the repo-specific rfp surfaces and canonical-first instructions', () => {
  const prompt = buildWideRfpResearchPrompt({
    seedQuery: 'Yellow Panther digital-fit RFP discovery',
    currentRfpPage: '/rfps',
    currentIntakePage: '/rfps',
  })

  assert.match(prompt, /\/rfps/)
  assert.doesNotMatch(prompt, /\/tenders/)
  assert.match(prompt, /canonical-first/i)
  assert.match(prompt, /create an entity/i)
  assert.match(prompt, /normalized JSON/i)
  assert.doesNotMatch(prompt, /MANUS_API/i)
  assert.match(prompt, /digital-fit/i)
  assert.match(prompt, /Yellow Panther/i)
  assert.match(prompt, /Prioritize digital opportunities/i)
  assert.doesNotMatch(prompt, /Root object shape/i)
  assert.doesNotMatch(prompt, /metadata must include/i)
})

test('buildWideRfpResearchPrompt uses the generic yellow panther discovery prompt by default', () => {
  const prompt = buildWideRfpResearchPrompt({
    currentRfpPage: '/rfps',
    currentIntakePage: '/rfps',
  })

  assert.match(prompt, /Yellow Panther digital-fit RFP discovery/i)
  assert.match(prompt, /websites, apps, portals, UX\/UI, CMS, content, CRM, martech, analytics, data, automation, digital transformation, fan engagement, and technology procurement/i)
})

test('buildWideRfpResearchPrompt can target a year and exclude already found titles', () => {
  const prompt = buildWideRfpResearchPrompt({
    currentRfpPage: '/rfps',
    currentIntakePage: '/rfps',
    targetYear: 2026,
    excludeTitles: ['BC Athletics Rebrand and Website Development', 'RFP World Skate Website'],
  })

  assert.match(prompt, /Target year: 2026/i)
  assert.match(prompt, /Prioritize opportunities with deadlines or performance periods in 2026/i)
  assert.match(prompt, /actual document\/content dates do not overlap 2026/i)
  assert.doesNotMatch(prompt, /dated 2024/i)
  assert.match(prompt, /Already found RFP titles \(exclude these from the next sweep\)/i)
  assert.match(prompt, /Do not return any source_url that already exists/i)
  assert.match(prompt, /BC Athletics Rebrand and Website Development/i)
  assert.match(prompt, /RFP World Skate Website/i)
  assert.match(prompt, /long-tail/i)
})

test('buildWideRfpResearchPrompt prefers durable evidence over gated or session URLs', () => {
  const prompt = buildWideRfpResearchPrompt({
    currentRfpPage: '/rfps',
    targetYear: 2026,
  })

  assert.match(prompt, /behind a login or session-gated/i)
  assert.match(prompt, /official press release or board minutes/i)
  assert.match(prompt, /source_url/i)
})

test('buildWideRfpResearchPrompt supports safe, standard, and deep run depth', () => {
  const prompt = buildWideRfpResearchPrompt({
    currentRfpPage: '/rfps',
    targetYear: 2026,
  })
  const standardPrompt = buildWideRfpResearchPrompt({
    currentRfpPage: '/rfps',
    targetYear: 2026,
    researchDepth: 'standard',
  })
  const deepPrompt = buildWideRfpResearchPrompt({
    currentRfpPage: '/rfps',
    targetYear: 2026,
    researchDepth: 'deep',
  })

  assert.match(prompt, /Research depth: safe/i)
  assert.match(prompt, /Aim for 3-5/i)
  assert.doesNotMatch(prompt, /Do not create subtasks/i)
  assert.doesNotMatch(prompt, /Never narrate progress/i)
  assert.match(standardPrompt, /Research depth: standard/i)
  assert.match(standardPrompt, /Aim for 5-8/i)
  assert.match(deepPrompt, /Research depth: deep/i)
  assert.match(deepPrompt, /Aim for 8-12/i)
})

test('buildWideRfpResearchPrompt includes stateful delta memory without hard-excluding same-entity discoveries', () => {
  const prompt = buildWideRfpResearchPrompt({
    currentRfpPage: '/rfps',
    targetYear: 2026,
    researchMode: 'live',
    deltaMemory: {
      known_source_urls: ['https://www.usarchery.org/resource/website-rfp'],
      known_opportunity_fingerprints: ['ce_usa_archery | usarchery org website rebuild modernization project | 2026'],
      known_entity_existing_rfps: [
        {
          canonical_entity_id: 'ce_cricket_west_indies',
          canonical_entity_name: 'Cricket West Indies',
          rfps: [{ title: 'Cricket West Indies Digital Transformation RFP', target_year: 2025, source_host: 'windiescricket.com' }],
        },
      ],
      hard_excluded_canonical_entity_ids: ['ce_usa_archery'],
    },
  })

  assert.match(prompt, /Stateful memory \(delta-only\)/i)
  assert.match(prompt, /Known URLs/i)
  assert.match(prompt, /https:\/\/www\.usarchery\.org\/resource\/website-rfp/i)
  assert.match(prompt, /Known opportunity fingerprints/i)
  assert.match(prompt, /ce_usa_archery \| usarchery org website rebuild modernization project \| 2026/i)
  assert.match(prompt, /Known entities with existing RFPs/i)
  assert.match(prompt, /ce_cricket_west_indies/i)
  assert.match(prompt, /Hard exclusions/i)
  assert.match(prompt, /ce_usa_archery/i)
  assert.match(prompt, /Same canonical entity with a clearly different RFP, source, or evidence window is allowed/i)
})

test('buildWideRfpResearchPrompt compacts large state memory for efficient Manus runs', () => {
  const prompt = buildWideRfpResearchPrompt({
    currentRfpPage: '/rfps',
    targetYear: 2026,
    maxKnownUrls: 3,
    deltaMemory: {
      known_source_urls: Array.from({ length: 20 }, (_, index) => `https://example.com/rfp-${index}`),
      known_opportunity_fingerprints: Array.from({ length: 100 }, (_, index) => `entity-${index} | title-${index} | 2026`),
      known_entity_existing_rfps: Array.from({ length: 80 }, (_, index) => ({
        canonical_entity_id: `ce_${index}`,
        canonical_entity_name: `Entity ${index}`,
        rfps: [
          { title: `RFP ${index}A`, target_year: 2026, source_host: 'example.com' },
          { title: `RFP ${index}B`, target_year: 2025, source_host: 'example.com' },
        ],
      })),
    },
  })

  assert.match(prompt, /Known URLs \(first 3\)/i)
  assert.match(prompt, /Known opportunity fingerprints \(first 30\)/i)
  assert.match(prompt, /Known entities with existing RFPs \(first 12\)/i)
  assert.match(prompt, /Memory compacted:/i)
  assert.doesNotMatch(prompt, /entity-99 \| title-99/i)
  assert.doesNotMatch(prompt, /ce_79/i)
})

test('buildWideRfpResearchPrompt supports live and backtest temporal modes', () => {
  const livePrompt = buildWideRfpResearchPrompt({ targetYear: 2026, researchMode: 'live' })
  const backtestPrompt = buildWideRfpResearchPrompt({ targetYear: 2024, researchMode: 'backtest' })

  assert.match(livePrompt, /Research mode: live/i)
  assert.match(livePrompt, /Prioritize open, current, or future/i)
  assert.match(backtestPrompt, /Research mode: backtest/i)
  assert.match(backtestPrompt, /Historical opportunities are valid/i)
  assert.match(backtestPrompt, /overlaps 2024/i)
})

test('buildWideRfpDeltaMemoryPack creates compact URL, fingerprint, and entity memory', () => {
  const memory = buildWideRfpDeltaMemoryPack({
    opportunities: [
      {
        title: 'USARCHERY.ORG - Website Rebuild & Modernization Project',
        source_url: 'https://www.usarchery.org/resource/website-rfp?utm=foo',
        canonical_entity_id: 'ce_usa_archery',
        canonical_entity_name: 'USA Archery',
        target_year: 2026,
      },
      {
        title: 'USARCHERY ORG Website Rebuild Modernization Project',
        source_url: 'https://www.usarchery.org/resource/website-rfp',
        canonical_entity_id: 'ce_usa_archery',
        canonical_entity_name: 'USA Archery',
        target_year: 2026,
      },
      {
        title: 'Cricket West Indies Fan App Discovery',
        source_url: 'https://www.windiescricket.com/news/fan-app',
        canonical_entity_id: 'ce_cricket_west_indies',
        canonical_entity_name: 'Cricket West Indies',
        target_year: 2026,
      },
    ],
    hardExcludedCanonicalEntityIds: ['ce_volleyball_canada'],
  })

  assert.deepEqual(memory.known_source_urls, [
    'https://www.usarchery.org/resource/website-rfp',
    'https://www.windiescricket.com/news/fan-app',
  ])
  assert.deepEqual(memory.known_opportunity_fingerprints, [
    'ce_usa_archery | usarchery org website rebuild modernization project | 2026',
    'ce_cricket_west_indies | cricket west indies fan app discovery | 2026',
  ])
  assert.equal(memory.known_entity_existing_rfps.length, 2)
  assert.deepEqual(memory.hard_excluded_canonical_entity_ids, ['ce_volleyball_canada'])
})

test('buildWideRfpResearchPrompt normalizes legacy tenders intake to the rfps surface', () => {
  const prompt = buildWideRfpResearchPrompt({
    currentRfpPage: '/rfps',
    currentIntakePage: '/tenders',
  })

  assert.match(prompt, /Current intake page: \/rfps/)
  assert.doesNotMatch(prompt, /Current intake page: \/tenders/)
})

test('normalizeWideRfpResearchBatch produces canonical opportunity rows and entity actions', () => {
  const batch = normalizeWideRfpResearchBatch({
    run_id: 'wide-rfp-001',
    opportunities: [
      {
        title: 'Digital transformation RFP',
        organization: 'Example FC',
        source_url: 'https://example.com/rfp',
        confidence: 0.92,
        yellow_panther_fit: 88,
        entity_name: 'Example FC',
        canonical_entity_id: 'entity-123',
      },
    ],
    entity_actions: [
      {
        action: 'link',
        organization: 'Example FC',
        canonical_entity_id: 'entity-123',
      },
    ],
  })

  assert.equal(batch.run_id, 'wide-rfp-001')
  assert.equal(batch.focus_area, 'web-platforms')
  assert.equal(batch.lane_label, 'Web Platforms')
  assert.equal(batch.seed_query, 'Yellow Panther digital-fit RFP discovery')
  assert.equal(batch.opportunities.length, 1)
  assert.equal(batch.opportunities[0].organization, 'Example FC')
  assert.equal(batch.opportunities[0].canonical_entity_id, 'entity-123')
  assert.equal(batch.entity_actions.length, 1)
  assert.equal(batch.entity_actions[0].action, 'link')
})

test('normalizeWideRfpResearchBatch treats decimal and label fit scores as percentages', () => {
  const batch = normalizeWideRfpResearchBatch({
    run_id: 'wide-rfp-fit-scores',
    opportunities: [
      {
        title: 'Decimal fit RFP',
        organization: 'Example Federation',
        yellow_panther_fit: 0.72,
        confidence: 0.66,
      },
      {
        title: 'Label fit RFP',
        organization: 'Example League',
        yellow_panther_fit: 'very_high',
        confidence: 0.91,
      },
      {
        title: 'Missing fit RFP',
        organization: 'Example Club',
        confidence: 0.58,
      },
    ],
  })

  assert.equal(batch.opportunities[0].yellow_panther_fit, 72)
  assert.equal(batch.opportunities[1].yellow_panther_fit, 95)
  assert.equal(batch.opportunities[2].yellow_panther_fit, 58)
})

test('normalizeWideRfpResearchBatch preserves Manus task credit metadata for usage reporting', () => {
  const batch = normalizeWideRfpResearchBatch({
    run_id: 'wide-rfp-credits',
    prompt_execution_metadata: {
      manus_task_id: 'task_123',
      manus_task_url: 'https://manus.im/app/task_123',
      manus_credit_usage: 42,
      manus_agent_profile: 'manus-1.6-max',
    },
    opportunities: [],
    entity_actions: [],
  })

  assert.deepEqual(batch.prompt_execution_metadata, {
    manus_task_id: 'task_123',
    manus_task_url: 'https://manus.im/app/task_123',
    manus_credit_usage: 42,
    manus_agent_profile: 'manus-1.6-max',
  })
})

test('readLatestWideRfpResearchArtifact prefers the latest non-empty batch', async () => {
  const outputDir = await mkdtemp(join(tmpdir(), 'wide-rfp-'))

  await writeFile(
    join(outputDir, 'wide_rfp_research_older.json'),
    JSON.stringify({
      run_id: 'older',
      generated_at: '2026-04-11T04:51:23.614Z',
      opportunities: [{ id: 'a' }],
      entity_actions: [],
    }),
  )

  await writeFile(
    join(outputDir, 'wide_rfp_research_newer.json'),
    JSON.stringify({
      run_id: 'newer',
      generated_at: '2026-04-11T05:19:39.844Z',
      opportunities: [],
      entity_actions: [],
    }),
  )

  const latest = await readLatestWideRfpResearchArtifact({ outputDir })
  assert.notEqual(latest?.batch?.run_id, 'newer')
  assert.equal(latest?.batch?.focus_area, 'web-platforms')
  assert.equal(latest?.batch?.lane_label, 'Web Platforms')
  assert.ok((latest?.batch?.opportunities?.length || 0) >= 1)
})

test('readLatestWideRfpResearchArtifact discovers the shared worktree cache by default', async () => {
  const latest = await readLatestWideRfpResearchArtifact({})

  assert.ok(latest?.batch?.run_id)
  assert.ok(latest?.batch?.generated_at || latest?.batch?.source)
  assert.match(String(latest?.filePath || ''), /wide_rfp_research_.*\.json/)
})

test('wide research store does not let the legacy merged batch hide newer manual runs', async () => {
  const source = await readFile(new URL('../src/lib/rfp-wide-research-store.ts', import.meta.url), 'utf8')

  assert.doesNotMatch(source, /if \(mergedRecord\?\.batch\)/)
  assert.match(source, /legacyMergedRecord/)
})
