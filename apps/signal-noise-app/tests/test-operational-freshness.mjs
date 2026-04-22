import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

async function loadOperationalFreshnessModule() {
  const sourcePath = new URL('../src/lib/operational-freshness.ts', import.meta.url)
  const source = await readFile(sourcePath, 'utf8')
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'operational-freshness-'))
  const tempPath = path.join(tempDir, 'operational-freshness.ts')
  await writeFile(tempPath, source, 'utf8')
  return import(`${pathToFileURL(tempPath).href}?t=${Date.now()}`)
}

test('deriveOperationalFreshnessCheckpoint prefers the current run heartbeat for last activity', async () => {
  const { deriveOperationalFreshnessCheckpoint } = await loadOperationalFreshnessModule()

  const freshness = deriveOperationalFreshnessCheckpoint({
    snapshotAt: '2026-04-17T12:00:05.000Z',
    freshnessThresholdSeconds: 300,
    now: '2026-04-17T12:00:06.000Z',
    currentRun: {
      heartbeat_at: '2026-04-17T12:00:04.000Z',
      started_at: '2026-04-17T12:00:00.000Z',
      generated_at: '2026-04-17T12:00:00.000Z',
    },
    staleActiveRows: [
      { heartbeat_at: '2026-04-17T11:40:00.000Z', generated_at: '2026-04-17T11:40:00.000Z' },
    ],
    completedEntities: [
      { generated_at: '2026-04-17T11:55:00.000Z' },
    ],
  })

  assert.equal(freshness.last_activity_at, '2026-04-17T12:00:04.000Z')
  assert.equal(freshness.freshness_state, 'fresh')
})

test('deriveOperationalFreshnessCheckpoint falls back to the latest completed entity when no active heartbeat exists', async () => {
  const { deriveOperationalFreshnessCheckpoint } = await loadOperationalFreshnessModule()

  const freshness = deriveOperationalFreshnessCheckpoint({
    snapshotAt: '2026-04-17T12:10:00.000Z',
    freshnessThresholdSeconds: 300,
    now: '2026-04-17T12:10:30.000Z',
    currentRun: null,
    staleActiveRows: [],
    completedEntities: [
      { generated_at: '2026-04-17T12:08:00.000Z' },
      { generated_at: '2026-04-17T12:07:00.000Z' },
    ],
  })

  assert.equal(freshness.last_activity_at, '2026-04-17T12:08:00.000Z')
  assert.equal(freshness.freshness_state, 'fresh')
})

test('deriveOperationalFreshnessCheckpoint marks the payload stale when the latest activity is past the threshold', async () => {
  const { deriveOperationalFreshnessCheckpoint } = await loadOperationalFreshnessModule()

  const freshness = deriveOperationalFreshnessCheckpoint({
    snapshotAt: '2026-04-17T12:20:00.000Z',
    freshnessThresholdSeconds: 300,
    now: '2026-04-17T12:30:01.000Z',
    currentRun: null,
    staleActiveRows: [
      { heartbeat_at: '2026-04-17T12:21:00.000Z' },
    ],
    completedEntities: [],
  })

  assert.equal(freshness.last_activity_at, '2026-04-17T12:21:00.000Z')
  assert.equal(freshness.freshness_state, 'stale')
})
