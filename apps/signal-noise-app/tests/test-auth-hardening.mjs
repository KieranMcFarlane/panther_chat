import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

const authSource = readFileSync(
  new URL('../src/lib/auth.ts', import.meta.url),
  'utf8'
)

const mailboxSendRouteSource = readFileSync(
  new URL('../src/app/api/mailbox/send/route.ts', import.meta.url),
  'utf8'
)
const authRouteSource = readFileSync(
  new URL('../src/app/api/auth/[[...all]]/route.ts', import.meta.url),
  'utf8'
)
const authClientSource = readFileSync(
  new URL('../src/lib/auth-client.ts', import.meta.url),
  'utf8'
)
const packageSource = readFileSync(
  new URL('../package.json', import.meta.url),
  'utf8'
)

test('better auth uses a durable sqlite fallback before in-memory storage', () => {
  assert.match(authSource, /import Database from "better-sqlite3"/)
  assert.match(authSource, /mkdirSync/)
  assert.match(authSource, /"\.data"/)
  assert.match(authSource, /"better-auth\.db"/)
  assert.match(authSource, /auth\.\$context/)
  assert.match(authSource, /runMigrations\(\)/)
  assert.doesNotMatch(authSource, /Using in-memory adapter \(development mode\)/)
})

test('better auth delegates verification and reset emails to a shared auth email helper', () => {
  assert.match(authSource, /sendAuthVerificationEmail/)
  assert.match(authSource, /sendAuthResetPasswordEmail/)
  assert.doesNotMatch(
    authSource,
    /console\.log\("Verification email sent to:"/
  )
  assert.doesNotMatch(
    authSource,
    /console\.log\("Password reset email sent to:"/
  )
})

test('mailbox send API enforces an authenticated server session', () => {
  assert.match(mailboxSendRouteSource, /requireApiSession/)
  assert.match(mailboxSendRouteSource, /await requireApiSession\(request\)/)
})

test('better auth dash support is installed and configured', () => {
  assert.equal(
    existsSync(new URL('../src/app/api/auth/[[...all]]/route.ts', import.meta.url)),
    true
  )
  assert.match(packageSource, /"@better-auth\/infra"/)
  assert.match(authSource, /import \{ dash \} from "@better-auth\/infra"/)
  assert.match(authSource, /plugins:\s*\[/)
  assert.match(authSource, /dash\(\{/)
  assert.match(authSource, /replace\(\/\\\/\+\$\/,\s*""\)/)
  assert.match(authRouteSource, /pathname\.endsWith\("\/api\/auth"\)/)
  assert.match(authRouteSource, /Response\.json\(/)
  assert.match(authClientSource, /import \{ sentinelClient \} from "@better-auth\/infra\/client"/)
  assert.match(authClientSource, /plugins:\s*\[/)
  assert.match(authClientSource, /sentinelClient\(\)/)
})

test('auth client falls back to the browser origin when a localhost auth URL leaks into production', () => {
  assert.match(authClientSource, /window\.location\.origin/)
  assert.match(authClientSource, /isLocalhostUrl/)
  assert.match(authClientSource, /resolveAuthBaseUrl/)
})
