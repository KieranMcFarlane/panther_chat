import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

const documentPath = new URL('../src/pages/_document.tsx', import.meta.url)
const appPath = new URL('../src/pages/_app.tsx', import.meta.url)
const errorPath = new URL('../src/pages/_error.tsx', import.meta.url)

test('pages compatibility document exists for legacy 404/500 export paths', () => {
  assert.ok(existsSync(documentPath), 'expected src/pages/_document.tsx to exist')
  assert.ok(existsSync(appPath), 'expected src/pages/_app.tsx to exist')
  assert.ok(existsSync(errorPath), 'expected src/pages/_error.tsx to exist')
})

test('pages compatibility document renders Html, Head, Main, and NextScript', () => {
  const source = readFileSync(documentPath, 'utf8')
  assert.match(source, /<Html/)
  assert.match(source, /<Head/)
  assert.match(source, /<Main/)
  assert.match(source, /<NextScript/)
})

test('pages compatibility app delegates directly to the current page component', () => {
  const source = readFileSync(appPath, 'utf8')
  assert.match(source, /Component/)
  assert.match(source, /pageProps/)
})

test('pages compatibility error page provides a stable fallback', () => {
  const source = readFileSync(errorPath, 'utf8')
  assert.match(source, /Something went wrong/)
  assert.match(source, /getInitialProps/)
})
