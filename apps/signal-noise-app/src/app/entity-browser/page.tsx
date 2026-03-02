import { Suspense } from "react"

import EntityBrowserClientPage from "./client-page"

export default function EntityBrowserPage() {
  return (
    <Suspense fallback={null}>
      <EntityBrowserClientPage />
    </Suspense>
  )
}
