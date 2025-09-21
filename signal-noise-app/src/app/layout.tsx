import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import AppNavigation from '@/components/layout/AppNavigation'
import { CopilotKit } from '@copilotkit/react-core'

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
      <body className={`${inter.className} antialiased`}>
        <CopilotKit 
          runtimeUrl="/api/copilotkit"
          publicLicenseKey="ck_pub_bd1e53be48f766e0ff4240c224db7a22"
        >
          <AppNavigation>
            {children}
          </AppNavigation>
        </CopilotKit>
      </body>
    </html>
  )
}



