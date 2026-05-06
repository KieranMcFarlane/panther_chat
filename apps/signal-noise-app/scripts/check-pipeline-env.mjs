#!/usr/bin/env node
import { existsSync } from 'node:fs'
import { Pool } from 'pg'
import { config } from 'dotenv'

for (const envFile of ['.env.local', '.env']) {
  if (existsSync(envFile)) {
    config({ path: envFile, override: false, quiet: true })
  }
}

function runtimeLabel() {
  return process.env.VERCEL_ENV || process.env.NODE_ENV || 'local'
}

function redactDatabaseUrl(databaseUrl) {
  try {
    const parsed = new URL(databaseUrl)
    if (parsed.username) parsed.username = '<user>'
    if (parsed.password) parsed.password = '<password>'
    return parsed.toString()
  } catch {
    return '<invalid DATABASE_URL>'
  }
}

function isLocalDatabaseUrl(databaseUrl) {
  if (databaseUrl.includes('host=/tmp')) return true

  try {
    const parsed = new URL(databaseUrl)
    return ['localhost', '127.0.0.1', '::1'].includes(parsed.hostname)
  } catch {
    return false
  }
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL?.trim()

  if (!databaseUrl) {
    console.error(`[env:check:pipeline] DATABASE_URL is required for ${runtimeLabel()} Postgres.`)
    process.exitCode = 1
    return
  }

  const pool = new Pool({
    connectionString: databaseUrl,
    max: 1,
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 10000,
    ssl: databaseUrl.includes('sslmode=require') || !isLocalDatabaseUrl(databaseUrl)
      ? { rejectUnauthorized: false }
      : undefined,
  })

  try {
    const result = await pool.query('select current_database(), current_user, version()')
    const row = result.rows[0] || {}
    console.log(`[env:check:pipeline] Runtime: ${runtimeLabel()}`)
    console.log(`[env:check:pipeline] Database URL: ${redactDatabaseUrl(databaseUrl)}`)
    console.log(`[env:check:pipeline] Connected database: ${row.current_database}`)
    console.log(`[env:check:pipeline] Connected user: ${row.current_user}`)
    console.log(`[env:check:pipeline] Postgres: ${String(row.version || '').split('\n')[0]}`)
  } catch (error) {
    console.error(`[env:check:pipeline] Postgres connection failed for ${runtimeLabel()}: ${error.message}`)
    process.exitCode = 1
  } finally {
    await pool.end().catch(() => {})
  }
}

await main()
