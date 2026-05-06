import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'

const pgClientPath = new URL('../src/lib/pg-client.ts', import.meta.url)
const envCheckPath = new URL('../scripts/check-pipeline-env.mjs', import.meta.url)
const envExamplePath = new URL('../env.example', import.meta.url)
const envLocalExamplePath = new URL('../.env.local.example', import.meta.url)

test('pg client requires DATABASE_URL in Vercel and production-like runtimes', () => {
  const source = readFileSync(pgClientPath, 'utf8')

  assert.match(source, /getDatabaseUrl/)
  assert.match(source, /DATABASE_URL is required/)
  assert.doesNotMatch(source, /N[E]ON_DB_URL/)
  assert.match(source, /process\.env\.VERCEL/)
  assert.match(source, /process\.env\.VERCEL_ENV/)
  assert.match(source, /process\.env\.NODE_ENV === 'production'/)
  assert.doesNotMatch(source, /process\.env\.DATABASE_URL\s*\|\|\s*`postgresql:\/\/\/signal_noise_app\?host=\/tmp`/)
})

test('pg client enables SSL for non-local Postgres URLs and keeps local Unix socket fallback dev-only', () => {
  const source = readFileSync(pgClientPath, 'utf8')

  assert.match(source, /shouldUseSsl/)
  assert.match(source, /sslmode=require/)
  assert.doesNotMatch(source, /\.n[e]on\.tech/)
  assert.match(source, /rejectUnauthorized:\s*false/)
  assert.match(source, /postgresql:\/\/\/signal_noise_app\?host=\/tmp/)
})

test('pg client exposes a serverless-friendly PG_POOL_MAX override', () => {
  const source = readFileSync(pgClientPath, 'utf8')

  assert.match(source, /PG_POOL_MAX/)
  assert.match(source, /getPoolMax/)
  assert.match(source, /process\.env\.VERCEL/)
  assert.match(source, /max:\s*getPoolMax\(\)/)
})

test('pipeline env check script validates DATABASE_URL without printing credentials', () => {
  assert.equal(existsSync(envCheckPath), true)
  const source = readFileSync(envCheckPath, 'utf8')

  assert.match(source, /DATABASE_URL/)
  assert.doesNotMatch(source, /N[E]ON_DB_URL/)
  assert.match(source, /current_database\(\),\s*current_user,\s*version\(\)/)
  assert.match(source, /redactDatabaseUrl/)
  assert.match(source, /isLocalDatabaseUrl/)
  assert.match(source, /process\.env\.VERCEL_ENV/)
  assert.match(source, /process\.env\.NODE_ENV/)
  assert.doesNotMatch(source, /console\.log\([^)]*process\.env\.DATABASE_URL/)
})

test('env templates document Postgres DATABASE_URL values as server-only', () => {
  const envExample = readFileSync(envExamplePath, 'utf8')
  const envLocalExample = readFileSync(envLocalExamplePath, 'utf8')

  for (const source of [envExample, envLocalExample]) {
    assert.match(source, /DATABASE_URL=/)
    assert.match(source, /DATABASE_URL_UNPOOLED=/)
    assert.match(source, /PG_POOL_MAX=/)
    assert.match(source, /server-only/i)
    assert.doesNotMatch(source, /N[E]ON_DB_URL/)
    assert.doesNotMatch(source, /n[e]on\.tech/)
    assert.doesNotMatch(source, /NEXT_PUBLIC_DATABASE_URL/)
    assert.doesNotMatch(source, /NEXT_PUBLIC_DATABASE_URL_UNPOOLED/)
  }
})
