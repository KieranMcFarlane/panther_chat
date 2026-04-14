import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

const materializerSource = readFileSync(new URL('../src/lib/graphiti-opportunity-materializer.ts', import.meta.url), 'utf8')

test('graphiti opportunity materializer persists explicit reasoning fields', () => {
  assert.match(materializerSource, /why_this_is_an_opportunity/)
  assert.match(materializerSource, /yellow_panther_fit_feedback/)
  assert.match(materializerSource, /next_steps/)
  assert.match(materializerSource, /supporting_signals/)
  assert.match(materializerSource, /read_more_context/)
})
