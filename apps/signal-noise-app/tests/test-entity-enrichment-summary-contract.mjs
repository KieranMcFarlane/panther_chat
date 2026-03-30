import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

test('entity enrichment summary is surfaced in the entity browser and dossier', async () => {
  const entityCardSource = await readFile(new URL('../src/components/EntityCard.tsx', import.meta.url), 'utf8')
  const dossierSource = await readFile(new URL('../src/app/entity-browser/[entityId]/dossier/client-page.tsx', import.meta.url), 'utf8')

  assert.match(entityCardSource, /Open dossier/)
  assert.match(dossierSource, /Further enrich/)
  assert.match(dossierSource, /EntityEnrichmentSummaryCard/)
})
