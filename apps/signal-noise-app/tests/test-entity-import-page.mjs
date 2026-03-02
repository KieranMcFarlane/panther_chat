import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const pagePath = new URL('../src/app/entity-import/page.tsx', import.meta.url)
const componentPath = new URL('../src/components/entity-import/EntityCsvImporter.tsx', import.meta.url)

const pageSource = readFileSync(pagePath, 'utf8')
const componentSource = readFileSync(componentPath, 'utf8')

test('entity import page renders the CSV importer component', () => {
  assert.match(pageSource, /import EntityCsvImporter from ["']@\/components\/entity-import\/EntityCsvImporter["']/)
  assert.match(pageSource, /export default function EntityImportPage/)
  assert.match(pageSource, /<EntityCsvImporter \/>/)
})

test('entity csv importer uses react-csv-importer and shows required columns', () => {
  assert.match(componentSource, /from ['"]react-csv-importer['"]/)
  assert.match(componentSource, /Importer/)
  assert.match(componentSource, /ImporterField/)
  assert.match(componentSource, /REQUIRED_ENTITY_IMPORT_COLUMNS/)
  assert.match(componentSource, /name/)
  assert.match(componentSource, /entity_type/)
  assert.match(componentSource, /sport/)
  assert.match(componentSource, /country/)
  assert.match(componentSource, /source/)
})

test('entity csv importer posts rows to the entity import API and displays batch status', () => {
  assert.match(componentSource, /fetch\(['"]\/api\/entity-import['"]/)
  assert.match(componentSource, /batchId/)
  assert.match(componentSource, /acceptedRows/)
  assert.match(componentSource, /rejectedRows/)
})
