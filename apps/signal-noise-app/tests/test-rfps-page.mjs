import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const pageSource = readFileSync(new URL('../src/app/rfps/page.tsx', import.meta.url), 'utf8')

test('rfps page uses the shared shell and promoted-only tenders feed', () => {
  assert.match(pageSource, /AppPageShell/)
  assert.match(pageSource, /AppPageHeader/)
  assert.match(pageSource, /AppPageBody/)
  assert.match(pageSource, /\/api\/tenders\?action=opportunities&limit=50&orderBy=yellow_panther_fit&orderDirection=desc&promoted_only=true/)
  assert.match(pageSource, /Found RFPs/)
  assert.match(pageSource, /Only verified, promoted opportunities that survived the intake and quality filters/)
})
