import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const livekitAgentsRouteSource = readFileSync(
  new URL('../src/app/api/livekit/agents/route.ts', import.meta.url),
  'utf8'
)

test('livekit agents route does not depend on jsonwebtoken at build time', () => {
  assert.doesNotMatch(livekitAgentsRouteSource, /require\(['"]jsonwebtoken['"]\)/)
  assert.match(livekitAgentsRouteSource, /from 'jose'|from "jose"/)
  assert.match(livekitAgentsRouteSource, /new SignJWT/)
})
