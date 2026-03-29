import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import AppShell from '@/components/layout/AppShell'
import SWRProvider from '@/components/providers/SWRProvider'
import { UserProvider } from '@/contexts/UserContext'
import { TabProvider } from '@/contexts/TabContext'
import { ThreadProvider } from '@/contexts/ThreadContext'

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
        <UserProvider>
          <TabProvider>
            <ThreadProvider>
              <SWRProvider>
                <AppShell>{children}</AppShell>
              </SWRProvider>
            </ThreadProvider>
          </TabProvider>
        </UserProvider>
      </body>
    </html>
  )
}
