import { Suspense } from 'react'

import DiscoveryWorkspace from '@/components/discovery/DiscoveryWorkspace'

export default function ControlCenterPage() {
  return (
    <Suspense fallback={null}>
      <DiscoveryWorkspace />
    </Suspense>
  )
}
