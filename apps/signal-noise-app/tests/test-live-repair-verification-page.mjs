import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'

const pagePath = new URL('../src/app/entity-pipeline/live-repair-verification/page.tsx', import.meta.url)
const homePath = new URL('../src/app/page.tsx', import.meta.url)

test('live repair verification page exists and provides a narrow FC Porto verification path', () => {
  assert.equal(existsSync(pagePath), true)
  const source = readFileSync(pagePath, 'utf8')
  assert.match(source, /FC Porto/)
  assert.match(source, /q11_decision_owner/)
  assert.match(source, /q7_procurement_signal/)
  assert.match(source, /import_1775815384658/)
  assert.match(source, /Published degraded/i)
  assert.match(source, /Reconciliation pending/i)
  assert.match(source, /Repair run/i)
  assert.match(source, /Auto-repair queued|Repairing|Exhausted/i)
  assert.match(source, /retry budget/i)
  assert.match(source, /next repair question/i)
  assert.match(source, /reconciliation state/i)
  assert.match(source, /Home dashboard/i)
  assert.match(source, /Run detail/i)
  assert.match(source, /Canonical dossier/i)
})

test('home page links operators to the live repair verification path', () => {
  const homeSource = readFileSync(homePath, 'utf8')
  assert.match(homeSource, /Live repair verification/i)
  assert.match(homeSource, /\/entity-pipeline\/live-repair-verification/)
})
