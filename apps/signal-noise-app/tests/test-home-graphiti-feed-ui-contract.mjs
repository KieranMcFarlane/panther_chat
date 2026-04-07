import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const feedSource = readFileSync(new URL('../src/components/home/GraphitiInsightsFeed.tsx', import.meta.url), 'utf8')

test('graphiti feed renders mixed cockpit cards from all ranked highlights', () => {
  assert.match(feedSource, /data\.highlights\.map/)
  assert.match(feedSource, /insight\.insight_type/)
  assert.match(feedSource, /destination_url/)
  assert.match(feedSource, /Opportunity|Watch item|Operational/)
})
