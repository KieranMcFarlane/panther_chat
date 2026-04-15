import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

test('operational status hero centralizes action-first state copy', async () => {
  const heroSource = await readFile(new URL('../src/lib/operational-status-hero.ts', import.meta.url), 'utf8')
  const stripSource = await readFile(new URL('../src/components/layout/OperationalStatusStrip.tsx', import.meta.url), 'utf8')

  assert.match(heroSource, /buildOperationalStatusHero/)
  assert.match(heroSource, /Stopping intake/)
  assert.match(heroSource, /Starting intake/)
  assert.match(heroSource, /Pipeline intake is paused/)
  assert.match(heroSource, /Resume pipeline/)
  assert.match(heroSource, /Question unavailable/)
  assert.match(heroSource, /No active worker/)
  assert.match(heroSource, /Historical stale backlog remains/)
  assert.match(heroSource, /primaryActionRecommended/)
  assert.match(heroSource, /formatRelativeTimestamp/)
  assert.match(heroSource, /formatExactTimestamp/)
  assert.match(stripSource, /buildOperationalStatusHero/)
  assert.match(stripSource, /Issue detected/)
  assert.match(stripSource, /Recommended/)
  assert.match(stripSource, /System details/)
})
