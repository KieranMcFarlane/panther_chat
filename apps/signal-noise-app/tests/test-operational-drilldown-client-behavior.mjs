import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

async function loadOperationalDrilldownClientModule() {
  const sourcePath = new URL('../src/lib/operational-drilldown-client.ts', import.meta.url)
  const source = await readFile(sourcePath, 'utf8')
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'operational-drilldown-client-'))
  const tempPath = path.join(tempDir, 'operational-drilldown-client.ts')
  await writeFile(tempPath, source, 'utf8')
  return import(`${pathToFileURL(tempPath).href}?t=${Date.now()}`)
}

function createFetchResponse(payload) {
  return {
    ok: true,
    async json() {
      return payload
    },
  }
}

test('loadOperationalDrilldownPayload reuses a fresh cached snapshot but refetches after TTL expiry', async () => {
  const client = await loadOperationalDrilldownClientModule()
  const realFetch = globalThis.fetch
  const realNow = Date.now

  let fetchCount = 0
  const payloads = [
    { snapshot_at: '2026-04-17T12:00:00.000Z', loop_status: {}, queue: { in_progress_entity: null, completed_entities: [], resume_needed_entities: [], upcoming_entities: [] }, dossier_quality: { incomplete_entities: [] } },
    { snapshot_at: '2026-04-17T12:00:30.000Z', loop_status: {}, queue: { in_progress_entity: null, completed_entities: [], resume_needed_entities: [], upcoming_entities: [] }, dossier_quality: { incomplete_entities: [] } },
  ]

  try {
    Date.now = () => 1_000
    globalThis.fetch = async () => createFetchResponse(payloads[fetchCount++])

    const firstPayload = await client.loadOperationalDrilldownPayload()
    const secondPayload = await client.loadOperationalDrilldownPayload()

    assert.equal(fetchCount, 1)
    assert.equal(firstPayload.snapshot_at, '2026-04-17T12:00:00.000Z')
    assert.equal(secondPayload.snapshot_at, '2026-04-17T12:00:00.000Z')

    Date.now = () => 1_000 + client.OPERATIONAL_DRILLDOWN_CACHE_TTL_MS + 1
    const refreshedPayload = await client.loadOperationalDrilldownPayload()

    assert.equal(fetchCount, 2)
    assert.equal(refreshedPayload.snapshot_at, '2026-04-17T12:00:30.000Z')
  } finally {
    Date.now = realNow
    globalThis.fetch = realFetch
  }
})

test('refreshOperationalDrilldownPayload busts the cache immediately even within the TTL window', async () => {
  const client = await loadOperationalDrilldownClientModule()
  const realFetch = globalThis.fetch
  const realNow = Date.now

  let fetchCount = 0
  const payloads = [
    { snapshot_at: '2026-04-17T13:00:00.000Z', loop_status: {}, queue: { in_progress_entity: null, completed_entities: [], resume_needed_entities: [], upcoming_entities: [] }, dossier_quality: { incomplete_entities: [] } },
    { snapshot_at: '2026-04-17T13:00:05.000Z', loop_status: {}, queue: { in_progress_entity: null, completed_entities: [], resume_needed_entities: [], upcoming_entities: [] }, dossier_quality: { incomplete_entities: [] } },
  ]

  try {
    Date.now = () => 5_000
    globalThis.fetch = async () => createFetchResponse(payloads[fetchCount++])

    const firstPayload = await client.loadOperationalDrilldownPayload()
    const refreshedPayload = await client.refreshOperationalDrilldownPayload()

    assert.equal(fetchCount, 2)
    assert.equal(firstPayload.snapshot_at, '2026-04-17T13:00:00.000Z')
    assert.equal(refreshedPayload.snapshot_at, '2026-04-17T13:00:05.000Z')
  } finally {
    Date.now = realNow
    globalThis.fetch = realFetch
  }
})

