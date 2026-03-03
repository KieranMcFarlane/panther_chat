import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const authSource = readFileSync(
  new URL('../src/lib/auth.ts', import.meta.url),
  'utf8'
)

test('better auth keeps the supported memory adapter as the last-resort fallback', () => {
  assert.match(authSource, /import\s+\{\s*memoryAdapter\s*\}\s+from\s+"better-auth\/adapters\/memory"/)
  assert.doesNotMatch(authSource, /return new Map\(\)/)
  assert.match(authSource, /database:\s*memoryAdapter\(\{\}\)/)
  assert.match(authSource, /Database from "better-sqlite3"/)
})

test('better auth honors DATABASE_URL sqlite paths and refuses memory fallback in hosted production', () => {
  assert.match(authSource, /process\.env\.DATABASE_URL/)
  assert.match(authSource, /join\("\/tmp",\s*basename\(configuredPath\)\)/)
  assert.match(authSource, /no durable database available in production/)
})

test('better auth supports postgres-backed storage for hosted production', () => {
  assert.match(authSource, /Kysely/)
  assert.match(authSource, /PostgresDialect/)
  assert.match(authSource, /new Pool/)
  assert.match(authSource, /type:\s*"postgres"/)
  assert.match(authSource, /casing:\s*"snake"/)
})

test('better auth prefers Turso LibSQL storage when configured', () => {
  assert.match(authSource, /LibsqlDatabase/)
  assert.match(authSource, /process\.env\.TURSO_DATABASE_URL/)
  assert.match(authSource, /process\.env\.TURSO_AUTH_TOKEN/)
  assert.match(authSource, /new LibsqlDatabase/)
  assert.match(authSource, /Using Turso\/LibSQL database/)
})
