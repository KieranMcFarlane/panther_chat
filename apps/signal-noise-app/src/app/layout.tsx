import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import AppNavigation from '@/components/layout/AppNavigation'
import BackgroundAnimation from '@/components/layout/BackgroundAnimation'
import SWRProvider from '@/components/providers/SWRProvider'
import { UserProvider } from '@/contexts/UserContext'
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
      </head>
      <body className={`${inter.className} antialiased`} suppressHydrationWarning={true}>
        <BackgroundAnimation />
        <UserProvider>
          <SWRProvider>
            {console.log('CopilotKit initializing with runtime URL:', '/api/copilotkit')}
            <CopilotKit 
              runtimeUrl="/api/copilotkit"
              publicLicenseKey={process.env.NEXT_PUBLIC_LICENSE_KEY}
              publicApiKey={process.env.COPILOT_CLOUD_PUBLIC_API_KEY}
              headers={{
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type',
              }}
            >
              <AppNavigation>
                {children}
              </AppNavigation>
              <SimpleStreamingChat />
            </CopilotKit>
          </SWRProvider>
        </UserProvider>
      </body>
    </html>
  )
}



