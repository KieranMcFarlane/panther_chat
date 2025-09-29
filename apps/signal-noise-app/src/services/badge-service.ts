import { BadgeMapping, BadgeConfig, BadgeServiceConfig, BadgeSize, BadgeSource } from '@/types/badge'

class BadgeService {
  private config: BadgeServiceConfig
  private cache: Map<string, { data: BadgeMapping; timestamp: number }> = new Map()
  private mappings: BadgeMapping[] = []

  constructor(config: BadgeServiceConfig = {}) {
    this.config = {
      baseUrl: '/badges',
      fallbackMode: 'initials',
      enableCaching: true,
      cacheTTL: 3600000, // 1 hour
      ...config
    }

    // Initialize with our current badge mappings
    this.initializeDefaultMappings()
  }

  private initializeDefaultMappings() {
    this.mappings = [
      {
        entityId: '139',
        entityName: 'Manchester United',
        badgePath: '/badges/manchester-united-badge.png',
        badgeUrl: 'https://r2.thesportsdb.com/images/media/team/badge/xzqdr11517660252.png',
        s3Url: 'https://sportsintelligence.s3.eu-north-1.amazonaws.com/badges/manchester-united-badge.png',
        lastUpdated: new Date().toISOString(),
        source: 'thesportsdb'
      },
      {
        entityId: 'sao-paulo',
        entityName: 'São Paulo FC',
        badgePath: '/badges/sao-paulo-badge.png',
        badgeUrl: 'https://r2.thesportsdb.com/images/media/team/badge/sxpupx1473538135.png',
        s3Url: 'https://sportsintelligence.s3.eu-north-1.amazonaws.com/badges/sao-paulo-badge.png',
        lastUpdated: new Date().toISOString(),
        source: 'thesportsdb'
      },
      {
        entityId: '4328',
        entityName: 'Premier League',
        badgePath: '/badges/premier-league-badge.png',
        badgeUrl: 'https://r2.thesportsdb.com/images/media/league/badge/gasy9d1737743125.png',
        s3Url: 'https://sportsintelligence.s3.eu-north-1.amazonaws.com/badges/premier-league-badge.png',
        lastUpdated: new Date().toISOString(),
        source: 'thesportsdb'
      },
      {
        entityId: '4460',
        entityName: 'Indian Premier League',
        badgePath: '/badges/indian-premier-league-badge.png',
        badgeUrl: 'https://r2.thesportsdb.com/images/media/league/badge/gaiti11741709844.png',
        s3Url: 'https://sportsintelligence.s3.eu-north-1.amazonaws.com/badges/indian-premier-league-badge.png',
        lastUpdated: new Date().toISOString(),
        source: 'thesportsdb'
      },
      {
        entityId: '4456',
        entityName: 'Australian Football League',
        badgePath: '/badges/australian-football-league-badge.png',
        badgeUrl: 'https://r2.thesportsdb.com/images/media/league/badge/wvx4721525519372.png',
        s3Url: 'https://sportsintelligence.s3.eu-north-1.amazonaws.com/badges/australian-football-league-badge.png',
        lastUpdated: new Date().toISOString(),
        source: 'thesportsdb'
      },
      {
        entityId: '197',
        entityName: '1. FC Köln',
        badgePath: '/badges/manchester-united-badge.png',
        badgeUrl: 'https://r2.thesportsdb.com/images/media/team/badge/xzqdr11517660252.png',
        s3Url: 'https://sportsintelligence.s3.eu-north-1.amazonaws.com/badges/1-fc-koln-badge.png',
        lastUpdated: new Date().toISOString(),
        source: 'local'
      },
      {
        entityId: '191',
        entityName: '1. FC Nürnberg',
        badgePath: '/badges/manchester-united-badge.png',
        badgeUrl: 'https://r2.thesportsdb.com/images/media/team/badge/xzqdr11517660252.png',
        s3Url: 'https://sportsintelligence.s3.eu-north-1.amazonaws.com/badges/1-fc-nurnberg-badge.png',
        lastUpdated: new Date().toISOString(),
        source: 'local'
      },
      {
        entityId: '201',
        entityName: 'AC Milan',
        badgePath: '/badges/manchester-united-badge.png',
        badgeUrl: 'https://r2.thesportsdb.com/images/media/team/badge/xzqdr11517660252.png',
        s3Url: 'https://sportsintelligence.s3.eu-north-1.amazonaws.com/badges/ac-milan-badge.png',
        lastUpdated: new Date().toISOString(),
        source: 'local'
      },
      {
        entityId: '450',
        entityName: '2. Bundesliga',
        badgePath: '/badges/premier-league-badge.png',
        badgeUrl: 'https://r2.thesportsdb.com/images/media/league/badge/gasy9d1737743125.png',
        s3Url: 'https://sportsintelligence.s3.eu-north-1.amazonaws.com/badges/2-bundesliga-badge.png',
        lastUpdated: new Date().toISOString(),
        source: 'local'
      }
    ]
  }

