import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const serverAuthSource = readFileSync(new URL('../src/lib/server-auth.ts', import.meta.url), 'utf8')

test('server auth supports a localhost-only development bypass without weakening production', () => {
  assert.match(serverAuthSource, /LOCAL_DEV_AUTH_BYPASS/)
  assert.match(serverAuthSource, /shouldBypassAuthForLocalDev/)
  assert.match(serverAuthSource, /process\.env\.NODE_ENV === "production"/)
  assert.match(serverAuthSource, /process\.env\.VERCEL === "1"/)
  assert.match(serverAuthSource, /localhost/)
  assert.match(serverAuthSource, /127\.0\.0\.1/)
  assert.match(serverAuthSource, /buildLocalDevSession/)
  assert.match(serverAuthSource, /local-dev@signalnoise\.local/)
})
