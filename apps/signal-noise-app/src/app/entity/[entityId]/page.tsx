import { notFound, redirect } from 'next/navigation'

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

  redirect(`/entity-browser/${entityId}/dossier?from=1`)
}
