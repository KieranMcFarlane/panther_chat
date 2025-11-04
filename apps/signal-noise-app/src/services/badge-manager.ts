import { BadgeMapping } from '@/types/badge'
import { BADGE_CONFIGS } from '@/config/badge-config'

export class BadgeManager {
  private static instance: BadgeManager
  private mappings: BadgeMapping[] = []

  private constructor() {
    this.loadMappings()
  }

  static getInstance(): BadgeManager {
    if (!BadgeManager.instance) {
      BadgeManager.instance = new BadgeManager()
    }
    return BadgeManager.instance
  }

  private loadMappings() {
    // Load from localStorage if available
    try {
      const saved = localStorage.getItem('badge-mappings')
      if (saved) {
        this.mappings = JSON.parse(saved)
      } else {
        // Initialize with default mappings
        this.initializeDefaultMappings()
      }
    } catch (error) {
      console.error('Failed to load badge mappings:', error)
      this.initializeDefaultMappings()
    }
  }

  private initializeDefaultMappings() {
    this.mappings = [
      {
        entityId: '139',
        entityName: 'Manchester United',
        badgePath: '/badges/manchester-united-badge.png',
        badgeUrl: 'https://r2.thesportsdb.com/images/media/team/badge/xzqdr11517660252.png',
        lastUpdated: new Date().toISOString(),
        source: 'thesportsdb'
      },
      {
        entityId: 'sao-paulo',
        entityName: 'São Paulo FC',
        badgePath: '/badges/sao-paulo-badge.png',
        badgeUrl: 'https://r2.thesportsdb.com/images/media/team/badge/sxpupx1473538135.png',
        lastUpdated: new Date().toISOString(),
        source: 'thesportsdb'
      },
      {
        entityId: '4328',
        entityName: 'Premier League',
        badgePath: '/badges/premier-league-badge.png',
        badgeUrl: 'https://r2.thesportsdb.com/images/media/league/badge/gasy9d1737743125.png',
        lastUpdated: new Date().toISOString(),
        source: 'thesportsdb'
      },
      {
        entityId: '4460',
        entityName: 'Indian Premier League',
        badgePath: '/badges/indian-premier-league-badge.png',
        badgeUrl: 'https://r2.thesportsdb.com/images/media/league/badge/gaiti11741709844.png',
        lastUpdated: new Date().toISOString(),
        source: 'thesportsdb'
      },
      {
        entityId: '4456',
        entityName: 'Australian Football League',
        badgePath: '/badges/australian-football-league-badge.png',
        badgeUrl: 'https://r2.thesportsdb.com/images/media/league/badge/wvx4721525519372.png',
        lastUpdated: new Date().toISOString(),
        source: 'thesportsdb'
      },
      {
        entityId: '197',
        entityName: '1. FC Köln',
        badgePath: '/badges/manchester-united-badge.png',
        badgeUrl: 'https://r2.thesportsdb.com/images/media/team/badge/xzqdr11517660252.png',
        lastUpdated: new Date().toISOString(),
        source: 'local'
      },
      {
        entityId: '191',
        entityName: '1. FC Nürnberg',
        badgePath: '/badges/manchester-united-badge.png',
        badgeUrl: 'https://r2.thesportsdb.com/images/media/team/badge/xzqdr11517660252.png',
        lastUpdated: new Date().toISOString(),
        source: 'local'
      },
      {
        entityId: '201',
        entityName: 'AC Milan',
        badgePath: '/badges/manchester-united-badge.png',
        badgeUrl: 'https://r2.thesportsdb.com/images/media/team/badge/xzqdr11517660252.png',
        lastUpdated: new Date().toISOString(),
        source: 'local'
      },
      {
        entityId: '450',
        entityName: '2. Bundesliga',
        badgePath: '/badges/premier-league-badge.png',
        badgeUrl: 'https://r2.thesportsdb.com/images/media/league/badge/gasy9d1737743125.png',
        lastUpdated: new Date().toISOString(),
        source: 'local'
      }
    ]
    this.saveMappings()
  }

  private saveMappings() {
    try {
      localStorage.setItem('badge-mappings', JSON.stringify(this.mappings))
    } catch (error) {
      console.error('Failed to save badge mappings:', error)
    }
  }

  // Get mapping by entity ID or name
  getMapping(entityId: string | number, entityName: string): BadgeMapping | null {
    return this.mappings.find(m => 
      m.entityId === entityId || 
      m.entityName.toLowerCase() === entityName.toLowerCase()
    ) || null
  }

  // Add or update mapping
  addOrUpdateMapping(mapping: BadgeMapping): void {
    const existingIndex = this.mappings.findIndex(m => 
      m.entityId === mapping.entityId || m.entityName === mapping.entityName
    )

    if (existingIndex >= 0) {
      this.mappings[existingIndex] = { ...mapping, lastUpdated: new Date().toISOString() }
    } else {
      this.mappings.push(mapping)
    }

    this.saveMappings()
  }

  // Remove mapping
  removeMapping(entityId: string | number): boolean {
    const initialLength = this.mappings.length
    this.mappings = this.mappings.filter(m => m.entityId !== entityId)
    
    if (this.mappings.length < initialLength) {
      this.saveMappings()
      return true
    }
    return false
  }

  // Get all mappings
  getAllMappings(): BadgeMapping[] {
    return [...this.mappings]
  }

  // Get mappings by source
  getMappingsBySource(source: string): BadgeMapping[] {
    return this.mappings.filter(m => m.source === source)
  }

  // Search mappings
  searchMappings(query: string): BadgeMapping[] {
    const lowerQuery = query.toLowerCase()
    return this.mappings.filter(m => 
      m.entityName.toLowerCase().includes(lowerQuery) ||
      m.entityId.toString().includes(lowerQuery)
    )
  }

  // Clear all mappings
  clearMappings(): void {
    this.mappings = []
    this.saveMappings()
  }

  // Export mappings
  exportMappings(): string {
    return JSON.stringify(this.mappings, null, 2)
  }

  // Import mappings
  importMappings(mappingsJson: string): boolean {
    try {
      const imported = JSON.parse(mappingsJson)
      if (Array.isArray(imported)) {
        this.mappings = imported
        this.saveMappings()
        return true
      }
      return false
    } catch (error) {
      console.error('Failed to import badge mappings:', error)
      return false
    }
  }

  // Get statistics
  getStatistics() {
    const stats = {
      total: this.mappings.length,
      bySource: {} as Record<string, number>,
      byEntityType: {} as Record<string, number>
    }

    this.mappings.forEach(mapping => {
      // Count by source
      stats.bySource[mapping.source] = (stats.bySource[mapping.source] || 0) + 1
      
      // Count by entity type (infer from name/config)
      const config = BADGE_CONFIGS[mapping.entityName.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '-')]
      const entityType = config?.entityType || 'organization'
      stats.byEntityType[entityType] = (stats.byEntityType[entityType] || 0) + 1
    })

    return stats
  }
}

// Export singleton instance
export const badgeManager = BadgeManager.getInstance()