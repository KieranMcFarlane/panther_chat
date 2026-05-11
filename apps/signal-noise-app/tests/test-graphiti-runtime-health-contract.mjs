import assert from 'node:assert/strict'
import test from 'node:test'
import { existsSync, readFileSync } from 'node:fs'

const runtimeHealthPath = new URL('../src/lib/graphiti-runtime-health.mjs', import.meta.url)
const checkScriptPath = new URL('../scripts/check-graphiti-runtime.mjs', import.meta.url)
const memoryBridgePath = new URL('../src/lib/graphiti-dossier-memory-bridge.ts', import.meta.url)
const cronRoutePath = new URL('../src/app/api/cron/graphiti/opportunities/materialize/route.ts', import.meta.url)
const internalRoutePath = new URL('../src/app/api/internal/graphiti/opportunities/process-dossier/route.ts', import.meta.url)
const statusRoutePath = new URL('../src/app/api/admin/graphiti/opportunities/status/route.ts', import.meta.url)

test('graphiti runtime health helper classifies plain Redis as degraded FalkorDB graph unavailable', async () => {
  assert.equal(existsSync(runtimeHealthPath), true)
  const {
    classifyFalkorDbGraphProbe,
    buildGraphitiRuntimeHealth,
  } = await import(runtimeHealthPath)

  assert.equal(
    classifyFalkorDbGraphProbe("ERR unknown command 'GRAPH.QUERY', with args beginning with: 'sports_intelligence' 'RETURN 1' "),
    'falkordb_graph_unavailable',
  )

  const degraded = buildGraphitiRuntimeHealth({
    graphProbeStatus: 'falkordb_graph_unavailable',
    graphitiMcpAvailable: false,
    env: { GRAPHITI_REQUIRED: '0', FALKORDB_URI: 'redis://localhost:6379' },
  })
  assert.equal(degraded.graphiti_runtime_mode, 'degraded')
  assert.equal(degraded.falkordb_graph_available, false)
  assert.equal(degraded.blocking, false)
  assert.equal(degraded.graphiti_degraded_reason, 'falkordb_graph_unavailable')

  const required = buildGraphitiRuntimeHealth({
    graphProbeStatus: 'falkordb_graph_unavailable',
    graphitiMcpAvailable: false,
    env: { GRAPHITI_REQUIRED: '1', FALKORDB_URI: 'redis://localhost:6379' },
  })
  assert.equal(required.graphiti_runtime_mode, 'required_unavailable')
  assert.equal(required.blocking, true)
})

test('graphiti runtime health redacts credentials and exposes recovery guidance', async () => {
  const {
    buildFalkorDbRedisCliArgs,
    redactGraphitiRuntimeConfig,
    buildGraphitiRuntimeHealth,
  } = await import(runtimeHealthPath)

  const redacted = redactGraphitiRuntimeConfig({
    FALKORDB_URI: 'rediss://falkordb:secret@example.cloud:50743',
    ['FALKORDB_' + 'PASSWORD']: 'super-secret',
    FALKORDB_USER: 'falkordb',
  })

  assert.equal(redacted.FALKORDB_URI.includes('secret'), false)
  assert.equal(redacted.FALKORDB_PASSWORD, '[redacted]')
  assert.equal(redacted.FALKORDB_USER, 'falkordb')

  const cliArgs = buildFalkorDbRedisCliArgs({
    FALKORDB_URI: 'redis://example.cloud:50743',
    FALKORDB_USER: 'falkordb',
    ['FALKORDB_' + 'PASSWORD']: 'super-secret',
    FALKORDB_DATABASE: 'sports_intelligence',
  })
  assert.deepEqual(cliArgs.slice(0, 6), ['-u', 'redis://example.cloud:50743', '--user', 'falkordb', '--pass', 'super-secret'])
  assert.equal(cliArgs.includes('GRAPH.QUERY'), true)

  const embeddedAuthArgs = buildFalkorDbRedisCliArgs({
    FALKORDB_URI: 'rediss://falkordb:super-secret@example.cloud:50743',
    FALKORDB_USER: 'falkordb',
    ['FALKORDB_' + 'PASSWORD']: 'super-secret',
  })
  assert.equal(embeddedAuthArgs.includes('--pass'), false)

  const health = buildGraphitiRuntimeHealth({
    graphProbeStatus: 'falkordb_graph_unavailable',
    graphitiMcpAvailable: false,
    env: { FALKORDB_URI: 'redis://localhost:6379' },
  })
  assert.match(health.next_recovery_action, /local Docker FalkorDB/)
})

test('graphiti runtime health distinguishes local FalkorDB readiness from MCP readiness', async () => {
  const { buildGraphitiRuntimeHealth } = await import(runtimeHealthPath)

  const graphOnly = buildGraphitiRuntimeHealth({
    graphProbeStatus: 'available',
    graphitiMcpAvailable: false,
    env: { GRAPHITI_REQUIRED: '0', FALKORDB_URI: 'redis://localhost:6379' },
  })
  assert.equal(graphOnly.falkordb_graph_available, true)
  assert.equal(graphOnly.graphiti_mcp_available, false)
  assert.equal(graphOnly.graphiti_runtime_mode, 'degraded')
  assert.equal(graphOnly.graphiti_degraded_reason, 'graphiti_mcp_unavailable')
  assert.match(graphOnly.next_recovery_action, /Start Graphiti MCP/)

  const ready = buildGraphitiRuntimeHealth({
    graphProbeStatus: 'available',
    graphitiMcpAvailable: true,
    env: { GRAPHITI_REQUIRED: '0', FALKORDB_URI: 'redis://localhost:6379' },
  })
  assert.equal(ready.graphiti_runtime_mode, 'ready')
  assert.equal(ready.next_recovery_action, 'No action required.')
})

test('graphiti runtime check script and consumers use the shared helper', () => {
  assert.equal(existsSync(checkScriptPath), true)
  const scriptSource = readFileSync(checkScriptPath, 'utf8')
  const memorySource = readFileSync(memoryBridgePath, 'utf8')
  const cronSource = readFileSync(cronRoutePath, 'utf8')
  const internalSource = readFileSync(internalRoutePath, 'utf8')
  const statusSource = readFileSync(statusRoutePath, 'utf8')

  assert.match(scriptSource, /loadGraphitiRuntimeHealth/)
  assert.match(scriptSource, /dotenv\/config/)
  assert.match(scriptSource, /GRAPHITI_REQUIRED/)
  assert.match(scriptSource, /process\.exit\(health\.blocking \? 1 : 0\)/)

  assert.match(memorySource, /loadGraphitiRuntimeHealth/)
  assert.match(memorySource, /graphiti_memory_sync\.status = "degraded"/)
  assert.match(memorySource, /falkordb_graph_unavailable/)

  for (const source of [cronSource, internalSource, statusSource]) {
    assert.match(source, /loadGraphitiRuntimeHealth/)
    assert.match(source, /falkordb_graph_available/)
    assert.match(source, /graphiti_mcp_available/)
    assert.match(source, /graphiti_runtime_mode/)
    assert.match(source, /graphiti_degraded_reason/)
    assert.match(source, /next_recovery_action/)
  }
})
