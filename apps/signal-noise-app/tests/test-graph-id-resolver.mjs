import assert from 'node:assert/strict'
import { resolveGraphId } from '../src/lib/graph-id.ts'

assert.equal(resolveGraphId({ neo4j_id: '3356' }), '3356')
assert.equal(resolveGraphId({ graph_id: '  42  ' }), '42')
assert.equal(resolveGraphId({ id: 7 }), '7')
assert.equal(resolveGraphId({}), null)
