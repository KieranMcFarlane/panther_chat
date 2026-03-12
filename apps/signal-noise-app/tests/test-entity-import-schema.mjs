import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const schemaPath = new URL('../src/lib/entity-import-schema.ts', import.meta.url)
const source = readFileSync(schemaPath, 'utf8')

test('entity import schema defines required and optional CSV columns', () => {
  assert.match(source, /export const REQUIRED_ENTITY_IMPORT_COLUMNS = \[/)
  assert.match(source, /['"]name['"]/)
  assert.match(source, /['"]entity_type['"]/)
  assert.match(source, /['"]sport['"]/)
  assert.match(source, /['"]country['"]/)
  assert.match(source, /['"]source['"]/)
  assert.match(source, /export const OPTIONAL_ENTITY_IMPORT_COLUMNS = \[/)
  assert.match(source, /['"]website['"]/)
  assert.match(source, /['"]league['"]/)
  assert.match(source, /['"]priority_score['"]/)
})

test('entity import schema exposes normalization helpers for row validation', () => {
  assert.match(source, /export function slugifyImportedEntityName/)
  assert.match(source, /export function normalizeImportedEntityRow/)
  assert.match(source, /priority_score: .*85/)
  assert.match(source, /missing required columns/i)
})
