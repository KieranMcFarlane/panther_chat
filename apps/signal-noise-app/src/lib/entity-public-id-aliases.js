const ENTITY_UUID_ALIASES = Object.freeze({
  '7014d188-d031-5d67-a1cb-eadd127f9b67': 'b61e07d3-b0e5-4d5c-908e-064de77eb955',
  'b11d37c8-ece8-56d2-aa6e-757d0b8add7b': 'b61e07d3-b0e5-4d5c-908e-064de77eb955',
  'e8b85146-a231-5fe7-88ab-0067f2d437a5': 'b61e07d3-b0e5-4d5c-908e-064de77eb955',
  'd04fd63d-b427-4278-82ba-63ae25a7139d': 'b61e07d3-b0e5-4d5c-908e-064de77eb955',
  'dca9d675-1d91-4a19-8ae6-04ed0df624cd': 'b61e07d3-b0e5-4d5c-908e-064de77eb955',
})

function toText(value) {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

function resolveCanonicalEntityUuidAlias(value) {
  const text = toText(value)
  if (!text) return null

  return ENTITY_UUID_ALIASES[text.toLowerCase()] || null
}

module.exports = {
  ENTITY_UUID_ALIASES,
  resolveCanonicalEntityUuidAlias,
}
