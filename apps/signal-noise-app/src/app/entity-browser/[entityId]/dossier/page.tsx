import EntityDossierClientPage from './client-page'
import { getEntityForDossierPage } from '@/lib/entity-loader'

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

export default async function EntityDossierPage({ params, searchParams = {} }: EntityDossierPageProps) {
  const entityId = params.entityId
  const fromPage = getSearchParamValue(searchParams.from, '1')
  const shouldGenerate = getSearchParamValue(searchParams.generate, 'false') === 'true'
  const includeSignals = getSearchParamValue(searchParams.includeSignals, 'true') !== 'false'
  const includeConnections = getSearchParamValue(searchParams.includeConnections, 'true') !== 'false'
  const deepResearch = getSearchParamValue(searchParams.deepResearch, 'false') === 'true'
  const tier = getSearchParamValue(searchParams.tier, 'standard')

  const entityData = await getEntityForDossierPage(entityId, tier)

  return (
    <EntityDossierClientPage
      entityId={entityId}
      fromPage={fromPage}
      shouldGenerate={shouldGenerate}
      includeSignals={includeSignals}
      includeConnections={includeConnections}
      deepResearch={deepResearch}
      initialEntity={entityData.entity}
      initialDossier={entityData.dossier}
      initialError={entityData.entity ? null : 'Entity not found'}
    />
  )
}
