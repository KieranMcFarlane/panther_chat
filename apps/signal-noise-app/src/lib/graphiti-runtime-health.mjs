import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

const DEFAULT_FALKORDB_URI = 'redis://localhost:6379'
const DEFAULT_FALKORDB_DATABASE = 'sports_intelligence'
const DEFAULT_GRAPHITI_MCP_URL = 'http://127.0.0.1:8000/mcp/'
const DEFAULT_TIMEOUT_MS = 2500

function recoveryActionFor(reason) {
  if (!reason) return 'No action required.'
  if (reason === 'graphiti_mcp_unavailable') {
    return 'Start Graphiti MCP with dev-full after FalkorDB is healthy.'
  }
  if (reason === 'falkordb_graph_unavailable' || reason === 'falkordb_connection_failed') {
    return 'Start local Docker FalkorDB with npm run graphiti:falkordb:up, then restart dev-full so Graphiti MCP can start.'
  }
  return 'Check local Docker FalkorDB and Graphiti MCP runtime health, then restart dev-full.'
}

function text(value) {
  return value === null || value === undefined ? '' : String(value).trim()
}

function isRequired(env = process.env) {
  return text(env.GRAPHITI_REQUIRED) === '1'
}

export function classifyFalkorDbGraphProbe(output) {
  const value = text(output)
  if (!value) return 'available'
  if (/unknown command '?GRAPH\.QUERY'?/i.test(value)) return 'falkordb_graph_unavailable'
  if (/NOAUTH|Authentication|invalid username-password/i.test(value)) return 'falkordb_auth_failed'
  if (/ECONNREFUSED|ENOTFOUND|ETIMEDOUT|timed out|Name or service not known/i.test(value)) return 'falkordb_connection_failed'
  if (/ERR/i.test(value)) return 'falkordb_probe_failed'
  return 'available'
}

export function redactGraphitiRuntimeConfig(env = process.env) {
  const uri = text(env.FALKORDB_URI || DEFAULT_FALKORDB_URI)
  let redactedUri = uri
  try {
    const parsed = new URL(uri)
    if (parsed.password) parsed.password = '[redacted]'
    redactedUri = parsed.toString()
  } catch {
    redactedUri = uri.replace(/:\/\/([^:@/]+):([^@/]+)@/, '://$1:[redacted]@')
  }

  return {
    FALKORDB_URI: redactedUri,
    FALKORDB_USER: text(env.FALKORDB_USER) || null,
    FALKORDB_PASSWORD: text(env.FALKORDB_PASSWORD) ? '[redacted]' : null,
    FALKORDB_DATABASE: text(env.FALKORDB_DATABASE || DEFAULT_FALKORDB_DATABASE),
    GRAPHITI_MCP_URL: text(env.GRAPHITI_MCP_URL || env.GRAPHITI_SERVICE_URL || DEFAULT_GRAPHITI_MCP_URL),
    GRAPHITI_REQUIRED: isRequired(env) ? '1' : '0',
  }
}

function uriHasCredentials(uri) {
  try {
    const parsed = new URL(uri)
    return Boolean(parsed.username || parsed.password)
  } catch {
    return /:\/\/[^/@:]+:[^/@]+@/.test(uri)
  }
}

export function buildFalkorDbRedisCliArgs(env = process.env) {
  const uri = text(env.FALKORDB_URI || DEFAULT_FALKORDB_URI)
  const database = text(env.FALKORDB_DATABASE || DEFAULT_FALKORDB_DATABASE)
  const args = ['-u', uri]
  const password = text(env.FALKORDB_PASSWORD)
  if (password && !uriHasCredentials(uri)) {
    const user = text(env.FALKORDB_USER) || 'default'
    args.push('--user', user, '--pass', password)
  }
  args.push('GRAPH.QUERY', database, 'RETURN 1')
  return args
}

export function buildGraphitiRuntimeHealth({
  graphProbeStatus = 'available',
  graphitiMcpAvailable = false,
  env = process.env,
  graphProbeOutput = '',
} = {}) {
  const required = isRequired(env)
  const falkordbGraphAvailable = graphProbeStatus === 'available'
  const degradedReason = falkordbGraphAvailable
    ? (graphitiMcpAvailable ? null : 'graphiti_mcp_unavailable')
    : graphProbeStatus
  const blocking = required && (!falkordbGraphAvailable || !graphitiMcpAvailable)
  const runtimeMode = blocking
    ? 'required_unavailable'
    : falkordbGraphAvailable && graphitiMcpAvailable
      ? 'ready'
      : 'degraded'

  return {
    falkordb_graph_available: falkordbGraphAvailable,
    graphiti_mcp_available: Boolean(graphitiMcpAvailable),
    graphiti_runtime_mode: runtimeMode,
    graphiti_degraded_reason: degradedReason,
    graphiti_required: required,
    blocking,
    next_recovery_action: recoveryActionFor(degradedReason),
    graph_probe_status: graphProbeStatus,
    graph_probe_output: text(graphProbeOutput).slice(0, 500) || null,
    redacted_config: redactGraphitiRuntimeConfig(env),
  }
}

async function probeFalkorDbGraph(env = process.env, timeoutMs = DEFAULT_TIMEOUT_MS) {
  try {
    const { stdout, stderr } = await execFileAsync(
      'redis-cli',
      buildFalkorDbRedisCliArgs(env),
      { timeout: timeoutMs },
    )
    const output = `${stdout || ''}${stderr || ''}`
    return {
      status: classifyFalkorDbGraphProbe(output),
      output,
    }
  } catch (error) {
    const output = `${error.stdout || ''}${error.stderr || ''}${error.message || ''}`
    return {
      status: classifyFalkorDbGraphProbe(output),
      output,
    }
  }
}

async function probeGraphitiMcp(env = process.env, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const mcpUrl = text(env.GRAPHITI_MCP_URL || env.GRAPHITI_SERVICE_URL || DEFAULT_GRAPHITI_MCP_URL)
  const healthUrl = mcpUrl.replace(/\/mcp\/?$/, '/health')
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(healthUrl, { signal: controller.signal })
    return response.ok
  } catch {
    return false
  } finally {
    clearTimeout(timeout)
  }
}

export async function loadGraphitiRuntimeHealth(options = {}) {
  const env = options.env || process.env
  const timeoutMs = Number(options.timeoutMs || env.GRAPHITI_RUNTIME_HEALTH_TIMEOUT_MS || DEFAULT_TIMEOUT_MS)
  const graphProbe = await probeFalkorDbGraph(env, timeoutMs)
  const graphitiMcpAvailable = graphProbe.status === 'available'
    ? await probeGraphitiMcp(env, timeoutMs)
    : false

  return buildGraphitiRuntimeHealth({
    graphProbeStatus: graphProbe.status,
    graphProbeOutput: graphProbe.output,
    graphitiMcpAvailable,
    env,
  })
}
