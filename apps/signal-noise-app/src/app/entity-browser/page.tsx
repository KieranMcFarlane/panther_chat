import { Suspense } from "react"

import EntityBrowserClientPage from "./client-page"
import { getEntityBrowserSmokeItems } from "@/lib/entity-smoke-set"
import { requirePageSession } from "@/lib/server-auth"

export const dynamic = 'force-dynamic'

export default async function EntityBrowserPage() {
  await requirePageSession('/entity-browser')
  const smokeItems = await getEntityBrowserSmokeItems()

  return (
    <Suspense fallback={null}>
      <EntityBrowserClientPage smokeItems={smokeItems} />
    </Suspense>
  )
}
