const crypto = require('node:crypto')

const ENTITY_PUBLIC_ID_NAMESPACE = 'f5c2b2b8-9cf2-4e66-a1c2-38cde7bc3f4e'
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function toValidId(value) {
  if (value === null || value === undefined) return null
  const text = String(value).trim()
  if (!text || text === 'undefined' || text === 'null') return null
  return text
}

function looksLikeUuid(value) {
  const text = toValidId(value)
  return Boolean(text && UUID_PATTERN.test(text))
}

function uuidToBytes(uuid) {
  const hex = String(uuid).replace(/-/g, '')
  const bytes = []
  for (let index = 0; index < hex.length; index += 2) {
    bytes.push(Number.parseInt(hex.slice(index, index + 2), 16))
  }
  return Buffer.from(bytes)
}

function bytesToUuid(buffer) {
  const hex = Buffer.from(buffer).toString('hex')
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join('-')
}

function uuidv5FromSeed(seed, namespaceUuid) {
  const namespaceBytes = uuidToBytes(namespaceUuid)
  const nameBytes = Buffer.from(String(seed), 'utf8')
  const hash = crypto.createHash('sha1').update(namespaceBytes).update(nameBytes).digest()
  const bytes = Buffer.from(hash.slice(0, 16))

  bytes[6] = (bytes[6] & 0x0f) | 0x50
  bytes[8] = (bytes[8] & 0x3f) | 0x80

  return bytesToUuid(bytes)
}

function resolveCanonicalDossierId(entity) {
  if (!entity) return null

  if (typeof entity === 'string') {
    const text = toValidId(entity)
    if (!text) return null
    if (looksLikeUuid(text)) return text
    return uuidv5FromSeed(text, ENTITY_PUBLIC_ID_NAMESPACE)
  }

  const candidateValues = [
    entity.uuid,
    entity.entity_uuid,
    entity.properties?.uuid,
    entity.properties?.entity_uuid,
    entity.supabase_id,
    entity.properties?.supabase_id,
    entity.graph_id,
    entity.neo4j_id,
    entity.id,
  ]

  for (const candidate of candidateValues) {
    const text = toValidId(candidate)
    if (looksLikeUuid(text)) return text
  }

  const seed =
    toValidId(entity.uuid) ||
    toValidId(entity.entity_uuid) ||
    toValidId(entity.properties?.uuid) ||
    toValidId(entity.properties?.entity_uuid) ||
    toValidId(entity.supabase_id) ||
    toValidId(entity.properties?.supabase_id) ||
    toValidId(entity.graph_id) ||
    toValidId(entity.neo4j_id) ||
    toValidId(entity.id) ||
    toValidId(entity.properties?.name) ||
    toValidId(entity.properties?.type) ||
    'entity'

  return uuidv5FromSeed(seed, ENTITY_PUBLIC_ID_NAMESPACE)
}

function getEntityPrefetchId(entity) {
  return resolveCanonicalDossierId(entity)
}

function getEntityBrowserDossierHref(entity, currentPage = '1') {
  const entityId = resolveCanonicalDossierId(entity)
  if (!entityId) return null

  const page = currentPage || '1'
  return `/entity-browser/${entityId}/dossier?from=${page}`
}

function resolveCanonicalEntityBrowserDossierId(entity) {
  return resolveCanonicalDossierId(entity)
}

module.exports = {
  getEntityPrefetchId,
  getEntityBrowserDossierHref,
  resolveCanonicalEntityBrowserDossierId,
}
