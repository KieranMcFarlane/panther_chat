import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

test('entity enrichment summary is surfaced in the entity browser and dossier', async () => {
  const summarySource = await readFile(new URL('../src/components/entity-enrichment/EntityEnrichmentSummaryCard.tsx', import.meta.url), 'utf8')
  const entityCardSource = await readFile(new URL('../src/components/EntityCard.tsx', import.meta.url), 'utf8')
  const dossierSource = await readFile(new URL('../src/app/entity-browser/[entityId]/dossier/client-page.tsx', import.meta.url), 'utf8')

  assert.match(summarySource, /Enrichment status/)
  assert.match(summarySource, /Last updated/)
  assert.match(summarySource, /Recent contact\/company additions/)
  assert.match(summarySource, /Run enrichment/)
  assert.match(summarySource, /Open advanced enrichment/)
  assert.match(entityCardSource, /EntityEnrichmentSummaryCard/)
  assert.match(dossierSource, /EntityEnrichmentSummaryCard/)
})
