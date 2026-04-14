import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  loadEntityClusterMapping,
  loadProductionClusters,
} from '../src/lib/ralph-analytics-helper.ts'

test('ralph analytics helpers fall back quietly when optional cluster files are missing', async () => {
  const originalCwd = process.cwd()
  const tempDir = mkdtempSync(join(tmpdir(), 'ralph-analytics-missing-'))
  const originalConsoleError = console.error
  const errors = []

  console.error = (...args) => {
    errors.push(args)
  }

  try {
    process.chdir(tempDir)

    await assert.doesNotReject(async () => {
      const [mapping, clusters] = await Promise.all([
        loadEntityClusterMapping(),
        loadProductionClusters(),
      ])

      assert.deepEqual(mapping, {})
      assert.deepEqual(clusters, {})
    })

    assert.equal(errors.length, 0)
  } finally {
    process.chdir(originalCwd)
    console.error = originalConsoleError
  }
})
