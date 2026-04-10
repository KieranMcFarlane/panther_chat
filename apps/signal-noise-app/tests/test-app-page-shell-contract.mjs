import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

test('shared page shell inherits the global app shell instead of forcing its own viewport background', async () => {
  const source = await readFile(new URL('../src/components/layout/AppPageShell.tsx', import.meta.url), 'utf8')

  assert.match(source, /<section className=\{cn\('w-full text-foreground'/)
  assert.match(source, /mx-auto flex w-full flex-col gap-6/)
  assert.doesNotMatch(source, /<main className=\{cn\('min-h-screen bg-background text-foreground'/)
})
