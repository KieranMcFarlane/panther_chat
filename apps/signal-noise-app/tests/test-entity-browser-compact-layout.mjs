import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const appNavigationPath = new URL('../src/components/layout/AppNavigation.tsx', import.meta.url)
const smokeJourneyPath = new URL('../src/components/entity-browser/EntitySmokeJourney.tsx', import.meta.url)

const appNavigationSource = readFileSync(appNavigationPath, 'utf8')
const smokeJourneySource = readFileSync(smokeJourneyPath, 'utf8')

test('entity browser keeps the operational drawer collapsed by default', () => {
  assert.match(appNavigationSource, /const \[drawerOpen, setDrawerOpen\] = useState\(false\);/)
  assert.match(appNavigationSource, /<OperationalStatusStrip/)
  assert.match(appNavigationSource, /<OperationalDrawer open=\{drawerOpen\} \/>/)
})

test('entity browser smoke journey uses a denser grid and tighter cards', () => {
  assert.match(smokeJourneySource, /className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5"/)
  assert.match(smokeJourneySource, /className="rounded-xl border border-border bg-muted\/35 p-3[^"]*"/)
  assert.match(smokeJourneySource, /size="sm" className="gap-1\.5 px-4 py-2"/)
})
