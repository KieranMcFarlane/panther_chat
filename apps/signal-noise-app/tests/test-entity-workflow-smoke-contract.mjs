import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

test('entity workflow smoke path exposes dossier, enrichment, and opportunity handoff state', async () => {
  const browserSource = await readFile(new URL('../src/app/entity-browser/client-page.tsx', import.meta.url), 'utf8')
  const browserPageSource = await readFile(new URL('../src/app/entity-browser/page.tsx', import.meta.url), 'utf8')
  const smokeJourneySource = await readFile(new URL('../src/components/entity-browser/EntitySmokeJourney.tsx', import.meta.url), 'utf8')
  const dossierSource = await readFile(new URL('../src/app/entity-browser/[entityId]/dossier/client-page.tsx', import.meta.url), 'utf8')
  const entityCardSource = await readFile(new URL('../src/components/EntityCard.tsx', import.meta.url), 'utf8')

  assert.doesNotMatch(browserSource, /EntitySmokeJourney/)
  assert.doesNotMatch(browserPageSource, /EntitySmokeJourney/)
  assert.doesNotMatch(browserPageSource, /SmokeJourneySlot/)
  assert.doesNotMatch(browserPageSource, /getEntityBrowserSmokeItems\(\)\.catch\(\(\) => \[\]\)/)
  assert.doesNotMatch(browserPageSource, /<Suspense fallback=\{null\}>/)
  assert.doesNotMatch(browserPageSource, /Local QA Dossiers/)
  assert.match(smokeJourneySource, /getEntityBrowserDossierHref\(item\.entityId, '1'\)/)
  assert.match(dossierSource, /Persisted dossier loaded|Persisted entity state loaded/)
  assert.match(dossierSource, /EntityEnrichmentSummaryCard/)
  assert.match(entityCardSource, /getEntityBrowserDossierHref\(entity, currentPage\)/)
  assert.match(entityCardSource, /Open dossier/)
  assert.match(entityCardSource, /rememberEntityBrowserUrl\(\)/)
  assert.ok(
    dossierSource.includes('/opportunities?entityId=${encodeURIComponent(entityId)}') ||
      dossierSource.includes('Review opportunity fit') ||
      dossierSource.includes('Open opportunity decision'),
    'expected dossier page to expose an opportunity decision handoff',
  )
})
