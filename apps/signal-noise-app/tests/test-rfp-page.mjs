import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const rfpPagePath = new URL('../src/app/rfps/page.tsx', import.meta.url)
const rfpComponentPath = new URL('../src/components/rfp/UnifiedRfpPage.tsx', import.meta.url)
const entityBrowserPath = new URL('../src/app/entity-browser/client-page.tsx', import.meta.url)

const rfpPageSource = readFileSync(rfpPagePath, 'utf8')
const rfpComponentSource = readFileSync(rfpComponentPath, 'utf8')
const entityBrowserSource = readFileSync(entityBrowserPath, 'utf8')

test('dedicated rfps page renders the unified rfp page component', () => {
  assert.match(rfpPageSource, /import UnifiedRfpPage from ["']@\/components\/rfp\/UnifiedRfpPage["']/)
  assert.match(rfpPageSource, /return <UnifiedRfpPage \/>/)
})

test('unified rfp page loads from the shared rfp results API and links back to entity dossiers', () => {
  assert.match(rfpComponentSource, /fetch\('\/api\/rfp-results\?action=latest-rfps'\)/)
  assert.match(rfpComponentSource, /href=\{`\/entity-browser\/\$\{rfp\.entity_id\}\/dossier\?from=1`\}/)
  assert.match(rfpComponentSource, /Unified RFP intelligence/)
})

test('entity browser provides navigation to the csv import page and the dedicated rfp page', () => {
  assert.match(entityBrowserSource, /href="\/entity-import"/)
  assert.match(entityBrowserSource, /href="\/rfps"/)
})
