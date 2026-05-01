import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const queueDrilldownApiSource = readFileSync(
  new URL('../src/app/api/home/queue-drilldown/route.ts', import.meta.url),
  'utf8',
)

test('queue drilldown in-progress entity carries runtime question text', () => {
  assert.match(
    queueDrilldownApiSource,
    /current_question_text: runtimeCurrentLiveRun\.current_question_text/,
  )
})

test('queue drilldown treats stale rows as historical when fresh live work exists', () => {
  assert.match(queueDrilldownApiSource, /const hasFreshLiveRun = Boolean\(runtime\.current_live_run\)/)
  assert.match(queueDrilldownApiSource, /healthy: hasFreshLiveRun/)
})
