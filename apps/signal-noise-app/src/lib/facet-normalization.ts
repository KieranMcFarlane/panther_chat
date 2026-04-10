function toNormalizedText(value: unknown): string {
  if (value === null || value === undefined) return ''
  return String(value).trim().replace(/\s+/g, ' ')
}

export function normalizeFacetKey(value: unknown): string {
  return toNormalizedText(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

export function normalizeFacetLabel(value: unknown): string {
  return toNormalizedText(value)
}

export function isPreferredFacetLabel(currentLabel: string, candidateLabel: string): boolean {
  if (!currentLabel) return true
  if (!candidateLabel) return false

  const currentIsLowerCase = currentLabel === currentLabel.toLowerCase()
  const candidateIsLowerCase = candidateLabel === candidateLabel.toLowerCase()
  if (currentIsLowerCase && !candidateIsLowerCase) return true
  if (!currentIsLowerCase && candidateIsLowerCase) return false

  const currentHasAcronym = /[A-Z]{2,}/.test(currentLabel)
  const candidateHasAcronym = /[A-Z]{2,}/.test(candidateLabel)
  if (!currentHasAcronym && candidateHasAcronym) return true
  if (currentHasAcronym && !candidateHasAcronym) return false

  return candidateLabel.length < currentLabel.length
}
