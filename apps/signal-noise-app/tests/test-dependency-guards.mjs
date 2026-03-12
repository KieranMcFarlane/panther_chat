import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const packageJsonPath = new URL('../package.json', import.meta.url)
const livekitRoutePath = new URL('../src/app/api/livekit/agents/route.ts', import.meta.url)

const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'))
const livekitRouteSource = readFileSync(livekitRoutePath, 'utf8')

test('livekit agents route declares jsonwebtoken when it requires it', () => {
  assert.match(livekitRouteSource, /require\(['"]jsonwebtoken['"]\)/)
  assert.ok(
    packageJson.dependencies?.jsonwebtoken,
    'jsonwebtoken must be declared in package.json dependencies when the LiveKit route requires it'
  )
})

test('better-auth dependency set satisfies its sqlite peer requirement', () => {
  assert.equal(
    packageJson.dependencies?.['better-sqlite3'],
    '^12.0.0',
    'better-auth@1.4.19 expects better-sqlite3@^12.0.0'
  )
})
