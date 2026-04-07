import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

const seedFiles = [
  '../backend/data/dossiers/demo/arsenal-football-club_seed_question_first_dossier.json',
  '../backend/data/dossiers/demo/coventry-city_seed_question_first_dossier.json',
  '../backend/data/dossiers/demo/major-league-cricket_seed_question_first_dossier.json',
  '../backend/data/dossiers/demo/zimbabwe-cricket_seed_question_first_dossier.json',
  '../backend/data/dossiers/demo/zimbabwe-handball-federation_seed_question_first_dossier.json',
].map((relativePath) => new URL(relativePath, import.meta.url))

test('client demo seed set includes canonical question-first dossier artifacts', () => {
  for (const seedFile of seedFiles) {
    assert.equal(existsSync(seedFile), true, `${seedFile.pathname} should exist`)
    const payload = JSON.parse(readFileSync(seedFile, 'utf8'))
    assert.equal(typeof payload.entity_id, 'string')
    assert.equal(typeof payload.entity_name, 'string')
    assert.equal(typeof payload.entity_type, 'string')
    assert.equal(typeof payload.question_first, 'object')
    assert.equal(Array.isArray(payload.answers), true)
    assert.equal(Array.isArray(payload.categories), true)
  }
})
