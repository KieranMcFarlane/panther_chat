import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

import { test } from 'node:test'

test('root layout imports globals.css', async () => {
  const layout = await readFile(new URL('../src/app/layout.tsx', import.meta.url), 'utf8')

  assert.match(layout, /import\s+['"]\.\/globals\.css['"]/)
})
