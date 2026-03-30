import assert from 'node:assert/strict'
import { resolveEntityUuid } from '../src/lib/entity-public-id.ts'

const first = resolveEntityUuid({ id: '3356', neo4j_id: '3356', supabase_id: 'zimbabwe_handball_3356' })
const second = resolveEntityUuid({ id: '3356', neo4j_id: '3356', supabase_id: 'zimbabwe_handball_3356' })

assert.equal(first, second, 'public entity ids should be deterministic')
assert.match(String(first), /^[0-9a-f-]{36}$/i, 'public entity ids should be uuid-shaped')
assert.equal(resolveEntityUuid({ uuid: '2f7f4d5b-1d9e-4cb3-8b1d-8dd7d1f4ab50' }), '2f7f4d5b-1d9e-4cb3-8b1d-8dd7d1f4ab50')

