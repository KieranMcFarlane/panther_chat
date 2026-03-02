'use client'

import dynamic from 'next/dynamic'
import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { CopilotKit } from '@copilotkit/react-core'
import { MessageSquare } from 'lucide-react'

import AppNavigation from '@/components/layout/AppNavigation'
import { UserMenu } from '@/components/auth/UserMenu'
import { SignInLink } from '@/components/auth/SignInLink'
import { SharedCopilotProvider } from '@/contexts/SharedCopilotContext'
import { TemporalIntelligenceTools } from '@/components/temporal/TemporalIntelligenceTools'

const SimpleStreamingChat = dynamic(() => import('@/components/chat/SimpleStreamingChat'), {
  ssr: false,
  loading: () => null
})

const SPORTS_AGENT_CONFIG = {
  name: 'Sports Intelligence Agent',
  description: 'AI agent specializing in sports entity analysis, RFP intelligence, and database operations',
  capabilities: ['database-query', 'web-research', 'data-analysis', 'entity-enrichment'],
  tools: ['neo4j-mcp', 'brightdata', 'file-operations', 'web-search']
}

function AuthMenu() {
  return (
    <>
      <UserMenu />
      <SignInLink />
    </>
  )
}

function CopilotOverlay({ initialChatOpen = false }: { initialChatOpen?: boolean }) {
  return (
    <>
      <TemporalIntelligenceTools />
      <SharedCopilotProvider>
        <SimpleStreamingChat initialOpen={initialChatOpen} />
      </SharedCopilotProvider>
    </>
  )
}

function CopilotProviderShell({ children }: { children: React.ReactNode }) {
  return (
    <CopilotKit
      runtimeUrl="/api/copilotkit"
      publicApiKey={process.env.NEXT_PUBLIC_COPILOTKIT_API_KEY}
      properties={{
        agentConfig: SPORTS_AGENT_CONFIG
      }}
      enableAGUI={true}
      showInspector={process.env.NODE_ENV === 'development'}
    >
      {children}
    </CopilotKit>
  )
}

export default function AppShell({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const isDossierRoute = pathname?.includes('/dossier') ?? false
  const isEntityBrowserRoute = pathname?.startsWith('/entity-browser') ?? false
  const shouldDeferCopilot = isDossierRoute || isEntityBrowserRoute
  const [isDeferredCopilotEnabled, setIsDeferredCopilotEnabled] = useState(false)

  const appContent = <AppNavigation authMenu={<AuthMenu />}>{children}</AppNavigation>

  if (shouldDeferCopilot) {
    return (
      <CopilotProviderShell>
        {appContent}
        {isDeferredCopilotEnabled ? (
          <CopilotOverlay initialChatOpen={true} />
        ) : (
          <button
            type="button"
            aria-label="Open sports intelligence chat"
            onClick={() => setIsDeferredCopilotEnabled(true)}
            className="fixed bottom-6 right-6 bg-blue-600 hover:bg-blue-700 text-white rounded-full p-4 shadow-lg transform hover:scale-105 transition-all duration-200 z-30"
          >
            <MessageSquare className="w-6 h-6" />
          </button>
        )}
      </CopilotProviderShell>
    )
  }

  return (
    <CopilotProviderShell>
      {appContent}
      <CopilotOverlay />
    </CopilotProviderShell>
  )
}
