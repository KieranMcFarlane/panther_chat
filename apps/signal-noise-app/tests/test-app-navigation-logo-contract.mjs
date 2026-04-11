import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

test('app navigation uses the existing public logo asset', async () => {
  const source = await readFile(new URL('../src/components/layout/AppNavigation.tsx', import.meta.url), 'utf8')

  assert.match(source, /\/yp_logo\.svg/)
  assert.doesNotMatch(source, /\/yellow-panther-logo\.png/)
})
