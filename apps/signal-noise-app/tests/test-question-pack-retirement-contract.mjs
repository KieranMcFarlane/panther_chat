import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

const dossierClientSource = readFileSync(new URL('../src/app/entity-browser/[entityId]/dossier/client-page.tsx', import.meta.url), 'utf8')

test('legacy question-pack debug surface files are retired from the live dossier flow', () => {
  assert.equal(
    existsSync(new URL('../src/components/entity-dossier/EntityQuestionPackRail.tsx', import.meta.url)),
    false,
  )
  assert.equal(
    existsSync(new URL('../src/lib/entity-question-pack.ts', import.meta.url)),
    false,
  )
  assert.equal(
    existsSync(new URL('./test-entity-dossier-question-pack.mjs', import.meta.url)),
    false,
  )
})

test('live dossier shell still explains that raw question packs are secondary', () => {
  assert.match(dossierClientSource, /raw question pack is secondary operator\/debug context/i)
})
