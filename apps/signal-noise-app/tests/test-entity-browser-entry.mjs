import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const rootPageSource = readFileSync(new URL('../src/app/page.tsx', import.meta.url), 'utf8')
const controlCenterPageSource = readFileSync(new URL('../src/app/control-center/page.tsx', import.meta.url), 'utf8')
const discoveryNavSource = readFileSync(new URL('../src/components/layout/discovery-nav.ts', import.meta.url), 'utf8')

test('root page sends operators to the entity browser first', () => {
  assert.match(rootPageSource, /redirect\(["']\/entity-browser["']\)/)
})

test('control center remains available as the secondary live overview', () => {
  assert.match(controlCenterPageSource, /DiscoveryWorkspace/)
  assert.match(controlCenterPageSource, /export default function ControlCenterPage/)
})

test('discovery navigation keeps the primary lanes explicit and the home surface slim', () => {
  assert.match(discoveryNavSource, /label: 'Entities', href: '\/entity-browser'/)
  assert.match(discoveryNavSource, /label: \"RFP's\/Tenders\", href: '\/tenders'/)
  assert.match(discoveryNavSource, /label: 'Opportunities', href: '\/opportunities'/)
  assert.match(discoveryNavSource, /label: 'Home', href: '\/'/)
  assert.doesNotMatch(discoveryNavSource, /Control Center/)
})
