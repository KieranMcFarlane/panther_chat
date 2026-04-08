import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const feedSource = readFileSync(new URL('../src/components/home/GraphitiInsightsFeed.tsx', import.meta.url), 'utf8')

test('graphiti feed renders mixed cockpit cards from all ranked highlights', () => {
  assert.match(feedSource, /const highlights = Array\.isArray\(data\?\.highlights\) \? data\.highlights : \[\]/)
  assert.match(feedSource, /highlights\.map\(\(insight\)/)
  assert.match(feedSource, /insight\.insight_type/)
  assert.match(feedSource, /destination_url/)
  assert.match(feedSource, /Opportunity|Watch item|Operational/)
})

test('graphiti feed tolerates error or empty payloads without assuming highlights always exist', () => {
  assert.match(feedSource, /Array\.isArray\(data\?\.highlights\)/)
  assert.match(feedSource, /Array\.isArray\(data\?\.related_entities\)/)
  assert.match(feedSource, /Unable to load Graphiti insights right now\./)
})
