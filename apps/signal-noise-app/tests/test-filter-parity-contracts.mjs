import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const leagueNavSimpleSource = readFileSync(
  new URL('../src/components/header/LeagueNavSimple.tsx', import.meta.url),
  'utf8',
)
const unifiedRfpPageSource = readFileSync(
  new URL('../src/components/rfp/UnifiedRfpPage.tsx', import.meta.url),
  'utf8',
)

test('league nav canonicalizes league-name buckets to avoid duplicate league variants', () => {
  assert.match(leagueNavSimpleSource, /canonicalizeLeagueName/)
  assert.match(leagueNavSimpleSource, /return canonicalizeLeagueName\(/)
})

test('unified RFP page exposes sport, type, and league facet filters aligned to taxonomy', () => {
  assert.match(unifiedRfpPageSource, /fetch\('\/api\/entities\/taxonomy'\)/)
  assert.match(unifiedRfpPageSource, /sportFilter/)
  assert.match(unifiedRfpPageSource, /entityTypeFilter/)
  assert.match(unifiedRfpPageSource, /leagueFilter/)
  assert.match(unifiedRfpPageSource, /<SelectItem value=\"all\">All Sports<\/SelectItem>/)
  assert.match(unifiedRfpPageSource, /<SelectItem value=\"all\">All Types<\/SelectItem>/)
  assert.match(unifiedRfpPageSource, /<SelectItem value=\"all\">All Leagues<\/SelectItem>/)
})
