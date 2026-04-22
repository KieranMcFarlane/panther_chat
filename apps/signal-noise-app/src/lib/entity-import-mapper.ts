import type { ImportedEntityRow } from '@/lib/entity-import-schema'
import { resolveEntityUuid } from '@/lib/entity-public-id'

function labelsForEntityType(entityType: string): string[] {
  switch (entityType) {
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

/** Map an imported row to a canonical_entities upsert payload */
export function mapImportedEntityRowToCanonicalEntity(row: ImportedEntityRow) {
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
    id: uuid,
    name: row.name,
    entity_type: row.entity_type,
    sport: row.sport || null,
    country: row.country || null,
    league: row.league || null,
    labels: labelsForEntityType(row.entity_type),
    badge_s3_url: row.badge_url ?? null,
    priority_score: row.priority_score,
    entity_category: row.entity_type,
    source_neo4j_ids: [row.entity_id],
    properties: {
      uuid,
      name: row.name,
      type: row.entity_type,
      sport: row.sport,
      country: row.country,
      source: row.source,
      external_id: row.external_id ?? null,
      website: row.website ?? null,
      level: row.league ?? null,
      founded: row.founded_year ?? null,
      headquarters: row.headquarters ?? null,
      stadium: row.stadium_name ?? null,
      capacity: row.capacity ?? null,
      description: row.description ?? null,
      imported_at: new Date().toISOString(),
      priority_score: row.priority_score,
    },
  }
}

/** @deprecated Use mapImportedEntityRowToCanonicalEntity instead */
export function mapImportedEntityRowToCachedEntity(row: ImportedEntityRow) {
  const canonical = mapImportedEntityRowToCanonicalEntity(row)
  return {
    uuid: canonical.id,
    neo4j_id: row.entity_id,
    labels: canonical.labels,
    badge_s3_url: canonical.badge_s3_url,
    priority_score: canonical.priority_score,
    entity_category: canonical.entity_category,
    properties: canonical.properties,
  }
}
