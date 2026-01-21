'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface PrefetchLinkProps {
  href: string
  children: React.ReactNode
  className?: string
  onMouseEnter?: () => void
}

export default function PrefetchLink({ 
  href, 
  children, 
  className,
  onMouseEnter 
}: PrefetchLinkProps) {
  const router = useRouter()

  const handleMouseEnter = () => {
    // Prefetch the Next.js page using App Router
    if (router && router.prefetch) {
      router.prefetch(href)
    }
    
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