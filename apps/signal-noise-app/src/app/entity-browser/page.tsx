import { Suspense } from "react"

import EntityBrowserClientPage from "./client-page"
import { requirePageSession } from "@/lib/server-auth"

export default async function EntityBrowserPage() {
  await requirePageSession('/entity-browser')

  return (
    <Suspense fallback={null}>
      <EntityBrowserClientPage />
    </Suspense>
  )
}
