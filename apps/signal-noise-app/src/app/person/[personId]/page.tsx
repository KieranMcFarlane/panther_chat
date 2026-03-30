import { notFound, redirect } from 'next/navigation'

interface PersonProfilePageProps {
  params: {
    personId: string
  }
}

export default function PersonProfilePage({ params }: PersonProfilePageProps) {
  const { personId } = params

  if (!personId) {
    notFound()
  }

  redirect(`/entity-browser/${personId}/dossier?from=1`)
}
