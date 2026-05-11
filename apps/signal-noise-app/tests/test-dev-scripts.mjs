import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

const packageSource = readFileSync(
  new URL('../package.json', import.meta.url),
  'utf8'
)
const graphitiComposePath = new URL('../docker-compose.graphiti.yml', import.meta.url)
const graphitiComposeSource = existsSync(graphitiComposePath)
  ? readFileSync(graphitiComposePath, 'utf8')
  : ''
const devFullScriptSource = readFileSync(
  new URL('../scripts/dev-full.sh', import.meta.url),
  'utf8'
)
const envExampleSource = readFileSync(
  new URL('../.env.local.example', import.meta.url),
  'utf8'
)
const readmeSource = readFileSync(
  new URL('../docs/README.md', import.meta.url),
  'utf8'
)
const entityPipelineWorkerSource = readFileSync(
  new URL('../backend/entity_pipeline_worker.py', import.meta.url),
  'utf8'
)
const graphitiRequeueScriptPath = new URL('../scripts/requeue-empty-graphiti-dossier-memory.mjs', import.meta.url)
const graphitiRequeueScriptSource = existsSync(graphitiRequeueScriptPath)
  ? readFileSync(graphitiRequeueScriptPath, 'utf8')
  : ''

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

test('package exposes focused local Graphiti FalkorDB runtime commands', () => {
  const pkg = JSON.parse(packageSource)

  assert.equal(pkg.scripts['graphiti:falkordb:up'], 'docker compose -f docker-compose.graphiti.yml up -d falkordb')
  assert.equal(pkg.scripts['graphiti:falkordb:down'], 'docker compose -f docker-compose.graphiti.yml down')
  assert.equal(pkg.scripts['graphiti:falkordb:reset'], 'bash scripts/reset-graphiti-falkordb.sh')
  assert.equal(pkg.scripts['graphiti:runtime:check'], 'node scripts/check-graphiti-runtime.mjs')
  assert.equal(pkg.scripts['graphiti:dossier-memory:requeue-empty-graph'], 'node scripts/requeue-empty-graphiti-dossier-memory.mjs')
})

test('Graphiti dossier memory requeue script repairs false synced rows only when graph is empty', () => {
  assert.equal(existsSync(graphitiRequeueScriptPath), true)
  assert.match(graphitiRequeueScriptSource, /GRAPH\.QUERY/)
  assert.match(graphitiRequeueScriptSource, /GRAPHITI_DOSSIER_GROUP_ID/)
  assert.match(graphitiRequeueScriptSource, /GRAPHITI_GROUP_ID/)
  assert.match(graphitiRequeueScriptSource, /MATCH \(n\) RETURN count\(n\)/)
  assert.match(graphitiRequeueScriptSource, /graphiti_memory_sync_status/)
  assert.match(graphitiRequeueScriptSource, /in \('synced', 'queued'\)/)
  assert.match(graphitiRequeueScriptSource, /needs_requeue/)
  assert.match(graphitiRequeueScriptSource, /graphiti_memory_requeue_reason/)
  assert.match(graphitiRequeueScriptSource, /empty_falkordb_graph/)
  assert.match(graphitiRequeueScriptSource, /--apply/)
  assert.match(graphitiRequeueScriptSource, /--limit/)
  assert.match(graphitiRequeueScriptSource, /--force/)
  assert.match(graphitiRequeueScriptSource, /dry_run/)
  assert.doesNotMatch(graphitiRequeueScriptSource, /delete from graphiti_dossier_ingestions/i)
  assert.doesNotMatch(graphitiRequeueScriptSource, /drop table/i)
})

test('local Graphiti compose runs only FalkorDB with Redis graph protocol and persistent data', () => {
  assert.equal(existsSync(graphitiComposePath), true)
  assert.match(graphitiComposeSource, /falkordb\/falkordb:latest/)
  assert.match(graphitiComposeSource, /"6379:6379"/)
  assert.match(graphitiComposeSource, /"\$\{FALKORDB_BROWSER_PORT:-3006\}:3000"/)
  assert.match(graphitiComposeSource, /graphiti_falkordb_data:\/data/)
  assert.match(graphitiComposeSource, /GRAPH\.QUERY/)
  assert.match(graphitiComposeSource, /sports_intelligence/)
  assert.doesNotMatch(graphitiComposeSource, /backend:/)
  assert.doesNotMatch(graphitiComposeSource, /mcp-app:/)
})

