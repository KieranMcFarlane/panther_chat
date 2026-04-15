import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

const pageSource = readFileSync(new URL('../src/app/opportunities/page.tsx', import.meta.url), 'utf8')
const clientSource = readFileSync(new URL('../src/app/opportunities/opportunities-client.tsx', import.meta.url), 'utf8')
const routeSource = readFileSync(new URL('../src/app/api/opportunities/route.ts', import.meta.url), 'utf8')
const persistenceSource = readFileSync(new URL('../src/lib/graphiti-opportunity-persistence.ts', import.meta.url), 'utf8')
const materializerSource = readFileSync(new URL('../src/lib/graphiti-opportunity-materializer.ts', import.meta.url), 'utf8')
const vercelSource = readFileSync(new URL('../vercel.json', import.meta.url), 'utf8')

test('opportunities page and API route are wired to the canonical Graphiti opportunity stack', () => {
  assert.match(pageSource, /requirePageSession\('\/opportunities'\)/)
  assert.match(clientSource, /fetch\(['"]\/api\/opportunities['"]/)
  assert.match(routeSource, /loadGraphitiOpportunitiesFromDb/)
  assert.match(persistenceSource, /graphiti_materialized_opportunities/)
  assert.match(persistenceSource, /why_this_is_an_opportunity/)
  assert.match(persistenceSource, /yellow_panther_fit_feedback/)
  assert.match(persistenceSource, /next_steps/)
  assert.match(persistenceSource, /supporting_signals/)
  assert.match(persistenceSource, /read_more_context/)
  assert.match(materializerSource, /evidence:\s*source\.evidence/)
  assert.match(materializerSource, /relationships:\s*source\.relationships/)
  assert.match(vercelSource, /\/api\/cron\/graphiti\/opportunities\/materialize/)
  assert.doesNotMatch(routeSource, /rfp_opportunities/)
  assert.doesNotMatch(clientSource, /api\/tenders\?action=opportunities/)
})
