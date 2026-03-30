import assert from 'node:assert/strict'
import { resolveGraphId } from '../src/lib/graph-id.ts'

assert.equal(resolveGraphId({ uuid: 'dbb4b0d7-68e4-49d7-929a-b1a0613454fd' }), 'dbb4b0d7-68e4-49d7-929a-b1a0613454fd')
assert.equal(resolveGraphId({ entity_uuid: 'dbb4b0d7-68e4-49d7-929a-b1a0613454fd' }), 'dbb4b0d7-68e4-49d7-929a-b1a0613454fd')
assert.equal(resolveGraphId({ neo4j_id: '3356' }), '3356')
assert.equal(resolveGraphId({ graph_id: '  42  ' }), '42')
assert.equal(resolveGraphId({ id: 7 }), '7')
assert.equal(resolveGraphId({}), null)
