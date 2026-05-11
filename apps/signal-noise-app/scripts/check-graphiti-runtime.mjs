#!/usr/bin/env node
import 'dotenv/config'
import { loadGraphitiRuntimeHealth } from '../src/lib/graphiti-runtime-health.mjs'

const health = await loadGraphitiRuntimeHealth()
const requiredMode = process.env.GRAPHITI_REQUIRED === '1'

console.log(JSON.stringify({
  ok: !health.blocking,
  falkordb_graph_available: health.falkordb_graph_available,
  graphiti_mcp_available: health.graphiti_mcp_available,
  graphiti_runtime_mode: health.graphiti_runtime_mode,
  graphiti_degraded_reason: health.graphiti_degraded_reason,
  graphiti_required: requiredMode,
  next_recovery_action: health.next_recovery_action,
  redacted_config: health.redacted_config,
}, null, 2))

process.exit(health.blocking ? 1 : 0)
