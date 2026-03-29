import assert from 'node:assert/strict'
import { test } from 'node:test'

const baseUrl = process.env.SNA_RUNTIME_BASE_URL || 'http://localhost:3005'
const entityId = 'dca9d675-1d91-4a19-8ae6-04ed0df624cd'
const entityName = 'Arsenal Football Club'

test('entity-first runtime journey exposes browser, dossier, and opportunity decision surfaces', async () => {
  const browserResponse = await fetch(`${baseUrl}/entity-browser`)
  assert.equal(browserResponse.status, 200)
  const browserHtml = await browserResponse.text()
  assert.match(browserHtml, /Hydrating entity browser from cached snapshot and taxonomy.|Live Ops/)

  const dossierResponse = await fetch(`${baseUrl}/entity-browser/${entityId}/dossier?from=1`)
  assert.equal(dossierResponse.status, 200)
  const dossierHtml = await dossierResponse.text()
  assert.match(dossierHtml, /Entity dossier workspace/)
  assert.match(dossierHtml, /Persisted dossier state/)
  assert.match(dossierHtml, /Review opportunity fit/)

  const opportunitiesResponse = await fetch(
    `${baseUrl}/opportunities?entityId=${encodeURIComponent(entityId)}&entityName=${encodeURIComponent(entityName)}`,
  )
  assert.equal(opportunitiesResponse.status, 200)
  const opportunitiesHtml = await opportunitiesResponse.text()
  assert.match(opportunitiesHtml, /Arsenal Football Club/)
})
