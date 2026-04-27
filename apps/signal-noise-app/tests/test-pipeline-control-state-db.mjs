import assert from 'node:assert/strict'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { test } from 'node:test'

async function loadPipelineControlStateModule() {
  const sourcePath = new URL('../src/lib/pipeline-control-state.ts', import.meta.url)
  const source = await readFile(sourcePath, 'utf8')
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'pipeline-control-state-'))
  const stubPath = path.join(tempDir, 'pg-client.ts')

  await writeFile(stubPath, [
    'export async function query(sql, params = []) {',
    '  return globalThis.__pipelineControlQuery(sql, params)',
    '}',
    '',
  ].join('\n'), 'utf8')

  const rewritten = source.replaceAll(
    "'@/lib/pg-client'",
    JSON.stringify(pathToFileURL(stubPath).href),
  )
  const tempPath = path.join(tempDir, 'pipeline-control-state.ts')
  await writeFile(tempPath, rewritten, 'utf8')
  return { module: import(`${pathToFileURL(tempPath).href}?t=${Date.now()}`), tempDir }
}

test('pipeline control state reads the postgres singleton row and ignores the tmp cache', async () => {
  const { module } = await loadPipelineControlStateModule()
  const previousDatabaseUrl = process.env.DATABASE_URL
  process.env.DATABASE_URL = 'postgresql://local-test'
  const tempControlPath = path.join(os.tmpdir(), `pipeline-control-state-${Date.now()}.json`)
  await writeFile(tempControlPath, JSON.stringify({ current_batch_id: 'batch-file', cursor_source: 'tmp' }), 'utf8')
  globalThis.__pipelineControlQuery = async () => ({
    rows: [{
      state: {
        is_paused: false,
        pause_reason: null,
        stop_reason: null,
        stop_details: null,
        updated_at: '2026-04-27T12:00:00.000Z',
        desired_state: 'running',
        requested_state: 'running',
        observed_state: 'running',
        transition_state: 'running',
        current_batch_id: 'batch-db',
        current_entity_id: 'entity-db',
        current_canonical_entity_id: 'canonical-db',
        current_entity_name: 'Entity DB',
        current_question_id: 'q11_decision_owner',
        current_question_text: 'Who owns this?',
        current_action: 'q11_decision_owner',
        current_phase: 'question_first',
        current_started_at: '2026-04-27T11:59:00.000Z',
        current_activity_at: '2026-04-27T12:00:00.000Z',
        cursor_source: 'manifest_next_claim',
      },
    }],
  })

  try {
    const state = await (await module).readPipelineControlState()

    assert.equal(state.current_batch_id, 'batch-db')
    assert.equal(state.current_entity_id, 'entity-db')
    assert.equal(state.current_canonical_entity_id, 'canonical-db')
    assert.equal(state.cursor_source, 'manifest_next_claim')
  } finally {
    process.env.DATABASE_URL = previousDatabaseUrl
    await writeFile(tempControlPath, '', 'utf8').catch(() => undefined)
  }
})

test('pipeline control state writes the postgres singleton row only', async () => {
  const { module, tempDir } = await loadPipelineControlStateModule()
  const previousCwd = process.cwd()
  const previousDatabaseUrl = process.env.DATABASE_URL
  const writes = []
  process.chdir(tempDir)
  process.env.DATABASE_URL = 'postgresql://local-test'
  globalThis.__pipelineControlQuery = async (sql, params) => {
    writes.push({ sql, params })
    return { rows: [] }
  }

  try {
    const state = await (await module).writePipelineControlState({
      current_batch_id: 'batch-new',
      current_entity_id: 'entity-new',
      current_canonical_entity_id: 'canonical-new',
      current_entity_name: 'Entity New',
      current_question_id: 'q11_decision_owner',
      current_question_text: 'Who owns this?',
      cursor_source: 'manifest_next_claim',
    })

    assert.ok(writes.length >= 1)
    assert.match(writes[0].sql, /insert into pipeline_control_state/i)
    assert.equal(writes[0].params[0], 'pipeline')
    assert.equal(JSON.parse(writes[0].params[1]).current_batch_id, 'batch-new')
    assert.equal(state.current_entity_name, 'Entity New')

    const cachedPath = path.join(tempDir, 'tmp', 'pipeline-control-state.json')
    await assert.rejects(readFile(cachedPath, 'utf8'))
  } finally {
    process.env.DATABASE_URL = previousDatabaseUrl
    process.chdir(previousCwd)
  }
})
