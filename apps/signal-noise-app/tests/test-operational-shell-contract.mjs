import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import * as lucide from 'lucide-react'
test('operational shell primitives expose the expected visible shell content', async () => {
  const stripSource = await readFile(new URL('../src/components/layout/OperationalStatusStrip.tsx', import.meta.url), 'utf8')
  const drawerSource = await readFile(new URL('../src/components/layout/OperationalDrawer.tsx', import.meta.url), 'utf8')

  assert.match(stripSource, /Live Ops/)
  assert.match(stripSource, /Show run details|Hide run details/)
  assert.match(stripSource, /Entities active/)
  assert.match(stripSource, /\/api\/operational-summary/)
  assert.match(drawerSource, /Operational Snapshot/)
  assert.match(drawerSource, /Active runs/)
  assert.match(drawerSource, /Recent completions/)
  assert.match(drawerSource, /\/api\/operational-summary/)
  assert.doesNotMatch(drawerSource, /Scanning fresh RFP sources|Smoke journey loaded successfully/)
})

test('app navigation renders the shared operational shell primitives', async () => {
  const source = await readFile(new URL('../src/components/layout/AppNavigation.tsx', import.meta.url), 'utf8')

  assert.match(source, /OperationalStatusStrip/)
  assert.match(source, /OperationalDrawer/)
  assert.match(source, /<OperationalStatusStrip/)
  assert.match(source, /<OperationalDrawer/)
})

test('operational drawer only uses lucide icons that exist in the installed package', async () => {
  const source = await readFile(new URL('../src/components/layout/OperationalDrawer.tsx', import.meta.url), 'utf8')
  const importMatch = source.match(/import \{([^}]+)\} from 'lucide-react'/)

  assert.ok(importMatch, 'expected lucide-react import in operational drawer')

  const importedNames = importMatch[1]
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean)

  for (const iconName of importedNames) {
    assert.equal(
      typeof lucide[iconName],
      'object',
      `expected lucide-react export ${iconName} to exist for OperationalDrawer`,
    )
  }
})
