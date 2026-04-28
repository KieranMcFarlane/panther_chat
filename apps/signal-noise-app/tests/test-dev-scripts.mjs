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

test('full dev launcher supervises the worker and restarts it after crashes', () => {
  assert.match(devFullScriptSource, /worker_supervisor_pid=/)
  assert.match(devFullScriptSource, /while true; do/)
  assert.match(devFullScriptSource, /worker exited unexpectedly; restarting/)
  assert.match(devFullScriptSource, /sleep 2/)
  assert.match(devFullScriptSource, /wait "\$\{worker_supervisor_pid\}"/)
})

test('direct component startup scripts are guarded behind the full launcher', () => {
  const pkg = JSON.parse(packageSource)

  assert.match(pkg.scripts['backend:dev'], /PANTHER_CHAT_ALLOW_DIRECT_START/)
  assert.match(pkg.scripts['backend:dev:no-llm'], /PANTHER_CHAT_ALLOW_DIRECT_START/)
  assert.match(pkg.scripts['dev:frontend'], /PANTHER_CHAT_ALLOW_DIRECT_START/)
  assert.match(pkg.scripts['worker:entity-pipeline'], /PANTHER_CHAT_ALLOW_DIRECT_START/)
  assert.match(devFullScriptSource, /PANTHER_CHAT_ALLOW_DIRECT_START=1/)
})
