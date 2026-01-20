"use client"

import React, { useState, useEffect } from 'react'
import NextImage from 'next/image'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { BadgeComponentProps, BadgeSize, BadgeSource } from '@/types/badge'
import { badgeService, getBadgeForEntity, getBadgeUrl, getEntityInitials } from '@/services/badge-service'
import { Loader2, Shield, Trophy, Users, Building2 } from 'lucide-react'

const sizeClasses = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-12 h-12 text-sm',
  lg: 'w-16 h-16 text-base',
  xl: 'w-20 h-20 text-lg'
}

const iconSize = {
  sm: 16,
  md: 24,
  lg: 32,
  xl: 40
}

export function EntityBadge({ entity, size = 'md', showFallback = true, className, onClick }: BadgeComponentProps) {
  const router = useRouter()
  const [badgeUrl, setBadgeUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [badgeSource, setBadgeSource] = useState<BadgeSource>('fallback')

  useEffect(() => {
    if (!entity) return

    const loadBadge = async () => {
      try {
        setLoading(true)
        setError(false)

        console.log(`🏷️ Loading badge for: ${entity?.properties?.name || entity?.id}`)

        // Get badge mapping from service (now uses local files)
        const badgeMapping = await getBadgeForEntity(entity?.id?.toString() || 'unknown', entity?.properties?.name || 'Unknown Entity')

        if (badgeMapping?.s3Url) {
          // Badge found - use the local path
          console.log(`✅ Badge found: ${badgeMapping.s3Url}`)
          setBadgeUrl(badgeMapping.s3Url)
          setBadgeSource('s3')
        } else {
          // No badge found - will show fallback
          console.log(`⚠️ No badge found for: ${entity?.properties?.name}`)
          setBadgeUrl(null)
          setBadgeSource('fallback')
        }
      } catch (err) {
        console.error(`❌ Failed to load badge for ${entity?.properties?.name || entity?.id}:`, err)
        setError(true)
        setBadgeUrl(null)
        setBadgeSource('fallback')
      } finally {
        setLoading(false)
      }
    }

    loadBadge()
  }, [entity?.id])

  const handleClick = () => {
    if (!entity || !entity?.id) return

    console.log('🔗 Badge click navigation for:', entity?.properties?.name || entity?.id, 'ID:', entity?.id)

    if (onClick) {
      onClick(entity)
    } else {
      // Default navigation to entity page
      router.push(`/entity/${entity?.id}`)
    }
  }

  const initials = getEntityInitials(entity?.properties?.name || entity?.id?.toString() || 'Unknown')

  if (loading) {
    return (
      <div className={cn(
        'flex items-center justify-center rounded-full border-2 border-dashed border-gray-300 bg-gray-100 animate-pulse',
        sizeClasses[size],
        className
      )}>
        <Loader2 className={`${iconSize[size]} text-gray-400`} />
      </div>
    )
  }

  if (error || !badgeUrl) {
    // Show entity initials as fallback instead of shield icon
    const initials = getEntityInitials(entity?.properties?.name || entity?.id?.toString() || '??')

    return (
      <div
        className={cn(
          'flex items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-white font-bold shadow-lg',
          sizeClasses[size],
          className
        )}
        onClick={handleClick}
        title={entity?.properties?.name || entity?.id}
      >
        <span className={cn(
          size === 'sm' ? 'text-xs' : size === 'md' ? 'text-sm' : size === 'lg' ? 'text-base' : 'text-lg'
        )}>
          {initials}
        </span>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'relative cursor-pointer transition-all duration-200 hover:scale-105 group',
        className
      )}
      onClick={handleClick}
      title={entity?.properties?.name || entity?.id}
    >
      <img
        src={badgeUrl}
        alt={`${entity?.properties?.name || entity?.id} badge`}
        className={cn(
          'object-cover rounded-full',
          sizeClasses[size]
        )}
        onError={(e) => {
          console.error(`Badge load error for ${entity?.properties?.name || entity?.id}`)
          if (showFallback) {
            // Fallback to initials if image fails
            const target = e.target as HTMLImageElement
            target.style.display = 'none'
            if (target.nextElementSibling) {
              (target.nextElementSibling as HTMLElement).style.display = 'flex'
            }
          }
        }}
      />

      {/* Fallback initials - shown on error */}
      {showFallback && (
        <div
          className={cn(
            'absolute inset-0 flex items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-white font-bold pointer-events-none',
            sizeClasses[size]
          )}
          style={{ display: 'none' }}
        >
          <span className={cn('font-bold', size === 'sm' ? 'text-xs' : size === 'md' ? 'text-sm' : size === 'lg' ? 'text-base' : 'text-lg')}>
            {initials}
          </span>
        </div>
      )}

      {/* Badge source indicator */}
      <div className="absolute -bottom-1 -right-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
        {badgeSource === 's3' && (
          <div className="w-3 h-3 bg-green-500 rounded-full flex items-center justify-center" title="S3 Badge">
            <Trophy className="w-2 h-2 text-white" />
          </div>
        )}
        {badgeSource === 'local' && (
          <div className="w-3 h-3 bg-orange-500 rounded-full flex items-center justify-center" title="Local Badge">
            <Shield className="w-2 h-2 text-white" />
          </div>
        )}
        {badgeSource === 'generated' && (
          <div className="w-3 h-3 bg-purple-500 rounded-full flex items-center justify-center" title="Generated Badge">
            <Users className="w-2 h-2 text-white" />
          </div>
        )}
      </div>
    </div>
  )
}

