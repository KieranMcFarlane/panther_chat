import EntityDossierClientPage from './client-page'
import { getEntityForDossierPage } from '@/lib/entity-loader'
import { getEntityQuestionPack } from '@/lib/entity-question-pack'
import { getEntityGraphEpisodes } from '@/lib/entity-graph-timeline'
import { findDossierByNamePattern, findDossierFile, getDossierTierDirs } from '@/lib/dossier-paths'
import { readFile } from 'fs/promises'
import path from 'path'

interface EntityDossierPageProps {
  params: {
    entityId: string
  }
  searchParams?: Record<string, string | string[] | undefined>
}

function getSearchParamValue(value: string | string[] | undefined, fallback: string) {
  if (Array.isArray(value)) {
    return value[0] ?? fallback
  }

  return value ?? fallback
}

async function loadDossierFallback(entityId: string, tier = 'standard') {
  const normalizedTier = tier.toLowerCase()
  const candidateDirs = Array.from(
    new Set([
      ...getDossierTierDirs(normalizedTier),
      ...getDossierTierDirs('premium'),
      ...getDossierTierDirs('standard'),
    ]),
  )

  for (const tierDir of candidateDirs) {
    const filename = findDossierFile(entityId, tierDir) ?? (await findDossierByNamePattern(entityId, tierDir))
    if (!filename) continue

    const fileContent = await readFile(path.join(tierDir, `${filename}.json`), 'utf-8')
    const dossier = JSON.parse(fileContent)

    return {
      entity: {
        id: dossier.entity_id || entityId,
        neo4j_id: dossier.entity_id || entityId,
        labels: [dossier.entity_type || 'CLUB'],
        properties: {
          name:
            dossier.entity_name ||
            entityId.replace(/-/g, ' ').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
          type: dossier.entity_type || 'CLUB',
          sport: 'Football',
          tier: dossier.tier,
          priority: dossier.priority_score,
          dossier_data: JSON.stringify(dossier),
        },
      },
      dossier,
    }
  }

  return { entity: null, dossier: null }
}

export default async function EntityDossierPage({ params, searchParams = {} }: EntityDossierPageProps) {
  const entityId = params.entityId
  const fromPage = getSearchParamValue(searchParams.from, '1')
  const shouldGenerate = getSearchParamValue(searchParams.generate, 'false') === 'true'
  const includeSignals = getSearchParamValue(searchParams.includeSignals, 'true') !== 'false'
  const includeConnections = getSearchParamValue(searchParams.includeConnections, 'true') !== 'false'
  const deepResearch = getSearchParamValue(searchParams.deepResearch, 'false') === 'true'
  const tier = getSearchParamValue(searchParams.tier, 'standard')

  const entityData = await getEntityForDossierPage(entityId, tier)
  const needsApiFallback = !entityData.entity || !entityData.dossier
  let apiFallback: { entity: any; dossier: any } | null = null

  if (needsApiFallback) {
    try {
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3005'
      const response = await fetch(`${baseUrl}/api/entities/${encodeURIComponent(entityId)}`, {
        cache: 'no-store',
      })

      if (response.ok) {
        const payload = await response.json()
        if (payload?.entity || payload?.dossier) {
          apiFallback = {
            entity: payload.entity ?? null,
            dossier: payload.dossier ?? null,
          }
        }
      }
    } catch (error) {
      console.warn('⚠️ Failed to load dossier page entity API fallback:', error)
    }
  }

  const fallbackData = entityData.entity ? null : await loadDossierFallback(entityId, tier)
  const entity = entityData.entity ?? apiFallback?.entity ?? fallbackData?.entity ?? null
  const dossier = entityData.dossier ?? apiFallback?.dossier ?? fallbackData?.dossier ?? null
  const entityType = entity?.properties?.type || entity?.labels?.[0] || 'Club'
  const questionPack = entity
    ? await getEntityQuestionPack(entityType, entity.properties?.name || entityId, entityId)
    : null
  const graphEpisodes = entity
    ? await getEntityGraphEpisodes(entity.properties?.name || entityId, entityId)
    : []

  return (
    <EntityDossierClientPage
      entityId={entityId}
      fromPage={fromPage}
      shouldGenerate={shouldGenerate}
      includeSignals={includeSignals}
      includeConnections={includeConnections}
      deepResearch={deepResearch}
      initialEntity={entity}
      initialDossier={dossier}
      initialQuestionPack={questionPack}
      initialGraphEpisodes={graphEpisodes}
      initialError={entity ? null : 'Entity not found'}
    />
  )
}
