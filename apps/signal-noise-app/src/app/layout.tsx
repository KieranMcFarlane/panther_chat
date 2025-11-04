import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import AppNavigation from '@/components/layout/AppNavigation'
import BackgroundAnimation from '@/components/layout/BackgroundAnimation'
import SWRProvider from '@/components/providers/SWRProvider'
import { UserProvider } from '@/contexts/UserContext'
import { TabProvider } from '@/contexts/TabContext'
import { ThreadProvider } from '@/contexts/ThreadContext'
import { SharedCopilotProvider } from '@/contexts/SharedCopilotContext'
import { CopilotKit } from "@copilotkit/react-core"
import "@copilotkit/react-ui/styles.css"
import dynamic from 'next/dynamic'

const SimpleStreamingChat = dynamic(() => import('@/components/chat/SimpleStreamingChat'), {
  ssr: false,
  loading: () => null
})
// import { ClubNavigationProvider } from '@/contexts/ClubNavigationContext'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Signal Noise App - AI-Powered Sports Intelligence',
  description: 'AI-powered dossier enrichment system with Neo4j integration and Football Manager styling',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap" rel="stylesheet" />
        <link href="/fonts/ywft-wetzlar-grotesk-regular-demo.css" rel="stylesheet" />
      </head>
      <body className={`${inter.className} antialiased`} suppressHydrationWarning={true}>
        <BackgroundAnimation />
        <UserProvider>
          <TabProvider>
            <ThreadProvider>
              <SWRProvider>
                <CopilotKit 
                  runtimeUrl="/api/copilotkit"
                  publicLicenseKey={process.env.NEXT_PUBLIC_LICENSE_KEY}
                  publicApiKey={process.env.COPILOT_CLOUD_PUBLIC_API_KEY}
                  headers={{
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type',
                  }}
                  agentConfig={{
                    name: "Sports Intelligence Agent",
                    description: "AI agent specializing in sports entity analysis, RFP intelligence, and database operations",
                    capabilities: ["database-query", "web-research", "data-analysis", "entity-enrichment"],
                    tools: ["neo4j-mcp", "brightdata", "file-operations", "web-search"]
                  }}
                  enableAGUI={true}
                  showInspector={process.env.NODE_ENV === 'development'}
                >
                  <SharedCopilotProvider>
                    <AppNavigation>
                      {children}
                    </AppNavigation>
                    <SimpleStreamingChat />
                  </SharedCopilotProvider>
                </CopilotKit>
              </SWRProvider>
            </ThreadProvider>
          </TabProvider>
        </UserProvider>
      </body>
    </html>
  )
}



