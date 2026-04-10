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
  const bytes = new Uint8Array(16)
  for (let index = 0; index < hex.length; index += 2) {
    bytes[index / 2] = Number.parseInt(hex.slice(index, index + 2), 16)
  }
  return bytes
}

function bytesToUuid(buffer) {
  const hex = Array.from(buffer, (byte) => byte.toString(16).padStart(2, '0')).join('')
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join('-')
}

function textToBytes(value) {
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(String(value))
  }

  return Uint8Array.from(Buffer.from(String(value), 'utf8'))
}

function sha1Bytes(messageBytes) {
  const bytes = messageBytes instanceof Uint8Array ? messageBytes : textToBytes(messageBytes)
  const messageLength = bytes.length
  const wordLength = (((messageLength + 8) >> 6) << 4) + 16
  const words = new Uint32Array(wordLength)

  for (let index = 0; index < messageLength; index += 1) {
    words[index >> 2] |= bytes[index] << (24 - ((index % 4) * 8))
  }

  words[messageLength >> 2] |= 0x80 << (24 - ((messageLength % 4) * 8))
  words[wordLength - 1] = messageLength * 8

  let h0 = 0x67452301
  let h1 = 0xefcdab89
  let h2 = 0x98badcfe
  let h3 = 0x10325476
  let h4 = 0xc3d2e1f0

  const w = new Uint32Array(80)

  for (let offset = 0; offset < wordLength; offset += 16) {
    for (let index = 0; index < 16; index += 1) {
      w[index] = words[offset + index] >>> 0
    }

    for (let index = 16; index < 80; index += 1) {
      const value = w[index - 3] ^ w[index - 8] ^ w[index - 14] ^ w[index - 16]
      w[index] = (value << 1) | (value >>> 31)
    }

    let a = h0
    let b = h1
    let c = h2
    let d = h3
    let e = h4

    for (let index = 0; index < 80; index += 1) {
      let f = 0
      let k = 0

      if (index < 20) {
        f = (b & c) | (~b & d)
        k = 0x5a827999
      } else if (index < 40) {
        f = b ^ c ^ d
        k = 0x6ed9eba1
      } else if (index < 60) {
        f = (b & c) | (b & d) | (c & d)
        k = 0x8f1bbcdc
      } else {
        f = b ^ c ^ d
        k = 0xca62c1d6
      }

      const temp = (((a << 5) | (a >>> 27)) + f + e + k + (w[index] >>> 0)) >>> 0
      e = d
      d = c
      c = (b << 30) | (b >>> 2)
      b = a
      a = temp
    }

    h0 = (h0 + a) >>> 0
    h1 = (h1 + b) >>> 0
    h2 = (h2 + c) >>> 0
    h3 = (h3 + d) >>> 0
    h4 = (h4 + e) >>> 0
  }

  const digest = new Uint8Array(20)
  const wordsOut = [h0, h1, h2, h3, h4]
  for (let index = 0; index < wordsOut.length; index += 1) {
    const value = wordsOut[index]
    digest[index * 4] = (value >>> 24) & 0xff
    digest[index * 4 + 1] = (value >>> 16) & 0xff
    digest[index * 4 + 2] = (value >>> 8) & 0xff
    digest[index * 4 + 3] = value & 0xff
  }

  return digest
}

function uuidv5FromSeed(seed, namespaceUuid) {
  const namespaceBytes = uuidToBytes(namespaceUuid)
  const nameBytes = textToBytes(seed)
  const combinedBytes = new Uint8Array(namespaceBytes.length + nameBytes.length)
  combinedBytes.set(namespaceBytes, 0)
  combinedBytes.set(nameBytes, namespaceBytes.length)
  const hash = sha1Bytes(combinedBytes)
  const bytes = hash.slice(0, 16)

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
