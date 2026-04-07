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
const appNavigationSource = readFileSync(
  new URL('../src/components/layout/AppNavigation.tsx', import.meta.url),
  'utf8'
)
const signInFormSource = readFileSync(
  new URL('../src/components/auth/SignInForm.tsx', import.meta.url),
  'utf8'
)
const appShellSource = readFileSync(
  new URL('../src/components/layout/AppShell.tsx', import.meta.url),
  'utf8'
)
const signInPageSource = readFileSync(
  new URL('../src/app/sign-in/page.tsx', import.meta.url),
  'utf8'
)
const backgroundAnimationSource = readFileSync(
  new URL('../src/components/layout/BackgroundAnimation.tsx', import.meta.url),
  'utf8'
)
const mailboxPageSource = readFileSync(
  new URL('../src/app/mailbox/page.tsx', import.meta.url),
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

test('full-screen auth routes bypass the dashboard shell container', () => {
  assert.match(appNavigationSource, /pathname === '\/sign-in'/)
  assert.match(appNavigationSource, /pathname === '\/login'/)
  assert.match(appNavigationSource, /if \(isFullScreenAuthRoute\)/)
})

test('decorative auth background cannot intercept sign-in form clicks', () => {
  assert.match(backgroundAnimationSource, /pointer-events-none/)
  assert.match(backgroundAnimationSource, /bg-custom-bg pointer-events-none fixed inset-0 z-0/)
})

test('sign-in form supports password reset requests from the auth page', () => {
  assert.match(signInFormSource, /request-password-reset/)
  assert.match(signInFormSource, /Forgot your password\?/)
  assert.match(signInFormSource, /setMode\("reset"\)/)
  assert.match(signInFormSource, /mode !== "reset"/)
  assert.match(signInFormSource, /window\.location\.href = redirectTo/)
  assert.doesNotMatch(signInFormSource, /Account created\. Sign in with your new credentials\./)
})

test('auth-backed pages opt out of static prerendering', () => {
  assert.match(signInPageSource, /export const dynamic = ["']force-dynamic["']/)
  assert.match(mailboxPageSource, /export const dynamic = ["']force-dynamic["']/)
})

test('app shell uses a single mounted auth menu branch to avoid hydration mismatch', () => {
  assert.match(appShellSource, /function AuthMenu\(\)/)
  assert.match(appShellSource, /<AppNavigation authMenu=\{<AuthMenu \/>}/)
  assert.doesNotMatch(appShellSource, /<SignInLink \/>/)
})
