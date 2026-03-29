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

test('discovery navigation exposes the control center instead of making it the default home surface', () => {
  assert.match(discoveryNavSource, /Control Center/)
  assert.match(discoveryNavSource, /href: '\/control-center'/)
})
