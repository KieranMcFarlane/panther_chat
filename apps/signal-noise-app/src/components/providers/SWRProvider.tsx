'use client'

import { SWRConfig } from 'swr'
import { swrConfig, fetcher } from '@/lib/swr-config'

export default function SWRProvider({ 
  children 
}: { 
  children: React.ReactNode 
}) {
  return (
    <SWRConfig value={{ ...swrConfig, fetcher }}>
      {children}
    </SWRConfig>
  )
}