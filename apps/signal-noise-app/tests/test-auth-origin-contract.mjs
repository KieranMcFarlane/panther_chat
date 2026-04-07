import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const authSource = readFileSync(new URL('../src/lib/auth.ts', import.meta.url), 'utf8')
const signInFormSource = readFileSync(new URL('../src/components/auth/SignInForm.tsx', import.meta.url), 'utf8')

test('better auth trusts both localhost and 127.0.0.1 origins for local browser auth flows', () => {
  assert.match(authSource, /http:\/\/localhost:3005/)
  assert.match(authSource, /http:\/\/127\.0\.0\.1:3005/)
})

test('sign in form redirects back to the requested protected route after auth', () => {
  assert.match(signInFormSource, /redirect/)
  assert.doesNotMatch(signInFormSource, /window\.location\.href = "\/"/)
})
