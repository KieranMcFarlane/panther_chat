import EntityDossierClientPage from './client-page'
import { getEntityForDossierPage } from '@/lib/entity-loader'
import { getEntityBrowserDossierHref } from '@/lib/entity-routing'
import { requirePageSession } from '@/lib/server-auth'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

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
  await requirePageSession(`/entity-browser/${entityId}/dossier`)
  const fromPage = getSearchParamValue(searchParams.from, '1')
  const shouldGenerate = getSearchParamValue(searchParams.generate, 'false') === 'true'
  const includeSignals = getSearchParamValue(searchParams.includeSignals, 'true') !== 'false'
  const includeConnections = getSearchParamValue(searchParams.includeConnections, 'true') !== 'false'
  const deepResearch = getSearchParamValue(searchParams.deepResearch, 'false') === 'true'
  const tier = getSearchParamValue(searchParams.tier, 'standard')

  const entityData = await getEntityForDossierPage(entityId, tier)
  const canonicalHref = entityData.entity ? getEntityBrowserDossierHref(entityData.entity, fromPage) : null

  if (canonicalHref && canonicalHref !== `/entity-browser/${entityId}/dossier?from=${fromPage}`) {
    const query = new URLSearchParams()
    if (searchParams.from !== undefined) query.set('from', fromPage)
    if (searchParams.generate !== undefined) query.set('generate', getSearchParamValue(searchParams.generate, 'false'))
    if (searchParams.includeSignals !== undefined) query.set('includeSignals', getSearchParamValue(searchParams.includeSignals, 'true'))
    if (searchParams.includeConnections !== undefined) query.set('includeConnections', getSearchParamValue(searchParams.includeConnections, 'true'))
    if (searchParams.deepResearch !== undefined) query.set('deepResearch', getSearchParamValue(searchParams.deepResearch, 'false'))
    if (searchParams.tier !== undefined) query.set('tier', tier)

    redirect(query.toString() ? `${canonicalHref.split('?')[0]}?${query.toString()}` : canonicalHref)
  }

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
