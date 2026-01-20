import { BadgeMapping, BadgeConfig, BadgeServiceConfig, BadgeSize, BadgeSource } from '@/types/badge'

class BadgeService {
  private config: BadgeServiceConfig
  private cache: Map<string, { data: BadgeMapping; timestamp: number }> = new Map()
  private mappings: BadgeMapping[] = []


  constructor(config: BadgeServiceConfig = {}) {
    this.config = {
      baseUrl: '/badges', // Use local badge files (downloaded from S3)
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
      // Badges that need manual mapping (non-standard names)
      {
        entityId: 'sao-paulo',
        entityName: 'São Paulo FC',
        badgePath: '/badges/sao-paulo-badge.png',
        s3Url: '/badges/sao-paulo-badge.png',
        lastUpdated: new Date().toISOString(),
        source: 'local'
      },
      {
        entityId: 'union-berlin',
        entityName: '1. FC Union Berlin',
        badgePath: '/badges/union-berlin-badge.png',
        s3Url: '/badges/union-berlin-badge.png',
        lastUpdated: new Date().toISOString(),
        source: 'local'
      },
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

    const normalizedEntityName = entityName.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim()

    // Special case: Union Berlin (override to use correct badge name)
    if (normalizedEntityName.includes('union') && normalizedEntityName.includes('berlin')) {
      const mapping: BadgeMapping = {
        entityId,
        entityName,
        badgePath: '/badges/union-berlin-badge.png',
        s3Url: '/badges/union-berlin-badge.png',
        lastUpdated: new Date().toISOString(),
        source: 'local'
      }
      this.cache.set(cacheKey, { data: mapping, timestamp: Date.now() })
      console.log(`✅ Badge override for Union Berlin: union-berlin-badge.png`)
      return mapping
    }

    // Special case: 1. FC Köln (umlaut variations)
    if (normalizedEntityName.includes('fc') && (normalizedEntityName.includes('koln') || normalizedEntityName.includes('kln'))) {
      const mapping: BadgeMapping = {
        entityId,
        entityName,
        badgePath: '/badges/1-fc-kln-badge.png',
        s3Url: '/badges/1-fc-kln-badge.png',
        lastUpdated: new Date().toISOString(),
        source: 'local'
      }
      this.cache.set(cacheKey, { data: mapping, timestamp: Date.now() })
      console.log(`✅ Badge override for 1. FC Köln: 1-fc-kln-badge.png`)
      return mapping
    }

    // Try to find existing mapping - check for partial match on entity name
    let mapping = this.mappings.find(m => {
      if (m.entityId === entityId) return true
      if (!m.entityName) return false
      const normalizedMappingName = m.entityName.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim()
      // Exact match
      if (normalizedMappingName === normalizedEntityName) return true
      // Substring match for shorter names
      if (normalizedMappingName.includes(normalizedEntityName) && normalizedEntityName.length > 5) return true
      if (normalizedEntityName.includes(normalizedMappingName) && normalizedMappingName.length > 5) return true
      return false
    })

    if (!mapping) {
      // Try to generate a mapping based on naming conventions (async now)
      mapping = await this.generateBadgeMapping(entityId, entityName)
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
  // Returns null if badge doesn't exist (to prevent 404s and show fallback instead)
  private async generateBadgeMapping(entityId: string | number, entityName: string): Promise<BadgeMapping | null> {
    // Extract the main name by removing common suffixes
    const mainName = entityName
      .replace(/ Football Club$/i, '')
      .replace(/ FC$/i, '')
      .replace(/ AFC$/i, '')
      .replace(/ Club$/i, '')
      .trim()

    const normalizedName = mainName
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')

    // Try the original full name as fallback
    const fullNameNormalized = entityName
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')

    // List of possible badge filenames to try (in order of preference)
    const possibleBadges = [
      `${normalizedName}-badge.png`,              // Main name
      `${fullNameNormalized}-badge.png`,          // Full name
      `${normalizedName}.png`,                    // Without -badge suffix
      `${fullNameNormalized}.png`,                // Full name without -badge suffix
    ]

    // Try each badge to see if it exists
    for (const badgeFilename of possibleBadges) {
      if (await this.badgeFileExists(badgeFilename)) {
        console.log(`✅ Found badge for ${entityName}: ${badgeFilename}`)
        return {
          entityId,
          entityName,
          badgePath: `/badges/${badgeFilename}`,
          s3Url: `/badges/${badgeFilename}`,
          lastUpdated: new Date().toISOString(),
          source: 'local'
        }
      }
    }

    // No badge found - return null to trigger fallback
    console.log(`⚠️ No badge found for: ${entityName} (tried: ${possibleBadges.join(', ')})`)
    return null
  }

  // Check if badge file exists
  private async badgeFileExists(badgeFilename: string): Promise<boolean> {
    // In browser environment, try to fetch the badge
    if (typeof window !== 'undefined') {
      try {
        const response = await fetch(`/badges/${badgeFilename}`, { method: 'HEAD' })
        return response.ok
      } catch {
        return false
      }
    }

    // In Node.js environment during build time, assume badge exists
    // (We know we downloaded 272 badges from S3)
    return true
  }

  // Get badge URL with fallback handling
  getBadgeUrl(mapping: BadgeMapping | null, size: BadgeSize = 'md'): string {
    if (!mapping) {
      return this.getFallbackBadgeUrl()
    }

    // Generate multiple possible URLs for better fallback handling
    const urls = []

    // Always try S3 URL first (most reliable)
    if (mapping.s3Url) {
      urls.push(mapping.s3Url)
    }

    // Try the primary badge path
    if (mapping.badgePath) {
      const localPath = mapping.badgePath.startsWith('/')
        ? mapping.badgePath
        : `${this.config.baseUrl}/${mapping.badgePath}`
      urls.push(localPath)
    }

    // Generate additional fallback URLs based on entity name
    const mainName = mapping.entityName
      .replace(/ Football Club$/i, '')
      .replace(/ FC$/i, '')
      .replace(/ AFC$/i, '')
      .replace(/ Club$/i, '')
      .trim()

    const normalizedName = mainName
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')

    // Try simplified variations
    urls.push(`${this.config.baseUrl}/${normalizedName}-badge.png`)
    urls.push(`${this.config.baseUrl}/${normalizedName}.png`)

    // Try theSportsDB URL if available
    if (mapping.badgeUrl) {
      urls.push(mapping.badgeUrl)
    }

    // Final fallback
    urls.push(`${this.config.baseUrl}/placeholder-badge.png`)

    // Return the first URL that seems valid (we'll let the component handle actual loading errors)
    const selectedUrl = urls.find(url => url) || this.getFallbackBadgeUrl()
    console.log('Badge URL selected:', selectedUrl, 'for entity:', mapping.entityName, 'URLs tried:', urls)
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

  // Add local badge mapping
  addS3BadgeMapping(entityId: string | number, entityName: string, s3Key?: string): BadgeMapping {
    const key = s3Key || `${entityName.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '-')}-badge.png`
    const localPath = `/badges/${key}`

    const mapping: BadgeMapping = {
      entityId,
      entityName,
      badgePath: localPath,
      s3Url: localPath,
      lastUpdated: new Date().toISOString(),
      source: 'local'
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

// Clear cache on module load to ensure fresh mappings
badgeService.clearCache()

// Export utility functions
export const getBadgeForEntity = (entityId: string | number, entityName: string) =>
  badgeService.getBadgeForEntity(entityId, entityName)

export const getBadgeUrl = (mapping: BadgeMapping | null, size?: BadgeSize) =>
  badgeService.getBadgeUrl(mapping, size)

export const getEntityInitials = (entityName: string) =>
  badgeService.getEntityInitials(entityName)

export const getEntityType = (labels: string[]) =>
  badgeService.getEntityType(labels)