import test from 'node:test'
import assert from 'node:assert/strict'

test('legacy person route redirects to the browser dossier flow', async () => {
  const response = await fetch('http://localhost:3005/person/mikel-arteta', {
    redirect: 'manual',
  })

  assert.equal(response.status, 307)
  assert.equal(
    response.headers.get('location'),
    '/entity-browser/mikel-arteta/dossier?from=1'
  )
})
