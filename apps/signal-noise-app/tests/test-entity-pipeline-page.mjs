import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const pagePath = new URL('../src/app/entity-pipeline/page.tsx', import.meta.url)
const formPath = new URL('../src/components/entity-import/SingleEntityPipelineForm.tsx', import.meta.url)

const pageSource = readFileSync(pagePath, 'utf8')
const formSource = readFileSync(formPath, 'utf8')

test('single-entity pipeline page renders the standalone form component', () => {
  assert.match(pageSource, /SingleEntityPipelineForm/)
  assert.match(pageSource, /Queue a single entity/i)
})

test('single-entity pipeline form posts to the async entity pipeline route and redirects to run detail', () => {
  assert.match(formSource, /fetch\('\/api\/entity-pipeline'/)
  assert.match(formSource, /router\.push\(result\.runDetailUrl\)/)
  assert.match(formSource, /priority_score:\s*'85'/)
  assert.match(formSource, /Number\(formState\.priority_score \|\| 85\)/)
  assert.match(formSource, /name="name"/)
  assert.match(formSource, /name="entity_type"/)
  assert.match(formSource, /name="sport"/)
  assert.match(formSource, /name="country"/)
  assert.match(formSource, /Queue entity/)
})
