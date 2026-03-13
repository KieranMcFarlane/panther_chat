import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

const vectorSearchRouteSource = readFileSync(
  new URL('../src/app/api/vector-search/route.ts', import.meta.url),
  'utf8',
)

const embeddingsRouteSource = readFileSync(
  new URL('../src/app/api/embeddings/route.ts', import.meta.url),
  'utf8',
)
const appNavigationSource = readFileSync(
  new URL('../src/components/layout/AppNavigation.tsx', import.meta.url),
  'utf8',
)
const vectorSearchComponentSource = readFileSync(
  new URL('../src/components/VectorSearch.tsx', import.meta.url),
  'utf8',
)

test('vector search route exposes hybrid v2 strategy with lexical + semantic merge', () => {
  assert.match(vectorSearchRouteSource, /hybrid_v2/)
  assert.match(vectorSearchRouteSource, /lexical_score/)
  assert.match(vectorSearchRouteSource, /semantic_score/)
  assert.match(vectorSearchRouteSource, /final_score/)
  assert.match(vectorSearchRouteSource, /canonical_entities/)
  assert.match(vectorSearchRouteSource, /loadLexicalCandidates/)
})

test('vector search route supports facet-aware filtering inputs', () => {
  assert.match(vectorSearchRouteSource, /sport/)
  assert.match(vectorSearchRouteSource, /league/)
  assert.match(vectorSearchRouteSource, /country/)
  assert.match(vectorSearchRouteSource, /entity_type/)
})

test('embeddings route does not return random dummy embeddings on failure', () => {
  assert.doesNotMatch(embeddingsRouteSource, /Math\.random\(\)/)
  assert.match(embeddingsRouteSource, /OPENAI_API_KEY/)
  assert.match(embeddingsRouteSource, /status:\s*503/)
})

test('search route page exists so sidebar search route is not a 404', () => {
  const searchPagePath = new URL('../src/app/search/page.tsx', import.meta.url)
  assert.equal(existsSync(searchPagePath), true)
  const searchPageSource = readFileSync(searchPagePath, 'utf8')
  assert.match(searchPageSource, /Entity Browser Search/)
  assert.match(searchPageSource, /VectorSearch/)
})

test('vector search can degrade to lexical-only mode when semantic embedding is unavailable', () => {
  assert.match(vectorSearchRouteSource, /semantic_unavailable_lexical_only/)
  assert.match(vectorSearchRouteSource, /semantic_enabled/)
})

test('sidebar search item points to real /search route', () => {
  assert.match(appNavigationSource, /label:\s*'Search'/)
  assert.match(appNavigationSource, /href:\s*'\/search'/)
})

test('search loading UI includes staged plan steps with completion semantics', () => {
  assert.match(vectorSearchComponentSource, /Interpret customer intent/)
  assert.match(vectorSearchComponentSource, /Evaluate matching inventory/)
  assert.match(vectorSearchComponentSource, /Prepare recommendation shortlist/)
  assert.match(vectorSearchComponentSource, /Return actionable next steps/)
  assert.match(vectorSearchComponentSource, /Thinking/)
  assert.match(vectorSearchComponentSource, /Response composer/)
  assert.match(vectorSearchComponentSource, /planCompletedCount/)
})

test('search page uses view transition helper for entity browser navigation', () => {
  assert.match(vectorSearchComponentSource, /pushWithViewTransition/)
  assert.doesNotMatch(vectorSearchComponentSource, /window\.location\.href\s*=\s*['"`]\/entity-browser['"`]/)
})

test('vector benchmark script exists with core regression queries', () => {
  const benchmarkPath = new URL('../scripts/qa-vector-search-benchmark.mjs', import.meta.url)
  assert.equal(existsSync(benchmarkPath), true)
  const benchmarkSource = readFileSync(benchmarkPath, 'utf8')
  assert.match(benchmarkSource, /Rajasthan Royals/)
  assert.match(benchmarkSource, /athletics governing body/)
  assert.match(benchmarkSource, /IPL franchise/)
  assert.match(benchmarkSource, /top1/)
  assert.match(benchmarkSource, /top5/)
})
