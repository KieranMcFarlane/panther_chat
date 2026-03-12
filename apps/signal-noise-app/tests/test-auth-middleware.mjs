import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const middlewarePath = new URL('../src/middleware.ts', import.meta.url)
const middlewareSource = readFileSync(middlewarePath, 'utf8')

test('auth middleware keeps auth, health, and sign-in routes public', () => {
  assert.match(middlewareSource, /['"]\/sign-in['"]/)
  assert.match(middlewareSource, /['"]\/login['"]/)
  assert.match(middlewareSource, /['"]\/api\/auth['"]/)
  assert.match(middlewareSource, /['"]\/api\/health['"]/)
})

test('auth middleware redirects unauthenticated protected requests to sign-in with redirect target', () => {
  assert.match(middlewareSource, /new URL\(['"]\/sign-in['"], request\.url\)/)
  assert.match(middlewareSource, /searchParams\.set\(['"]redirect['"]/)
  assert.match(middlewareSource, /NextResponse\.redirect/)
})

test('auth middleware bypasses auth on localhost during local development', () => {
  assert.match(middlewareSource, /hostname/)
  assert.match(middlewareSource, /localhost/)
  assert.match(middlewareSource, /127\.0\.0\.1/)
  assert.match(middlewareSource, /0\.0\.0\.0/)
  assert.match(middlewareSource, /isLocalDevelopmentHost\(request\)/)
  assert.match(middlewareSource, /NextResponse\.next\(\)/)
})

test('auth middleware matcher skips next internals and static assets', () => {
  assert.match(middlewareSource, /_next\/static/)
  assert.match(middlewareSource, /_next\/image/)
  assert.match(middlewareSource, /favicon\.ico/)
})
