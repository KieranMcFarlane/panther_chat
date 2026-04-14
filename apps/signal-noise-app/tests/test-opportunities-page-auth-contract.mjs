import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const pageSource = readFileSync(new URL('../src/app/opportunities/page.tsx', import.meta.url), 'utf8')

test('opportunities page requires a server session before rendering the client shortlist', () => {
  assert.match(pageSource, /requirePageSession\('\/opportunities'\)/)
  assert.match(pageSource, /Suspense fallback=/)
  assert.doesNotMatch(pageSource, /useSearchParams/)
})