  // Get badge mapping for an entity
  async getBadgeForEntity(entityId: string | number, entityName: string): Promise<BadgeMapping | null> {
    const cacheKey = `${entityId}-${entityName}`

    // Check cache first
    if (this.config.enableCaching) {
      const cached = this.cache.get(cacheKey)
      if (cached && Date.now() - cached.timestamp < this.config.cacheTTL!) {
        return cached.data
      }
    }

    // Try to find existing mapping
    let mapping = this.mappings.find(m => 
      m.entityId === entityId || 
      m.entityName.toLowerCase() === entityName.toLowerCase()
    )

    if (!mapping) {
      // Try to generate a mapping based on naming conventions
      mapping = this.generateBadgeMapping(entityId, entityName)
      if (mapping) {
        this.mappings.push(mapping)
      }
    }

    // Cache the result
    if (mapping && this.config.enableCaching) {
      this.cache.set(cacheKey, {
        data: mapping,
        timestamp: Date.now()
      })
    }

    return mapping || null
  }

  // Generate badge mapping based on naming conventions
  private generateBadgeMapping(entityId: string | number, entityName: string): BadgeMapping | null {
    const normalizedName = entityName
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')

    const possiblePaths = [
      `${this.config.baseUrl}/${normalizedName}-badge.png`,
      `${this.config.baseUrl}/${normalizedName}.png`,
      `${this.config.baseUrl}/${entityId}-badge.png`
    ]

    // Generate S3 URL based on naming convention
    const s3Url = `https://sportsintelligence.s3.eu-north-1.amazonaws.com/badges/${normalizedName}-badge.png`

    // Return the first plausible mapping
    return {
      entityId,
      entityName,
      badgePath: possiblePaths[0],
      s3Url,
      lastUpdated: new Date().toISOString(),
      source: 'local'
    }
  }

  // Get badge URL with fallback handling
  getBadgeUrl(mapping: BadgeMapping | null, size: BadgeSize = 'md'): string {
    if (!mapping) {
      return this.getFallbackBadgeUrl()
    }

    // Try different URL sources in order of preference - prioritize S3 URLs
    // Convert local paths to absolute URLs for better compatibility
    const localPath = mapping.badgePath.startsWith('/') 
      ? mapping.badgePath 
      : `${this.config.baseUrl}/${mapping.badgePath}`
    
    const urls = [
      mapping.s3Url, // Prioritize S3 URLs first
      localPath,
      mapping.badgeUrl,
      `${this.config.baseUrl}/placeholder-badge.png`
    ]

    const selectedUrl = urls.find(url => url) || this.getFallbackBadgeUrl()
    console.log('Badge URL selected:', selectedUrl, 'for entity:', mapping.entityName)
    return selectedUrl
  }

  // Fallback badge URL
  private getFallbackBadgeUrl(): string {
    return `${this.config.baseUrl}/placeholder-badge.png`
  }

  // Get entity initials for fallback
  getEntityInitials(entityName: string): string {
    return entityName
      .split(' ')
      .filter(word => word.length > 0)
      .slice(0, 2)
      .map(word => word[0].toUpperCase())
      .join('')
  }

  // Determine entity type from labels
  getEntityType(labels: string[]): 'club' | 'league' | 'organization' | 'event' {
    const labelStr = labels.join(' ').toLowerCase()
    
    if (labelStr.includes('club') || labelStr.includes('team')) {
      return 'club'
    } else if (labelStr.includes('league')) {
      return 'league'
    } else if (labelStr.includes('event') || labelStr.includes('match')) {
      return 'event'
    } else {
      return 'organization'
    }
  }

  // Add new badge mapping
  addBadgeMapping(mapping: BadgeMapping): void {
    const existingIndex = this.mappings.findIndex(m => 
      m.entityId === mapping.entityId || m.entityName === mapping.entityName
    )

    if (existingIndex >= 0) {
      this.mappings[existingIndex] = mapping
    } else {
      this.mappings.push(mapping)
    }

    // Clear related cache
    this.cache.clear()
  }

  // Add S3 badge mapping
  addS3BadgeMapping(entityId: string | number, entityName: string, s3Key?: string): BadgeMapping {
    const key = s3Key || `${entityName.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '-')}-badge.png`
    const s3Url = `https://sportsintelligence.s3.eu-north-1.amazonaws.com/badges/${key}`
    
    const mapping: BadgeMapping = {
      entityId,
      entityName,
      badgePath: `/badges/${key}`,
      s3Url,
      lastUpdated: new Date().toISOString(),
      source: 's3'
    }

    this.addBadgeMapping(mapping)
    return mapping
  }

  // Get all mappings
  getAllMappings(): BadgeMapping[] {
    return [...this.mappings]
  }

  // Clear cache
  clearCache(): void {
    this.cache.clear()
  }

  // Check if badge exists
  async badgeExists(entityId: string | number, entityName: string): Promise<boolean> {
    const mapping = await this.getBadgeForEntity(entityId, entityName)
    if (!mapping) return false

    try {
      const response = await fetch(mapping.badgePath, { method: 'HEAD' })
      return response.ok
    } catch {
      return false
    }
  }
}

// Export singleton instance
export const badgeService = new BadgeService()

// Export utility functions
export const getBadgeForEntity = (entityId: string | number, entityName: string) => 
  badgeService.getBadgeForEntity(entityId, entityName)

export const getBadgeUrl = (mapping: BadgeMapping | null, size?: BadgeSize) =>
  badgeService.getBadgeUrl(mapping, size)

export const getEntityInitials = (entityName: string) =>
  badgeService.getEntityInitials(entityName)

export const getEntityType = (labels: string[]) =>
  badgeService.getEntityType(labels)