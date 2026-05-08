import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const packageSource = readFileSync(
  new URL('../package.json', import.meta.url),
  'utf8'
)
const devFullScriptSource = readFileSync(
  new URL('../scripts/dev-full.sh', import.meta.url),
  'utf8'
)
const entityPipelineWorkerSource = readFileSync(
  new URL('../backend/entity_pipeline_worker.py', import.meta.url),
  'utf8'
)

test('package exposes a backend dev launcher with Claude disabled for local development', () => {
  const pkg = JSON.parse(packageSource)

  assert.equal(
    pkg.scripts['backend:dev:no-llm'],
    'bash -lc \'test "${PANTHER_CHAT_ALLOW_DIRECT_START:-0}" = 1 || { echo "Use bash scripts/dev-full.sh" >&2; exit 1; }; cd ../.. && DISABLE_CLAUDE_API=1 ${PYTHON_BIN:-python3} apps/signal-noise-app/backend/main.py\''
  )
})

test('package does not expose a dev alias', () => {
  const pkg = JSON.parse(packageSource)

  assert.equal(pkg.scripts.dev, undefined)
})

test('package guards the standalone production start command behind the full launcher', () => {
  const pkg = JSON.parse(packageSource)

  assert.match(pkg.scripts['start'], /PANTHER_CHAT_ALLOW_DIRECT_START/)
})

