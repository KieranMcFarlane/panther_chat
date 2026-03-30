import type { ImportedEntityRow } from './entity-import-schema'
import { resolveEntityUuid } from './entity-public-id'

export interface ImportedEntityGraphUpsert {
  entityId: string
  labels: string[]
  properties: Record<string, unknown>
}

function labelsForEntityType(entityType: string): string[] {
  switch (String(entityType || '').toUpperCase()) {
    case 'CLUB':
      return ['Entity', 'Club']
    case 'LEAGUE':
      return ['Entity', 'League']
    case 'FEDERATION':
      return ['Entity', 'Federation']
    case 'VENUE':
      return ['Entity', 'Venue']
    case 'PERSON':
      return ['Entity', 'Person']
    default:
      return ['Entity', 'Organization']
  }
}

export function buildImportedEntityGraphUpsert(row: ImportedEntityRow): ImportedEntityGraphUpsert {
  const uuid = resolveEntityUuid({
    id: row.entity_id,
    neo4j_id: row.entity_id,
    supabase_id: row.external_id ?? undefined,
    properties: {
      name: row.name,
      type: row.entity_type,
      sport: row.sport,
      country: row.country,
    },
  }) || row.entity_id

  return {
    entityId: row.entity_id,
    labels: labelsForEntityType(row.entity_type),
    properties: {
      uuid,
      neo4j_id: row.entity_id,
      id: row.entity_id,
      name: row.name,
      display_name: row.name,
      type: row.entity_type,
      sport: row.sport,
      country: row.country,
      source: row.source,
      external_id: row.external_id ?? null,
      website: row.website ?? null,
      league: row.league ?? null,
      founded_year: row.founded_year ?? null,
      headquarters: row.headquarters ?? null,
      stadium_name: row.stadium_name ?? null,
      capacity: row.capacity ?? null,
      description: row.description ?? null,
      priority_score: row.priority_score,
      badge_url: row.badge_url ?? null,
      imported_from: 'csv_import',
      import_batch_source: 'supabase_import',
      imported_at: new Date().toISOString(),
      normalized_name: row.name.toLowerCase().trim(),
      aliases: [row.external_id, row.website].filter(Boolean),
    },
  }
}
