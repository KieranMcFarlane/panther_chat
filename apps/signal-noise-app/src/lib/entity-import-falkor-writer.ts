import { FalkorRedisGraphService } from './falkor-redis-graph'
import type { ImportedEntityRow } from './entity-import-schema'

export async function upsertImportedEntityIntoFalkor(row: ImportedEntityRow) {
  const { buildImportedEntityGraphUpsert } = await import('./entity-import-falkor-bridge.ts')
  const payload = buildImportedEntityGraphUpsert(row)
  const falkorGraphService = new FalkorRedisGraphService()
  await falkorGraphService.upsertImportedEntity(payload)
  return payload
}
