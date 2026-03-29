import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

test('entity workflow smoke path exposes dossier, enrichment, and opportunity handoff state', async () => {
  const browserSource = await readFile(new URL('../src/app/entity-browser/client-page.tsx', import.meta.url), 'utf8')
  const smokeJourneySource = await readFile(new URL('../src/components/entity-browser/EntitySmokeJourney.tsx', import.meta.url), 'utf8')
  const dossierSource = await readFile(new URL('../src/app/entity-browser/[entityId]/dossier/client-page.tsx', import.meta.url), 'utf8')
  const entityCardSource = await readFile(new URL('../src/components/EntityCard.tsx', import.meta.url), 'utf8')

  assert.match(browserSource, /EntitySmokeJourney/)
  assert.match(smokeJourneySource, /5-Entity Smoke Journey/)
  assert.match(dossierSource, /Persisted dossier loaded|Persisted entity state loaded/)
  assert.match(dossierSource, /EntityEnrichmentSummaryCard/)
  assert.match(entityCardSource, /EntityEnrichmentSummaryCard/)
  assert.ok(
    entityCardSource.includes('/opportunities?entityId=${stableEntityId}') ||
      entityCardSource.includes('Review opportunity fit') ||
      entityCardSource.includes('Open opportunity decision'),
    'expected entity cards to expose an opportunity decision handoff',
  )
  assert.ok(
    dossierSource.includes('/opportunities?entityId=${encodeURIComponent(entityId)}') ||
      dossierSource.includes('Review opportunity fit') ||
      dossierSource.includes('Open opportunity decision'),
    'expected dossier page to expose an opportunity decision handoff',
  )
})
