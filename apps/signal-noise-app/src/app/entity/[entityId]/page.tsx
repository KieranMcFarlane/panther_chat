import { notFound, redirect } from 'next/navigation'
import { getEntityForDossierPage } from '@/lib/entity-loader'
import { getEntityBrowserDossierHref } from '@/lib/entity-routing'

interface EntityProfilePageProps {
  params: {
    entityId: string
  }
}

export default async function EntityProfilePage({ params }: EntityProfilePageProps) {
  const { entityId } = params

  if (!entityId) {
    notFound()
  }

  const entityData = await getEntityForDossierPage(entityId)
  if (entityData.entity) {
    const href = getEntityBrowserDossierHref(entityData.entity, '1')
    if (href) {
      redirect(href)
    }
  }

  notFound()
}
