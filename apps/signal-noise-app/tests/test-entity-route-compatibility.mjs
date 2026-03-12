import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const legacyEntityPageSource = readFileSync(
  new URL('../src/app/entity/[entityId]/page.tsx', import.meta.url),
  'utf8'
)
const entityCardSource = readFileSync(
  new URL('../src/components/EntityCard.tsx', import.meta.url),
  'utf8'
)

test('legacy entity route redirects to the dossier page while preserving query params', () => {
  assert.match(legacyEntityPageSource, /redirect\(/)
  assert.match(legacyEntityPageSource, /\/entity-browser\/\$\{entityId\}\/dossier/)
  assert.match(legacyEntityPageSource, /searchParams/)
  assert.match(legacyEntityPageSource, /URLSearchParams/)
})

test('entity cards link directly to the dossier page instead of the legacy entity route', () => {
  assert.match(entityCardSource, /\/entity-browser\/\$\{entity\.neo4j_id\}\/dossier\?from=\$\{currentPage\}/)
  assert.doesNotMatch(entityCardSource, /router\.push\(`\/entity\/\$\{entity\.neo4j_id\}\?from=\$\{currentPage\}`\)/)
})
