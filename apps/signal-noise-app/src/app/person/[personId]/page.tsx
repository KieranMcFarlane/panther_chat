import { notFound, redirect } from 'next/navigation'
import { getEntityForDossierPage } from '@/lib/entity-loader'
import { getEntityBrowserDossierHref } from '@/lib/entity-routing'

interface PersonProfilePageProps {
  params: {
    personId: string
  }
}

export default async function PersonProfilePage({ params }: PersonProfilePageProps) {
  const { personId } = params

  if (!personId) {
    notFound()
  }

  const entityData = await getEntityForDossierPage(personId)
  if (entityData.entity) {
    const href = getEntityBrowserDossierHref(entityData.entity, '1')
    if (href) {
      redirect(href)
    }
  }

  notFound()
}