test('full dev launcher prewarms the entity snapshot after frontend startup', () => {
  assert.match(devFullScriptSource, /frontend_pid=/)
  assert.match(devFullScriptSource, /wait_for_frontend\(\)/)
  assert.match(devFullScriptSource, /curl -sf --max-time 2 http:\/\/127\.0\.0\.1:3005\/api\/health/)
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

test('full dev launcher loads local dotenv files before exporting runtime defaults', () => {
  assert.match(devFullScriptSource, /load_local_env\(\)/)
  assert.match(devFullScriptSource, /for env_file in "\.env" "\.env\.local"; do/)
  assert.match(devFullScriptSource, /read -r assignment/)
  assert.match(devFullScriptSource, /export "\$\{assignment\}"/)
  assert.match(devFullScriptSource, /mktemp/)
  assert.match(devFullScriptSource, /line\.split\(["']=["'], 1\)/)
  assert.doesNotMatch(devFullScriptSource, /source "\$\{env_file\}"/)
  assert.ok(
    devFullScriptSource.indexOf('load_local_env\n') < devFullScriptSource.indexOf('export SIGNAL_NOISE_BACKEND_PORT='),
  )
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
  assert.match(devFullScriptSource, /for _ in \$\(seq 1 10\); do/)
  assert.match(devFullScriptSource, /start_graphiti_mcp\(\)/)
  assert.match(devFullScriptSource, /restart_graphiti_mcp\(\)/)
  assert.match(devFullScriptSource, /if wait_for_graphiti_mcp >\/dev\/null 2>&1; then[\s\S]*return 0[\s\S]*fi/)
  assert.match(devFullScriptSource, /recovery supervisor: Graphiti MCP unhealthy; restarting Graphiti MCP/)
  assert.match(devFullScriptSource, /backend\/graphiti_mcp_server_official/)
  assert.match(devFullScriptSource, /uv run python main\.py --transport http --host 0\.0\.0\.0 --port "\$\{GRAPHITI_MCP_PORT\}" --database-provider falkordb/)
  assert.match(devFullScriptSource, /curl -sf --max-time 2 "http:\/\/127\.0\.0\.1:\$\{GRAPHITI_MCP_PORT\}\/health"/)
  assert.match(devFullScriptSource, /curl -sf --max-time 2 http:\/\/127\.0\.0\.1:3005\/api\/health/)
  assert.match(devFullScriptSource, /if check_falkordb_graph; then[\s\S]*if ! start_graphiti_mcp; then[\s\S]*graphiti_mcp_unavailable[\s\S]*fi/)
  assert.match(devFullScriptSource, /Graphiti MCP failed to start; continuing in graphiti_runtime_mode=degraded\./)
})

test('full dev launcher gives Graphiti MCP a provider root Anthropic base URL', () => {
  assert.match(devFullScriptSource, /GRAPHITI_ANTHROPIC_BASE_URL/)
  assert.match(devFullScriptSource, /graphiti_anthropic_base_url="\$\{graphiti_anthropic_base_url%\/v1\}"/)
  assert.match(devFullScriptSource, /ANTHROPIC_BASE_URL="\$\{graphiti_anthropic_base_url\}"/)
  assert.match(devFullScriptSource, /ANTHROPIC_API_URL="\$\{graphiti_anthropic_api_url\}"/)
})

test('full dev launcher routes Graphiti MCP through Z.ai coding-plan credentials', () => {
  assert.match(devFullScriptSource, /graphiti_anthropic_api_key="\$\{GRAPHITI_ANTHROPIC_API_KEY:-\$\{ZAI_API_KEY:-\$\{ANTHROPIC_API_KEY:-\$\{ANTHROPIC_AUTH_TOKEN:-\}\}\}\}"/)
  assert.match(devFullScriptSource, /export ANTHROPIC_API_KEY="\$\{graphiti_anthropic_api_key\}"/)
  assert.match(devFullScriptSource, /export ANTHROPIC_AUTH_TOKEN="\$\{graphiti_anthropic_api_key\}"/)
  assert.match(devFullScriptSource, /export LLM__PROVIDER="\$\{GRAPHITI_LLM_PROVIDER:-\$\{LLM__PROVIDER:-anthropic\}\}"/)
  assert.match(devFullScriptSource, /export LLM__MODEL="\$\{GRAPHITI_LLM_MODEL:-\$\{LLM__MODEL:-GLM-5\.1\}\}"/)
})

test('full dev launcher throttles Graphiti MCP internal extraction concurrency for local Z.ai stability', () => {
  assert.match(devFullScriptSource, /export SEMAPHORE_LIMIT="\$\{GRAPHITI_SEMAPHORE_LIMIT:-\$\{SEMAPHORE_LIMIT:-1\}\}"/)
  assert.match(envExampleSource, /GRAPHITI_SEMAPHORE_LIMIT=1/)
  assert.match(readmeSource, /GRAPHITI_SEMAPHORE_LIMIT=1/)
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
  assert.match(devFullScriptSource, /write_graphiti_runtime_state "ready" ""/)
  assert.match(devFullScriptSource, /graphiti_runtime_mode.*degraded/)
  assert.match(devFullScriptSource, /if check_falkordb_graph; then[\s\S]*if ! start_graphiti_mcp; then[\s\S]*GRAPHITI_REQUIRED[\s\S]*exit 1[\s\S]*fi/)
  assert.match(devFullScriptSource, /start_backend\nensure_worker_supervisor_running/)
})

test('full dev launcher can bootstrap Docker FalkorDB before starting Graphiti MCP', () => {
  assert.match(devFullScriptSource, /graphiti_compose_file="docker-compose\.graphiti\.yml"/)
  assert.match(devFullScriptSource, /start_local_falkordb\(\)/)
  assert.match(devFullScriptSource, /command -v docker/)
  assert.match(devFullScriptSource, /docker compose -f "\$\{graphiti_compose_file\}" up -d falkordb/)
  assert.match(devFullScriptSource, /check_falkordb_graph[\s\S]*start_local_falkordb[\s\S]*check_falkordb_graph/)
  assert.match(devFullScriptSource, /Docker FalkorDB unavailable; continuing in graphiti_runtime_mode=degraded\./)
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

test('full dev launcher avoids duplicate frontend restarts on transient health failures', () => {
  assert.match(devFullScriptSource, /frontend_health_failures=0/)
  assert.match(devFullScriptSource, /frontend_health_failure_threshold=/)
  assert.match(devFullScriptSource, /frontend_health_failures=\$\(\(frontend_health_failures \+ 1\)\)/)
  assert.match(devFullScriptSource, /if \(\( frontend_health_failures >= frontend_health_failure_threshold \)\); then/)
  assert.match(devFullScriptSource, /frontend health recovered after \$\{frontend_health_failures\} failed check/)
  assert.match(devFullScriptSource, /frontend_health_check\(\)/)
  assert.match(devFullScriptSource, /if frontend_health_check; then[\s\S]*return 0[\s\S]*fi/)
})

test('direct component startup scripts are guarded behind the full launcher', () => {
  const pkg = JSON.parse(packageSource)

  assert.match(pkg.scripts['backend:dev'], /PANTHER_CHAT_ALLOW_DIRECT_START/)
  assert.match(pkg.scripts['backend:dev:no-llm'], /PANTHER_CHAT_ALLOW_DIRECT_START/)
  assert.match(pkg.scripts['dev:frontend'], /PANTHER_CHAT_ALLOW_DIRECT_START/)
  assert.match(pkg.scripts['worker:entity-pipeline'], /PANTHER_CHAT_ALLOW_DIRECT_START/)
  assert.match(devFullScriptSource, /PANTHER_CHAT_ALLOW_DIRECT_START=1/)
})
