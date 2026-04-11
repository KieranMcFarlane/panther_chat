import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const controlStateSource = readFileSync(new URL('../src/lib/pipeline-control-state.ts', import.meta.url), 'utf8')
const controlRouteSource = readFileSync(new URL('../src/app/api/home/pipeline-control/route.ts', import.meta.url), 'utf8')
const lifecycleSource = readFileSync(new URL('../src/lib/entity-pipeline-lifecycle.ts', import.meta.url), 'utf8')

test('pipeline control state contract includes ignition transitions and observed state', () => {
  assert.match(controlStateSource, /transition_state/)
  assert.match(controlStateSource, /requested_state/)
  assert.match(controlStateSource, /observed_state/)
  assert.match(controlStateSource, /starting/)
  assert.match(controlStateSource, /running/)
  assert.match(controlStateSource, /stopping/)
  assert.match(controlStateSource, /paused/)
})

test('pipeline control route writes explicit transition records for start and stop', () => {
  assert.match(controlRouteSource, /POST/)
  assert.match(controlRouteSource, /transition_state/)
  assert.match(controlRouteSource, /requested_state/)
  assert.match(controlRouteSource, /observed_state/)
  assert.match(controlRouteSource, /starting/)
  assert.match(controlRouteSource, /stopping/)
  assert.match(controlRouteSource, /pipeline control/i)
  assert.match(lifecycleSource, /control_state/)
  assert.match(lifecycleSource, /starting/)
  assert.match(lifecycleSource, /stopping/)
  assert.match(lifecycleSource, /paused/)
})
