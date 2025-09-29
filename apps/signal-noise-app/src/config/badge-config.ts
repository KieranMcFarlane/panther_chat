import { BadgeConfig } from '@/types/badge'

export const BADGE_CONFIGS: Record<string, BadgeConfig> = {
  // Sports Clubs
  'manchester-united': {
    id: 'manchester-united',
    name: 'Manchester United',
    entityType: 'club',
    category: 'sports',
    defaultSize: 'md'
  },
  'sao-paulo': {
    id: 'sao-paulo',
    name: 'São Paulo FC',
    entityType: 'club',
    category: 'sports',
    defaultSize: 'md'
  },
  
  // Sports Leagues
  'premier-league': {
    id: 'premier-league',
    name: 'Premier League',
    entityType: 'league',
    category: 'sports',
    defaultSize: 'md'
  },
  'indian-premier-league': {
    id: 'indian-premier-league',
    name: 'Indian Premier League',
    entityType: 'league',
    category: 'sports',
    defaultSize: 'md'
  },
  'australian-football-league': {
    id: 'australian-football-league',
    name: 'Australian Football League',
    entityType: 'league',
    category: 'sports',
    defaultSize: 'md'
  },

  // Default configurations
  'default-club': {
    id: 'default-club',
    name: 'Sports Club',
    entityType: 'club',
    category: 'sports',
    defaultSize: 'md',
    fallbackIcon: 'users'
  },
  'default-league': {
    id: 'default-league',
    name: 'Sports League',
    entityType: 'league',
    category: 'sports',
    defaultSize: 'md',
    fallbackIcon: 'trophy'
  },
  'default-organization': {
    id: 'default-organization',
    name: 'Organization',
    entityType: 'organization',
    category: 'other',
    defaultSize: 'md',
    fallbackIcon: 'building2'
  },
  'default-event': {
    id: 'default-event',
    name: 'Event',
    entityType: 'event',
    category: 'other',
    defaultSize: 'md',
    fallbackIcon: 'shield'
  }
}

export const getBadgeConfig = (entityName: string, entityType?: string): BadgeConfig => {
  const normalizedName = entityName
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')

  // Try to find exact match
  if (BADGE_CONFIGS[normalizedName]) {
    return BADGE_CONFIGS[normalizedName]
  }

  // Try to find partial match
  const partialMatch = Object.keys(BADGE_CONFIGS).find(key => 
    normalizedName.includes(key) || key.includes(normalizedName)
  )
  
  if (partialMatch) {
    return BADGE_CONFIGS[partialMatch]
  }

  // Fall back to entity type defaults
  const typeKey = entityType ? `default-${entityType.toLowerCase()}` : 'default-organization'
  return BADGE_CONFIGS[typeKey] || BADGE_CONFIGS['default-organization']
}

export const getAllBadgeConfigs = (): BadgeConfig[] => {
  return Object.values(BADGE_CONFIGS).filter(config => !config.id.startsWith('default-'))
}

export const getBadgesByCategory = (category: string): BadgeConfig[] => {
  return getAllBadgeConfigs().filter(config => config.category === category)
}

export const getBadgesByEntityType = (entityType: string): BadgeConfig[] => {
  return getAllBadgeConfigs().filter(config => config.entityType === entityType)
}