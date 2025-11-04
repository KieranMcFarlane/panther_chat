import { Metadata } from 'next'
import MCPEnabledA2ADashboard from '@/components/a2a-rfp-discovery/MCPEnabledA2ADashboard'

export const metadata: Metadata = {
  title: 'MCP-Enabled A2A Discovery | Signal Noise App',
  description: 'Autonomous RFP discovery using Claude Agent SDK with MCP tools integration',
}

export default function MCPEnabledA2APage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <MCPEnabledA2ADashboard />
    </div>
  )
}