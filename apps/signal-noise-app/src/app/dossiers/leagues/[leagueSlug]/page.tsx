import { notFound } from 'next/navigation'
import LeagueDossierClient from './client-page'

interface LeagueDossierPageProps {
  params: {
    leagueSlug: string
  }
}

export default function LeagueDossierPage({ params }: LeagueDossierPageProps) {
  const { leagueSlug } = params

  if (!leagueSlug) {
    notFound()
  }

  return <LeagueDossierClient leagueSlug={leagueSlug} />
}