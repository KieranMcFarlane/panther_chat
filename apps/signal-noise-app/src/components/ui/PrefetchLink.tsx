'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { usePrefetch } from '@/lib/swr-config'

interface PrefetchLinkProps {
  href: string
  children: React.ReactNode
  className?: string
  prefetchApi?: string[]
  onMouseEnter?: () => void
}

export default function PrefetchLink({ 
  href, 
  children, 
  className,
  prefetchApi = [],
  onMouseEnter 
}: PrefetchLinkProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { prefetch } = usePrefetch()

  const handleMouseEnter = () => {
    // Prefetch the Next.js page using App Router
    if (router && router.prefetch) {
      router.prefetch(href)
    }
    
    // Prefetch API data
    prefetchApi.forEach(apiUrl => {
      prefetch(apiUrl)
    })
    
    onMouseEnter?.()
  }

  return (
    <Link
      href={href}
      className={className}
      onMouseEnter={handleMouseEnter}
      prefetch={true}
    >
      {children}
    </Link>
  )
}