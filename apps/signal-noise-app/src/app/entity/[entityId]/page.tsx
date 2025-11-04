import { notFound } from 'next/navigation'
import EntityProfileClient from './client-page'

interface EntityProfilePageProps {
  params: {
    entityId: string
  }
}

export default function EntityProfilePage({ params }: EntityProfilePageProps) {
  const { entityId } = params

  if (!entityId) {
    notFound()
  }

  return <EntityProfileClient entityId={entityId} />
}