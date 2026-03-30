import assert from 'node:assert/strict'

const response = await fetch('http://localhost:3005/api/entities?page=1&limit=1&entityType=all&sortBy=popular&sortOrder=desc')
assert.equal(response.status, 200)

const payload = await response.json()
const entity = payload.entities?.[0]

assert.ok(entity, 'expected at least one entity from the browser API')
assert.equal(typeof entity.uuid, 'string', 'entity browser API should expose a public uuid')
assert.match(entity.uuid, /^[0-9a-f-]{36}$/i, 'entity browser uuid should be uuid-shaped')
assert.equal(entity.id, entity.uuid, 'entity browser API should surface uuid as the public id')
assert.notEqual(entity.uuid, entity.neo4j_id, 'uuid should be distinct from the internal graph id')

const searchResponse = await fetch('http://localhost:3005/api/entities/search?search=Arsenal&limit=1&mode=browse')
assert.equal(searchResponse.status, 200)

const searchPayload = await searchResponse.json()
const searchEntity = searchPayload.entities?.[0]

assert.ok(searchEntity, 'expected at least one search result from the browser API')
assert.equal(typeof searchEntity.uuid, 'string', 'entity search API should expose a public uuid')
assert.equal(searchEntity.id, searchEntity.uuid, 'entity search API should surface uuid as the public id')
