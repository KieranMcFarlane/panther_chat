import { Suspense } from 'react'
import { requirePageSession } from '@/lib/server-auth'
import PipelineEntitiesClientPage from './client-page'

export const dynamic = 'force-dynamic'

export default async function PipelineEntitiesPage() {
  await requirePageSession('/pipeline/entities')

  return (
    <Suspense fallback={<div className="flex h-64 items-center justify-center text-fm-light-grey">Loading pipeline entities...</div>}>
      <PipelineEntitiesClientPage />
    </Suspense>
  )
}