test('full dev launcher prewarms the entity snapshot after frontend startup', () => {
  assert.match(devFullScriptSource, /frontend_pid=/)
  assert.match(devFullScriptSource, /wait_for_frontend\(\)/)
  assert.match(devFullScriptSource, /curl -sf http:\/\/127\.0\.0\.1:3005\/api\/health/)
  assert.match(devFullScriptSource, /curl -sf ['"]http:\/\/127\.0\.0\.1:3005\/api\/entities\?page=1&limit=10&entityType=all&sortBy=name&sortOrder=asc['"]/)
  assert.match(devFullScriptSource, /curl -sf ['"]http:\/\/127\.0\.0\.1:3005\/api\/entities\/summary['"]/)
  assert.match(devFullScriptSource, /wait "\$\{frontend_pid\}"/)
})

test('full dev launcher verifies the Python backend API, not only a generic health endpoint', () => {
  assert.match(devFullScriptSource, /openapi\.json/)
  assert.match(devFullScriptSource, /\/api\/pipeline\/run-entity/)
  assert.match(devFullScriptSource, /payload\.get\("status"\)\s*!=\s*"healthy"/)
  assert.match(devFullScriptSource, /payload\.get\("version"\)\s*!=\s*"2\.0\.0"/)
})

test('full dev launcher keeps BrightData FastMCP off the Python backend port', () => {
  assert.match(devFullScriptSource, /BRIGHTDATA_FASTMCP_PORT=8014/)
  assert.doesNotMatch(devFullScriptSource, /BRIGHTDATA_FASTMCP_PORT=8000/)
})

test('full dev launcher keeps the Python backend off the Graphiti MCP port', () => {
  assert.match(devFullScriptSource, /SIGNAL_NOISE_BACKEND_PORT="\$\{SIGNAL_NOISE_BACKEND_PORT:-8002\}"/)
  assert.match(devFullScriptSource, /GRAPHITI_MCP_PORT="\$\{GRAPHITI_MCP_PORT:-8000\}"/)
  assert.match(devFullScriptSource, /FASTAPI_URL="\$\{FASTAPI_URL:-http:\/\/127\.0\.0\.1:\$\{SIGNAL_NOISE_BACKEND_PORT\}\}"/)
  assert.match(devFullScriptSource, /PYTHON_BACKEND_URL="\$\{PYTHON_BACKEND_URL:-http:\/\/127\.0\.0\.1:\$\{SIGNAL_NOISE_BACKEND_PORT\}\}"/)
  assert.match(devFullScriptSource, /BACKEND_PORT="\$\{BACKEND_PORT:-\$\{SIGNAL_NOISE_BACKEND_PORT\}\}"/)
  assert.match(devFullScriptSource, /with urlopen\(os\.environ\["FASTAPI_URL"\] \+ "\/health", timeout=2\)/)
  assert.doesNotMatch(devFullScriptSource, /http:\/\/127\.0\.0\.1:8000\/health/)
  assert.doesNotMatch(devFullScriptSource, /Backend failed to become ready on port 8000/)
})

test('full dev launcher starts and supervises Graphiti MCP on the FalkorDB graph port', () => {
  assert.match(devFullScriptSource, /graphiti_mcp_pid=/)
  assert.match(devFullScriptSource, /graphiti_mcp_pid_file="tmp\/graphiti-mcp\.pid"/)
  assert.match(devFullScriptSource, /GRAPHITI_MCP_URL="\$\{GRAPHITI_MCP_URL:-http:\/\/127\.0\.0\.1:\$\{GRAPHITI_MCP_PORT\}\/mcp\/\}"/)
  assert.match(devFullScriptSource, /FALKORDB_URI="\$\{FALKORDB_URI:-redis:\/\/localhost:6379\}"/)
  assert.match(devFullScriptSource, /FALKORDB_USER="\$\{FALKORDB_USER:-\}"/)
  assert.match(devFullScriptSource, /FALKORDB_PASSWORD="\$\{FALKORDB_PASSWORD:-\}"/)
  assert.match(devFullScriptSource, /FALKORDB_DATABASE="\$\{FALKORDB_DATABASE:-sports_intelligence\}"/)
  assert.match(devFullScriptSource, /wait_for_graphiti_mcp\(\)/)
  assert.match(devFullScriptSource, /start_graphiti_mcp\(\)/)
  assert.match(devFullScriptSource, /restart_graphiti_mcp\(\)/)
  assert.match(devFullScriptSource, /if wait_for_graphiti_mcp >\/dev\/null 2>&1; then[\s\S]*return 0[\s\S]*fi/)
  assert.match(devFullScriptSource, /recovery supervisor: Graphiti MCP unhealthy; restarting Graphiti MCP/)
  assert.match(devFullScriptSource, /backend\/graphiti_mcp_server_official/)
  assert.match(devFullScriptSource, /uv run python main\.py --transport http --host 0\.0\.0\.0 --port "\$\{GRAPHITI_MCP_PORT\}" --database-provider falkordb/)
  assert.match(devFullScriptSource, /curl -sf "http:\/\/127\.0\.0\.1:\$\{GRAPHITI_MCP_PORT\}\/health"/)
  assert.match(devFullScriptSource, /if check_falkordb_graph; then[\s\S]*start_graphiti_mcp[\s\S]*fi/)
})

test('full dev launcher starts in graph-degraded mode unless Graphiti is required', () => {
  assert.match(devFullScriptSource, /check_falkordb_graph\(\)/)
  assert.match(devFullScriptSource, /GRAPHITI_REQUIRED="\$\{GRAPHITI_REQUIRED:-0\}"/)
  assert.match(devFullScriptSource, /graphiti_runtime_state_file="\$\{GRAPHITI_RUNTIME_STATE_PATH:-tmp\/graphiti-runtime-state\.json\}"/)
  assert.match(devFullScriptSource, /redis_cli_args=\("-u" "\$\{FALKORDB_URI\}"\)/)
  assert.match(devFullScriptSource, /redis_cli_args\+=\("--user" "\$\{FALKORDB_USER:-default\}" "--pass" "\$\{FALKORDB_PASSWORD\}"\)/)
  assert.match(devFullScriptSource, /redis-cli "\$\{redis_cli_args\[@\]\}" GRAPH\.QUERY "\$\{FALKORDB_DATABASE\}" "RETURN 1"/)
  assert.match(devFullScriptSource, /ERR unknown command 'GRAPH\.QUERY'/)
  assert.match(devFullScriptSource, /FalkorDB graph module is not available/)
  assert.match(devFullScriptSource, /GRAPHITI_REQUIRED[^\n]*==[^\n]*"1"[\s\S]*return 1/)
  assert.match(devFullScriptSource, /write_graphiti_runtime_state/)
  assert.match(devFullScriptSource, /graphiti_runtime_mode.*degraded/)
  assert.match(devFullScriptSource, /if check_falkordb_graph; then[\s\S]*start_graphiti_mcp[\s\S]*fi/)
  assert.match(devFullScriptSource, /start_backend\nensure_worker_supervisor_running/)
})

test('entity pipeline worker fallback points at the Python backend port, not Graphiti MCP', () => {
  assert.match(entityPipelineWorkerSource, /or "http:\/\/127\.0\.0\.1:8002"/)
  assert.doesNotMatch(entityPipelineWorkerSource, /or "http:\/\/127\.0\.0\.1:8000"/)
})

test('full dev launcher supervises the worker and restarts it after crashes', () => {
  assert.match(devFullScriptSource, /worker_supervisor_pid=/)
  assert.match(devFullScriptSource, /while true; do/)
  assert.match(devFullScriptSource, /worker exited unexpectedly; restarting/)
  assert.match(devFullScriptSource, /sleep 2/)
  assert.match(devFullScriptSource, /wait "\$\{worker_supervisor_pid\}"/)
})

test('full dev launcher resolves npm once and uses the resolved binary for detached restarts', () => {
  assert.match(devFullScriptSource, /resolve_npm_bin\(\)/)
  assert.match(devFullScriptSource, /resolve_node_bin\(\)/)
  assert.match(devFullScriptSource, /command -v npm/)
  assert.match(devFullScriptSource, /command -v node/)
  assert.match(devFullScriptSource, /zsh -lic 'command -v npm/)
  assert.match(devFullScriptSource, /zsh -lic 'command -v node/)
  assert.match(devFullScriptSource, /Unable to locate npm for dev-full\.sh/)
  assert.match(devFullScriptSource, /Unable to locate node for dev-full\.sh/)
  assert.match(devFullScriptSource, /export NPM_BIN/)
  assert.match(devFullScriptSource, /export NODE_BIN/)
  assert.match(devFullScriptSource, /export PATH/)
  assert.match(devFullScriptSource, /PATH="\$\(dirname "\$\{NODE_BIN\}"\)":"\$\(dirname "\$\{NPM_BIN\}"\)"/)
  assert.match(devFullScriptSource, /"\$\{NPM_BIN\}" run backend:dev/)
  assert.match(devFullScriptSource, /"\$\{NPM_BIN\}" run dev:frontend/)
  assert.match(devFullScriptSource, /"\$\{NPM_BIN\}" run worker:entity-pipeline/)
  assert.doesNotMatch(devFullScriptSource, /(^|[^\$"{])npm run backend:dev/m)
  assert.doesNotMatch(devFullScriptSource, /(^|[^\$"{])npm run dev:frontend/m)
  assert.doesNotMatch(devFullScriptSource, /(^|[^\$"{])npm run worker:entity-pipeline/m)
})

test('full dev launcher logs explicit restart failures and clears misleading pid files', () => {
  assert.match(devFullScriptSource, /backend restart failed:/)
  assert.match(devFullScriptSource, /frontend restart failed:/)
  assert.match(devFullScriptSource, /worker restart failed:/)
  assert.match(devFullScriptSource, /rm -f "\$\{backend_pid_file\}"/)
  assert.match(devFullScriptSource, /rm -f "\$\{frontend_pid_file\}"/)
  assert.match(devFullScriptSource, /rm -f "\$\{worker_supervisor_pid_file\}" "\$\{worker_pid_file\}"/)
})

test('direct component startup scripts are guarded behind the full launcher', () => {
  const pkg = JSON.parse(packageSource)

  assert.match(pkg.scripts['backend:dev'], /PANTHER_CHAT_ALLOW_DIRECT_START/)
  assert.match(pkg.scripts['backend:dev:no-llm'], /PANTHER_CHAT_ALLOW_DIRECT_START/)
  assert.match(pkg.scripts['dev:frontend'], /PANTHER_CHAT_ALLOW_DIRECT_START/)
  assert.match(pkg.scripts['worker:entity-pipeline'], /PANTHER_CHAT_ALLOW_DIRECT_START/)
  assert.match(devFullScriptSource, /PANTHER_CHAT_ALLOW_DIRECT_START=1/)
})
