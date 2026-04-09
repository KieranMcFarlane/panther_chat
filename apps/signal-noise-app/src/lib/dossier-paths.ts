import { existsSync, readdirSync } from 'fs'
import path from 'path'

export function getDossierRoots() {
  const cwd = process.cwd()
  return [
    path.join(cwd, '..', '..', '..', '..', 'apps', 'signal-noise-app', 'backend', 'data', 'dossiers'),
    path.join(cwd, '..', '..', '..', '..', 'apps', 'signal-noise-app', 'tmp', 'question-first-diagnostics'),
    path.join(cwd, 'apps', 'signal-noise-app', 'backend', 'data', 'dossiers'),
    path.join(cwd, 'apps', 'signal-noise-app', 'tmp', 'question-first-diagnostics'),
    path.join(cwd, 'backend', 'data', 'dossiers'),
    path.join(cwd, 'tmp', 'question-first-diagnostics'),
    path.join(cwd, '..', 'backend', 'data', 'dossiers'),
    path.join(cwd, '..', 'tmp', 'question-first-diagnostics'),
    path.join(cwd, '..', '..', 'backend', 'data', 'dossiers'),
    path.join(cwd, '..', '..', 'tmp', 'question-first-diagnostics'),
  ].filter((dir) => existsSync(dir))
}

export function getDossierTierDirs(tier: string) {
  return getDossierRoots()
    .map((root) => path.join(root, tier.toLowerCase()))
    .filter((dir) => existsSync(dir))
}

export function findDossierFile(entityId: string, tierDir: string): string | null {
  const decodedEntityId = decodeURIComponent(entityId)
  const exactMatch = path.join(tierDir, `${decodedEntityId}.json`)
  if (existsSync(exactMatch)) {
    return decodedEntityId
  }

  for (const file of readdirSync(tierDir)) {
    if (!file.endsWith('.json')) continue
    const filename = file.replace(/\.json$/, '')
    if (filename.endsWith(decodedEntityId) || filename.endsWith(entityId)) {
      return filename
    }
  }

  return null
}

export async function findDossierByNamePattern(entityName: string, tierDir: string): Promise<string | null> {
  const normalizedName = entityName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .replace(/\s+/g, '_')

  const patterns = [
    normalizedName,
    `${normalizedName}_fc`,
    normalizedName.replace('_', '-'),
    `${normalizedName}-fc`,
  ]

  for (const file of readdirSync(tierDir)) {
    if (!file.endsWith('.json')) continue

    const filename = file.replace('.json', '').toLowerCase()
    for (const pattern of patterns) {
      if (filename === pattern || filename.endsWith(pattern)) {
        return file.replace('.json', '')
      }
    }
  }

  return null
}