test('concurrent loadOperationalDrilldownPayload calls share one in-flight fetch before caching', async () => {
  const client = await loadOperationalDrilldownClientModule()
  const realFetch = globalThis.fetch
  const realNow = Date.now

  let fetchCount = 0
  let releaseFetch
  const fetchGate = new Promise((resolve) => {
    releaseFetch = resolve
  })

  try {
    Date.now = () => 9_000
    globalThis.fetch = async () => {
      fetchCount += 1
      await fetchGate
      return createFetchResponse({
        snapshot_at: '2026-04-17T14:00:00.000Z',
        loop_status: {},
        queue: { in_progress_entity: null, completed_entities: [], resume_needed_entities: [], upcoming_entities: [] },
        dossier_quality: { incomplete_entities: [] },
      })
    }

    const firstRequest = client.loadOperationalDrilldownPayload()
    const secondRequest = client.loadOperationalDrilldownPayload()
    releaseFetch()

    const [firstPayload, secondPayload] = await Promise.all([firstRequest, secondRequest])

    assert.equal(fetchCount, 1)
    assert.equal(firstPayload.snapshot_at, '2026-04-17T14:00:00.000Z')
    assert.equal(secondPayload.snapshot_at, '2026-04-17T14:00:00.000Z')
  } finally {
    Date.now = realNow
    globalThis.fetch = realFetch
  }
})

test('refreshes notify shared subscribers through the drilldown client store', async () => {
  const client = await loadOperationalDrilldownClientModule()
  const realFetch = globalThis.fetch

  const seenSnapshots = []
  const unsubscribe = client.subscribeOperationalDrilldown((payload) => {
    if (payload?.snapshot_at) {
      seenSnapshots.push(payload.snapshot_at)
    }
  })

  let fetchCount = 0
  const payloads = [
    { snapshot_at: '2026-04-17T15:00:00.000Z', loop_status: {}, queue: { in_progress_entity: null, completed_entities: [], resume_needed_entities: [], upcoming_entities: [] }, dossier_quality: { incomplete_entities: [] } },
    { snapshot_at: '2026-04-17T15:00:05.000Z', loop_status: {}, queue: { in_progress_entity: null, completed_entities: [], resume_needed_entities: [], upcoming_entities: [] }, dossier_quality: { incomplete_entities: [] } },
  ]

  try {
    globalThis.fetch = async () => createFetchResponse(payloads[fetchCount++])
    await client.loadOperationalDrilldownPayload()
    await client.refreshOperationalDrilldownPayload()

    assert.deepEqual(seenSnapshots, [
      '2026-04-17T15:00:00.000Z',
      '2026-04-17T15:00:05.000Z',
    ])
  } finally {
    unsubscribe()
    globalThis.fetch = realFetch
  }
})

test('getCachedOperationalDrilldownPayload hydrates from session storage after a reload', async () => {
  const realWindow = globalThis.window
  const realSessionStorage = globalThis.sessionStorage

  const storage = new Map()
  const sessionStorage = {
    getItem(key) {
      return storage.has(key) ? storage.get(key) : null
    },
    setItem(key, value) {
      storage.set(key, String(value))
    },
    removeItem(key) {
      storage.delete(key)
    },
  }

  try {
    globalThis.window = { sessionStorage }
    globalThis.sessionStorage = sessionStorage

    const client = await loadOperationalDrilldownClientModule()
    sessionStorage.setItem(
      client.OPERATIONAL_DRILLDOWN_STORAGE_KEY,
      JSON.stringify({
        snapshot_at: '2026-04-17T16:00:00.000Z',
        loop_status: { universe_count: 3332 },
        queue: { in_progress_entity: null, completed_entities: [], resume_needed_entities: [], upcoming_entities: [] },
        dossier_quality: { incomplete_entities: [] },
      }),
    )

    const cachedPayload = client.getCachedOperationalDrilldownPayload()

    assert.equal(cachedPayload?.snapshot_at, '2026-04-17T16:00:00.000Z')
    assert.equal(cachedPayload?.loop_status?.universe_count, 3332)
    assert.equal(client.isOperationalDrilldownCacheFresh(), false)
  } finally {
    globalThis.window = realWindow
    globalThis.sessionStorage = realSessionStorage
  }
})
