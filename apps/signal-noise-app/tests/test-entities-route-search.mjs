import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const routePath = new URL('../src/app/api/entities/route.ts', import.meta.url)
const source = readFileSync(routePath, 'utf8')

test('entities route searches against cached entity properties fields instead of a missing top-level name column', () => {
  assert.match(source, /properties->>name\.ilike|properties->>'name'\.ilike/)
  assert.doesNotMatch(source, /query = query\.or\(`name\.ilike\./)
})
