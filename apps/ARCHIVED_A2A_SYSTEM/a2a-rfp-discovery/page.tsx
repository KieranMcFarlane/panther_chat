import { Metadata } from 'next'
import A2ARFPDiscoveryDashboard from '@/components/a2a-rfp-discovery/A2ARFPDiscoveryDashboard'

export const metadata: Metadata = {
  title: 'A2A RFP Discovery | Signal Noise App',
  description: 'Autonomous RFP opportunity discovery using Agent-to-Agent communication with Neo4j and Supabase',
}

export default function A2ARFPDiscoveryPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <A2ARFPDiscoveryDashboard />
    </div>
  )
}