// Compact version for use in lists
function CompactEntityBadge({ entity, size = 'sm', className, onClick }: BadgeComponentProps) {
  const router = useRouter()
  const [badgeUrl, setBadgeUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  // Unified navigation handler for compact badge
  const handleCompactBadgeClick = () => {
    if (!entity || !entity?.id) return

    console.log('🔗 Compact badge click navigation for:', entity?.properties?.name || entity?.id, 'ID:', entity?.id)

    if (onClick) {
      onClick(entity)
    } else {
      // Default navigation to entity page
      router.push(`/entity/${entity?.id}`)
    }
  }

  useEffect(() => {
    if (!entity) return

    const loadCompactBadge = async () => {
      try {
        setLoading(true)
        setError(false)

        // Try to get S3 badge URL first (from Supabase cache)
        const cachedBadge = await getBadgeForEntity(entity?.id?.toString() || 'unknown', entity?.properties?.name || 'Unknown Entity')

        if (cachedBadge?.s3Url) {
          // Use cached S3 URL
          setBadgeUrl(cachedBadge.s3Url)
        } else {
          // Use local fallback
          setBadgeUrl(`/badges/default-badge.png`)
        }
      } catch (err) {
        console.error(`Failed to load compact badge for ${entity?.properties?.name || entity?.id}:`, err)
        setError(true)
      } finally {
        setLoading(false)
      }
    }

    loadCompactBadge()
  }, [entity?.id])

  const initials = getEntityInitials(entity?.properties?.name || entity?.id?.toString() || 'Unknown')

  if (loading) {
    return (
      <div className={cn(
        'flex items-center justify-center rounded-full border-2 border-dashed border-gray-300 bg-gray-100 animate-pulse',
        sizeClasses[size],
        className
      )}>
        <Loader2 className={`${iconSize[size]} text-gray-400`} />
      </div>
    )
  }

  if (error || !badgeUrl) {
    return (
      <div
        className={cn(
          'flex items-center justify-center rounded-full border-2 border-gray-300 bg-gray-50 font-semibold text-gray-500',
          sizeClasses[size],
          className
        )}
        onClick={handleCompactBadgeClick}
        title={entity?.properties?.name || entity?.id}
      >
        <Shield className={`${iconSize[size]} text-gray-400`} />
      </div>
    )
  }

  return (
    <div
      className={cn(
        'relative cursor-pointer transition-all duration-200 hover:scale-105',
        className
      )}
      onClick={handleCompactBadgeClick}
      title={entity?.properties?.name || entity?.id}
    >
      <NextImage
        src={badgeUrl}
        alt={`${entity?.properties?.name || entity?.id} badge`}
        fill
        className="object-cover rounded-full"
        sizes={`${sizeClasses[size].split(' ')[0].replace('w-', '')}px`}
      />
    </div>
  )
}

export { CompactEntityBadge }