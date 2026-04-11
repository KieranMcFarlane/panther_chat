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
})

test('buildWideRfpResearchPrompt can narrow discovery to a crm sub-vertical', () => {
  const prompt = buildWideRfpResearchPrompt({
    seedQuery: 'Yellow Panther crm-fit RFP discovery',
    currentRfpPage: '/rfps',
    currentIntakePage: '/tenders',
    focusArea: 'crm',
  })

  assert.match(prompt, /CRM/i)
  assert.match(prompt, /membership/i)
  assert.match(prompt, /customer data/i)
  assert.doesNotMatch(prompt, /websites, apps, portals, UX\/UI, CMS, content, CRM, martech, analytics, data, automation, digital transformation, fan engagement, and technology procurement/i)
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
  assert.equal(batch.seed_query, 'Yellow Panther web-platform RFP discovery')
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
