import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

const materializerSource = readFileSync(new URL('../src/lib/graphiti-opportunity-materializer.ts', import.meta.url), 'utf8')

test('graphiti opportunity materializer prefers dossier-specific narrative over boilerplate placeholders', () => {
  assert.match(materializerSource, /extractStructuredText/)
  assert.match(materializerSource, /toReadableText/)
  assert.match(materializerSource, /graphitiOutreachAngle/)
  assert.match(materializerSource, /graphitiCapabilityGap/)
  assert.match(materializerSource, /decision owners/i)
  assert.match(materializerSource, /Review the dossier and progress the strongest aligned opportunity\./)
  assert.doesNotMatch(materializerSource, /Decision owners: \[object Object\]/)
})

test('graphiti opportunity materializer suppresses generic route placeholders from display fields', () => {
  assert.match(materializerSource, /isGenericRouteText/)
  assert.match(materializerSource, /rawGraphitiOutreachRoute/)
  assert.match(materializerSource, /const graphitiOutreachRoute = isGenericRouteText\(rawGraphitiOutreachRoute\)\s*\?\s*''\s*:\s*rawGraphitiOutreachRoute/)
})
