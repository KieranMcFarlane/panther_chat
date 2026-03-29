import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const globalsCss = readFileSync(new URL('../src/app/globals.css', import.meta.url), 'utf8')

test('globals stylesheet applies the base layer colors directly', () => {
  assert.match(globalsCss, /@layer base\s*\{[\s\S]*\*\s*\{[\s\S]*border-color:\s*hsl\(var\(--border\)\);/)
  assert.match(globalsCss, /body\s*\{[\s\S]*background-color:\s*hsl\(var\(--background\)\);[\s\S]*color:\s*hsl\(var\(--foreground\)\);/)
  assert.doesNotMatch(globalsCss, /@apply\s+border-border;/)
  assert.doesNotMatch(globalsCss, /@apply\s+bg-background\s+text-foreground;/)
})
