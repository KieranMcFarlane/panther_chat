import { notFound, redirect } from 'next/navigation'

interface EntityProfilePageProps {
  params: {
    entityId: string
  }
  searchParams?: Record<string, string | string[] | undefined>
}

function getSearchParamValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0]
  }

  return value
}

export default function EntityProfilePage({ params, searchParams = {} }: EntityProfilePageProps) {
  const { entityId } = params

  if (!entityId) {
    notFound()
  }

  const nextSearchParams = new URLSearchParams()

  Object.entries(searchParams).forEach(([key, value]) => {
    const resolvedValue = getSearchParamValue(value)
    if (resolvedValue) {
      nextSearchParams.set(key, resolvedValue)
    }
  })

  const nextUrl = `/entity-browser/${entityId}/dossier${nextSearchParams.toString() ? `?${nextSearchParams.toString()}` : ''}`

  redirect(nextUrl)
}
