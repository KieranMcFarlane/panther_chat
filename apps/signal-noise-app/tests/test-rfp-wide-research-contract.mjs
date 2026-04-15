import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import {
  buildWideRfpResearchPrompt,
  normalizeWideRfpResearchBatch,
  readLatestWideRfpResearchArtifact,
} from '../src/lib/rfp-wide-research.mjs'

test('buildWideRfpResearchPrompt includes the repo-specific rfp surfaces and canonical-first instructions', () => {
  const prompt = buildWideRfpResearchPrompt({
    seedQuery: 'Yellow Panther digital-fit RFP discovery',
    currentRfpPage: '/rfps',
    currentIntakePage: '/tenders',
  })

  assert.match(prompt, /\/tenders/)
  assert.match(prompt, /\/rfps/)
  assert.match(prompt, /canonical-first/i)
  assert.match(prompt, /create an entity/i)
  assert.match(prompt, /normalized JSON/i)
  assert.match(prompt, /MANUS_API/i)
  assert.match(prompt, /digital-fit/i)
  assert.match(prompt, /Yellow Panther/i)
  assert.match(prompt, /Prioritize digital opportunities/i)
  assert.match(prompt, /Iterate through the RFPS already found/i)
})

test('buildWideRfpResearchPrompt uses the generic yellow panther discovery prompt by default', () => {
  const prompt = buildWideRfpResearchPrompt({
    currentRfpPage: '/rfps',
    currentIntakePage: '/tenders',
  })

  assert.match(prompt, /Yellow Panther digital-fit RFP discovery/i)
  assert.match(prompt, /websites, apps, portals, UX\/UI, CMS, content, CRM, martech, analytics, data, automation, digital transformation, fan engagement, and technology procurement/i)
})

test('buildWideRfpResearchPrompt can target a year and exclude already found titles', () => {
  const prompt = buildWideRfpResearchPrompt({
    currentRfpPage: '/rfps',
    currentIntakePage: '/tenders',
    targetYear: 2026,
    excludeTitles: ['BC Athletics Rebrand and Website Development', 'RFP World Skate Website'],
  })

  assert.match(prompt, /Target year: 2026/i)
  assert.match(prompt, /Already found RFP titles \(exclude these from the next sweep\)/i)
  assert.match(prompt, /BC Athletics Rebrand and Website Development/i)
  assert.match(prompt, /RFP World Skate Website/i)
  assert.match(prompt, /long-tail/i)
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
  assert.equal(latest?.batch?.run_id, 'older')
  assert.equal(latest?.batch?.focus_area, 'web-platforms')
  assert.equal(latest?.batch?.lane_label, 'Web Platforms')
  assert.equal(latest?.batch?.opportunities?.length, 1)
})

test('readLatestWideRfpResearchArtifact discovers the shared worktree cache by default', async () => {
  const latest = await readLatestWideRfpResearchArtifact({})

  assert.equal(latest?.batch?.run_id, 'yellow-panther-rfp-2026-04-11T005900Z')
  assert.match(String(latest?.filePath || ''), /wide_rfp_research_yellow-panther-rfp-2026-04-11T005900Z\.json/)
})
