import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const routeFiles = [
  '../src/app/api/entities/summary/route.ts',
  '../src/app/api/home/metrics/route.ts',
  '../src/app/api/mailbox/get/route.ts',
  '../src/app/api/mailbox/list/route.ts',
  '../src/app/api/temporal/patterns/route.ts',
]

for (const routeFile of routeFiles) {
  test(`${routeFile} is forced dynamic when it reads request.url`, () => {
    const source = readFileSync(new URL(routeFile, import.meta.url), 'utf8')
    assert.match(source, /new URL\(request\.url\)/)
    assert.match(source, /export const dynamic = ['"]force-dynamic['"]/)
  })
}
