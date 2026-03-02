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
    pkg.scripts['backend:dev'],
    'cd ../.. && DISABLE_CLAUDE_API=1 /Library/Frameworks/Python.framework/Versions/3.13/bin/python3 apps/signal-noise-app/backend/main.py'
  )
})

test('package exposes a single-command full dev launcher', () => {
  const pkg = JSON.parse(packageSource)

  assert.equal(
    pkg.scripts['dev:full'],
    'bash scripts/dev-full.sh'
  )
})

test('full dev launcher prewarms the entity snapshot after frontend startup', () => {
  assert.match(devFullScriptSource, /frontend_pid=/)
  assert.match(devFullScriptSource, /wait_for_frontend\(\)/)
  assert.match(devFullScriptSource, /curl -sf http:\/\/127\.0\.0\.1:3005\/api\/health/)
  assert.match(devFullScriptSource, /curl -sf ['"]http:\/\/127\.0\.0\.1:3005\/api\/entities\?page=1&limit=10&entityType=all&sortBy=name&sortOrder=asc['"]/)
  assert.match(devFullScriptSource, /curl -sf ['"]http:\/\/127\.0\.0\.1:3005\/api\/entities\/summary['"]/)
  assert.match(devFullScriptSource, /wait "\$\{frontend_pid\}"/)
})
