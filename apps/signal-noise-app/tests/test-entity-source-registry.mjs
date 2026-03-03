import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const helperPath = new URL('../src/lib/entity-source-registry.ts', import.meta.url)
const source = readFileSync(helperPath, 'utf8')

test('entity source registry helper exposes register and read functions', () => {
  assert.match(source, /export async function upsertEntitySourceRegistryEntries/)
  assert.match(source, /export async function getEntitySourceRegistry/)
  assert.match(source, /export async function getCanonicalSourceUrl/)
  assert.match(source, /entity_source_registry/)
  assert.match(source, /onConflict:\s*'entity_id,page_class,url'/)
})

test('entity source registry helper supports canonical page classes', () => {
  assert.match(source, /'official_site'/)
  assert.match(source, /'tenders_page'/)
  assert.match(source, /'procurement_page'/)
  assert.match(source, /'press_release'/)
  assert.match(source, /'careers_page'/)
  assert.match(source, /'document'/)
  assert.match(source, /is_canonical/)
  assert.match(source, /confidence/)
})
