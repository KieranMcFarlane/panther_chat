import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const script = readFileSync(new URL('../scripts/smoke-zai-inference.sh', import.meta.url), 'utf8')

test('Z.ai smoke script normalizes Anthropic base URL before appending messages path', () => {
  assert.match(script, /function messagesUrlForBaseUrl/)
  assert.match(script, /endsWith\('\/v1'\)/)
  assert.doesNotMatch(script, /\$\{baseUrl\.replace\(\/\\\\\/\$\/, ''\)\}\/v1\/messages/)
})

test('Z.ai smoke script defaults to current GLM 5.1 model', () => {
  assert.match(script, /'GLM-5\.1'/)
})
