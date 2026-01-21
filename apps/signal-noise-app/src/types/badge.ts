export interface BadgeConfig {
  id: string
  name: string
  entityType: 'club' | 'league' | 'organization' | 'event'
  category: 'sports' | 'business' | 'technology' | 'other'
  fallbackIcon?: string
  defaultSize?: 'sm' | 'md' | 'lg'
}

export interface BadgeMapping {
  entityId: string | number
  entityName: string
  badgePath: string
  badgeUrl?: string
  s3Url?: string
  lastUpdated: string
  source: 'thesportsdb' | 'local' | 'custom' | 's3'
}

export interface BadgeComponentProps {
  entity: {
    id: string | number
    neo4j_id: string | number
    badge_s3_url?: string
    labels: string[]
    properties: Record<string, any>
  }
  size?: 'sm' | 'md' | 'lg'
  className?: string
  showFallback?: boolean
  onClick?: () => void
}

export interface BadgeServiceConfig {
  baseUrl?: string
  fallbackMode?: 'icon' | 'initials' | 'placeholder'
  enableCaching?: boolean
  cacheTTL?: number
}

export type BadgeSize = 'sm' | 'md' | 'lg'
export type BadgeSource = 'thesportsdb' | 'local' | 'custom' | 'fallback' | 's3' | 'generated'