import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

const materializerSource = readFileSync(new URL('../src/lib/graphiti-insight-materializer.ts', import.meta.url), 'utf8')

test('high-conviction commercial openings are promoted to opportunity insights', () => {
  assert.match(materializerSource, /isCommercialOpportunityLanguage/)
  assert.match(materializerSource, /confidence >= 0\.85/)
  assert.match(materializerSource, /procurement/i)
})
