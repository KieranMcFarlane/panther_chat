"use client"

import React, { useState, useEffect } from 'react'
import NextImage from 'next/image'
import { cn } from '@/lib/utils'
import { BadgeComponentProps, BadgeSize, BadgeSource } from '@/types/badge'
import { badgeService, getBadgeForEntity, getBadgeUrl, getEntityInitials } from '@/services/badge-service'
import { Loader2, Shield, Trophy, Users, Building2 } from 'lucide-react'

const sizeClasses = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-12 h-12 text-sm',
  lg: 'w-16 h-16 text-base'
}

const iconSize = {
  sm: 16,
  md: 24,
  lg: 32
}

export function EntityBadge({ entity, size = 'md', className, showFallback = true, onClick }: BadgeComponentProps) {
  console.log('EntityBadge component mounted for:', entity.properties.name, 'neo4j_id:', entity.neo4j_id)
  const [badgeUrl, setBadgeUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [badgeSource, setBadgeSource] = useState<BadgeSource>('fallback')
  const [imageLoading, setImageLoading] = useState(true)

  useEffect(() => {
    const loadBadge = async () => {
      setLoading(true)
      setError(false)
      
      try {
        console.log('Loading badge for entity:', entity.properties.name, 'ID:', entity.neo4j_id)
        const mapping = await getBadgeForEntity(entity.neo4j_id, entity.properties.name)
        
        if (mapping) {
          const url = getBadgeUrl(mapping, size)
          console.log('Badge mapping found:', mapping)
          console.log('Badge URL:', url)
          setBadgeUrl(url)
          setBadgeSource(mapping.source)
          
          // Reset image loading state for new URL
          setImageLoading(true)
          
          // Set loading to false immediately - let the img tag handle its own loading
          setLoading(false)
        } else {
          console.log('No badge mapping found for entity:', entity.properties.name)
          setLoading(false)
          setError(true)
        }
      } catch (err) {
        console.error('Failed to load badge:', err)
        setLoading(false)
        setError(true)
      }
    }

    loadBadge()
  }, [entity.neo4j_id, entity.properties.name, size])

  const getEntityTypeIcon = () => {
    const labels = entity.labels || []
    const entityType = badgeService.getEntityType(labels)
    
    switch (entityType) {
      case 'club':
        return <Users size={iconSize[size]} className="text-blue-600" />
      case 'league':
        return <Trophy size={iconSize[size]} className="text-yellow-600" />
      case 'event':
        return <Shield size={iconSize[size]} className="text-green-600" />
      default:
        return <Building2 size={iconSize[size]} className="text-gray-600" />
    }
  }

  const getEntityInitials = () => {
    const name = entity.properties.name || ''
    return name
      .split(' ')
      .filter(word => word.length > 0)
      .slice(0, 2)
      .map(word => word[0].toUpperCase())
      .join('')
  }

  const getBadgeColor = () => {
    const labels = entity.labels || []
    const entityType = badgeService.getEntityType(labels)
    
    switch (entityType) {
      case 'club':
        return 'bg-blue-100 text-blue-600 border-blue-200'
      case 'league':
        return 'bg-yellow-100 text-yellow-600 border-yellow-200'
      case 'event':
        return 'bg-green-100 text-green-600 border-green-200'
      default:
        return 'bg-gray-100 text-gray-600 border-gray-200'
    }
  }

  if (loading) {
    return (
      <div className={cn(
        'flex items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50',
        sizeClasses[size],
        className
      )}>
        <Loader2 className="animate-spin text-gray-400" size={iconSize[size]} />
      </div>
    )
  }

  if (error || !badgeUrl || !showFallback) {
    return (
      <div 
        className={cn(
          'flex flex-col items-center justify-center rounded-lg border-2 font-semibold',
          getBadgeColor(),
          sizeClasses[size],
          onClick && 'cursor-pointer hover:opacity-80 transition-opacity',
          className
        )}
        onClick={onClick}
        title={entity.properties.name}
      >
        {getEntityTypeIcon()}
        <span className="mt-1 leading-none">
          {getEntityInitials()}
        </span>
      </div>
    )
  }

  return (
    <div 
      className={cn(
        'relative rounded-lg overflow-hidden',
        sizeClasses[size],
        onClick && 'cursor-pointer hover:shadow-md transition-shadow',
        className
      )}
      onClick={onClick}
      title={entity.properties.name}
    >
      {/* Show loading skeleton while image is loading */}
      {imageLoading && (
        <div className="absolute inset-0 bg-gray-100 animate-pulse flex items-center justify-center">
          <Loader2 className="animate-spin text-gray-400" size={iconSize[size]} />
        </div>
      )}
      
      <img
        src={badgeUrl}
        alt={`${entity.properties.name} badge`}
        className={cn(
          "w-full h-full object-cover transition-opacity duration-200",
          imageLoading ? "opacity-0" : "opacity-100"
        )}
        onError={() => {
          console.error('Image failed to load in img tag:', badgeUrl)
          setError(true)
          setImageLoading(false)
        }}
        onLoad={() => {
          console.log('Image loaded successfully in img tag:', badgeUrl)
          setImageLoading(false)
        }}
      />
    </div>
  )
}

// Compact version for use in lists
export function CompactEntityBadge({ entity, size = 'sm', className, onClick }: BadgeComponentProps) {
  const [badgeUrl, setBadgeUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    const loadBadge = async () => {
      try {
        const mapping = await getBadgeForEntity(entity.neo4j_id, entity.properties.name)
        
        if (mapping) {
          const url = getBadgeUrl(mapping, size)
          setBadgeUrl(url)
          
          const img = new Image()
          img.onload = () => setLoading(false)
          img.onerror = () => {
            setLoading(false)
            setError(true)
          }
          img.src = url
        } else {
          setLoading(false)
          setError(true)
        }
      } catch (err) {
        setLoading(false)
        setError(true)
      }
    }

    loadBadge()
  }, [entity.neo4j_id, entity.properties.name, size])

  const getInitials = () => {
    const name = entity.properties.name || ''
    return name
      .split(' ')
      .filter(word => word.length > 0)
      .slice(0, 2)
      .map(word => word[0].toUpperCase())
      .join('')
  }

  if (loading) {
    return (
      <div className={cn(
        'flex items-center justify-center rounded-full border border-gray-300 bg-gray-100 animate-pulse',
        sizeClasses[size],
        className
      )} />
    )
  }

  if (error || !badgeUrl) {
    return (
      <div 
        className={cn(
          'flex items-center justify-center rounded-full border-2 border-gray-300 bg-gray-100 font-semibold text-gray-600',
          sizeClasses[size],
          onClick && 'cursor-pointer hover:bg-gray-200 transition-colors',
          className
        )}
        onClick={onClick}
        title={entity.properties.name}
      >
        {getInitials()}
      </div>
    )
  }

  return (
    <div 
      className={cn(
        'relative rounded-full overflow-hidden',
        sizeClasses[size],
        onClick && 'cursor-pointer hover:shadow-md transition-shadow',
        className
      )}
      onClick={onClick}
      title={entity.properties.name}
    >
      <NextImage
        src={badgeUrl}
        alt={`${entity.properties.name} badge`}
        fill
        className="object-cover"
        sizes={`${sizeClasses[size].split(' ')[0].replace('w-', '')}px`}
      />
    </div>
  )
}

// Badge grid component for displaying multiple entities
export function EntityBadgeGrid({ 
  entities, 
  size = 'md', 
  className,
  maxItems 
}: { 
  entities: any[]
  size?: BadgeSize
  className?: string
  maxItems?: number 
}) {
  const displayEntities = maxItems ? entities.slice(0, maxItems) : entities

  return (
    <div className={cn('grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4', className)}>
      {displayEntities.map((entity) => (
        <div key={entity.id} className="flex flex-col items-center space-y-2">
          <EntityBadge entity={entity} size={size} />
          <div className="text-xs text-center text-gray-600 font-medium line-clamp-2">
            {entity.properties.name}
          </div>
        </div>
      ))}
      {maxItems && entities.length > maxItems && (
        <div className="flex flex-col items-center justify-center">
          <div className={cn(
            'flex items-center justify-center rounded-full border-2 border-dashed border-gray-300 bg-gray-50 font-semibold text-gray-500',
            sizeClasses[size]
          )}>
            +{entities.length - maxItems}
          </div>
        </div>
      )}
    </div>
  )
}