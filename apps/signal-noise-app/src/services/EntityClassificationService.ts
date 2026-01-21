/**
 * Entity Classification Service
 * Automatically categorizes unknown entities based on their properties and descriptions
 */

import { supabase } from '@/lib/supabase-client'

export type EntityType = 
  | 'Club'
  | 'Federation' 
  | 'Organization'
  | 'League'
  | 'Tournament'
  | 'Team'
  | 'Venue'
  | 'Person'
  | 'Brand'
  | 'Media'
  | 'Technology'
  | 'Sponsor'
  | 'Unknown'

export interface ClassificationResult {
  type: EntityType
  confidence: number
  reasoning: string
}

export class EntityClassificationService {
  private sportKeywords: Record<string, string[]> = {
    'Football': ['football', 'soccer', 'premier league', 'la liga', 'bundesliga', 'serie a', 'ligue 1', 'championship', 'league one', 'league two', 'fa cup', 'champions league', 'europa league'],
    'Basketball': ['basketball', 'nba', 'euroleague', 'fiba', 'basketball bundesliga', 'acb', 'legabasket'],
    'Tennis': ['tennis', 'atp', 'wta', 'grand slam', 'wimbledon', 'us open', 'french open', 'australian open'],
    'Cricket': ['cricket', 'test match', 'odi', 't20', 'ipl', 'ashes', 'world cup', 'county championship'],
    'Rugby': ['rugby', 'six nations', 'premiership', 'top 14', 'super rugby', 'all blacks', 'springboks'],
    'Golf': ['golf', 'pga', 'european tour', 'masters', 'us open', 'open championship', 'pga championship'],
    'Motorsport': ['f1', 'formula 1', 'motogp', 'nascar', 'indy', 'rally', 'le mans', 'motorsport'],
    'Baseball': ['baseball', 'mlb', 'world series', 'american league', 'national league'],
    'Ice Hockey': ['hockey', 'nhl', 'ice hockey', 'stanley cup', 'khl'],
    'Volleyball': ['volleyball', 'fivb', 'cev', 'eurovolley'],
    'Handball': ['handball', 'ehf', 'champions league'],
    'Athletics': ['athletics', 'track and field', 'olympics', 'diamond league', 'marathon'],
    'Swimming': ['swimming', 'fina', 'olympics', 'world championships'],
    'Cycling': ['cycling', 'tour de france', 'giro d italia', 'vuelta a espana', 'ucI'],
    'Boxing': ['boxing', 'wba', 'wbc', 'ibf', 'wbo'],
    'MMA': ['mma', 'ufc', 'bellator', 'mixed martial arts'],
    'American Football': ['american football', 'nfl', 'super bowl', 'ncaa'],
    'Esports': ['esports', 'gaming', 'valorant', 'league of legends', 'counter strike', 'dota']
  }

  private roleKeywords = {
    'Person': ['director', 'manager', 'coach', 'ceo', 'chairman', 'president', 'owner', 'executive', 'player', 'athlete', 'captain', 'secretary', 'head', 'chief', 'officer'],
    'Organization': ['federation', 'association', 'organization', 'committee', 'board', 'council', 'foundation', 'trust', 'authority'],
    'Venue': ['stadium', 'arena', 'ground', 'park', 'field', 'centre', 'center', 'oval', 'coliseum', 'venue', 'facility', 'complex'],
    'Media': ['tv', 'television', 'radio', 'media', 'broadcast', 'channel', 'network', 'newspaper', 'magazine', 'website', 'streaming'],
    'Technology': ['software', 'platform', 'app', 'technology', 'digital', 'analytics', 'data', 'systems', 'infrastructure', 'cloud'],
    'Brand': ['brand', 'apparel', 'equipment', 'gear', 'manufacturer', 'supplier', 'sponsor'],
    'Sponsor': ['sponsor', 'partner', 'backer', 'supporter', 'funding', 'investment']
  }

  private leagueKeywords = ['league', 'division', 'conference', 'championship', 'cup', 'tournament', 'series', 'grand prix', 'open', 'masters']
  private clubKeywords = ['club', 'team', 'fc', 'united', 'city', 'rangers', 'celtic', 'athletic', 'sporting', 'arsenal', 'chelsea', 'barcelona', 'real madrid']

  // Patterns for entities without descriptions
  private countryCodes = ['USA', 'UAE', 'UK', 'USSR', 'UAE', 'USA', 'UAE']
  private continents = ['Europe', 'Asia', 'Africa', 'Oceania', 'America', 'North America', 'South America', 'Antarctica']
  private sportsTerms = ['Football', 'Basketball', 'Tennis', 'Cricket', 'Rugby', 'Golf', 'Hockey', 'Baseball', 'Volleyball', 'Athletics', 'Swimming', 'Cycling', 'Boxing', 'MMA', 'Karate', 'Sumo', 'Luge', 'Padel', 'Sambo']
  private sportsDisciplines = ['Athletics', 'Gymnastics', 'Wrestling', 'Fencing', 'Archery', 'Shooting', 'Rowing', 'Sailing', 'Canoe', 'Equestrian', 'Triathlon', 'Modern Pentathlon']
  private tierTerms = ['tier_1', 'tier_2', 'tier_3', 'tier1', 'tier2', 'tier3', 'division 1', 'division 2', 'division 3']
  private businessTerms = ['Global', 'International', 'World', 'Universal', 'Worldwide', 'Continental']

  classifyEntity(name: string, description: string, sport?: string, league?: string): ClassificationResult {
    const text = `${name} ${description}`.toLowerCase()
    
    // Skip if already well-classified
    if (this.isAlreadyClassified(name, description, sport, league)) {
      return { type: 'Unknown', confidence: 0.1, reasoning: 'Already appears to be properly classified' }
    }

    // Check for specific patterns first
    const venueResult = this.checkForVenue(name, description, text)
    if (venueResult.confidence > 0.7) return venueResult

    const personResult = this.checkForPerson(name, description, text)
    if (personResult.confidence > 0.7) return personResult

    const organizationResult = this.checkForOrganization(name, description, text)
    if (organizationResult.confidence > 0.7) return organizationResult

    const clubResult = this.checkForClub(name, description, text, sport, league)
    if (clubResult.confidence > 0.6) return clubResult

    const leagueResult = this.checkForLeague(name, description, text)
    if (leagueResult.confidence > 0.6) return leagueResult

    const mediaResult = this.checkForMedia(name, description, text)
    if (mediaResult.confidence > 0.6) return mediaResult

    const techResult = this.checkForTechnology(name, description, text)
    if (techResult.confidence > 0.6) return techResult

    const brandResult = this.checkForBrand(name, description, text)
    if (brandResult.confidence > 0.6) return brandResult

    // Handle entities without descriptions using pattern matching
    if (!description || description.trim().length === 0) {
      const noDescResult = this.classifyByPatternOnly(name, sport, league)
      if (noDescResult.confidence > 0.5) {
        return noDescResult
      }
    }

    // Fallback classifications
    if (sport && sport.toLowerCase() !== 'multi-sport') {
      return { type: 'Organization', confidence: 0.5, reasoning: `Sports-related entity in ${sport}` }
    }

    return { type: 'Unknown', confidence: 0.2, reasoning: 'Insufficient information for classification' }
  }

  private isAlreadyClassified(name: string, description: string, sport?: string, league?: string): boolean {
    const text = `${name} ${description}`.toLowerCase()
    
    // Football clubs are already well classified
    if (this.clubKeywords.some(keyword => text.includes(keyword)) && sport === 'Football') {
      return true
    }

    // Professional teams in major leagues are already classified
    if (league && this.leagueKeywords.some(keyword => league.toLowerCase().includes(keyword))) {
      return true
    }

    return false
  }

  private checkForVenue(name: string, description: string, text: string): ClassificationResult {
    const venueIndicators = [
      ...this.roleKeywords['Venue'],
      'host', 'capacity', 'seating', 'located in', 'based in', 'home of'
    ]

    const matches = venueIndicators.filter(indicator => text.includes(indicator))
    
    if (matches.length >= 2) {
      return { type: 'Venue', confidence: 0.9, reasoning: `Multiple venue indicators: ${matches.join(', ')}` }
    }
    
    if (matches.length >= 1) {
      return { type: 'Venue', confidence: 0.7, reasoning: `Venue indicator: ${matches[0]}` }
    }

    return { type: 'Venue', confidence: 0.1, reasoning: 'No venue indicators found' }
  }

  private checkForPerson(name: string, description: string, text: string): ClassificationResult {
    // Check for title patterns
    const titlePatterns = [
      /^(mr|mrs|ms|dr|sir|prof)\s+/i,
      /\s+(jr|sr|ii|iii|iv)$/i,
    ]

    const personIndicators = [
      ...this.roleKeywords['Person'],
      'former', 'retired', 'legendary', 'current', 'appointed', 'elected', 'named',
      'born', 'age', 'career', 'joined', 'left', 'moved', 'transferred'
    ]

    const hasTitle = titlePatterns.some(pattern => pattern.test(name))
    const matches = personIndicators.filter(indicator => text.includes(indicator))

    if (hasTitle && matches.length >= 1) {
      return { type: 'Person', confidence: 0.9, reasoning: `Person with title and indicators: ${matches.join(', ')}` }
    }

    if (matches.length >= 3) {
      return { type: 'Person', confidence: 0.8, reasoning: `Multiple person indicators: ${matches.join(', ')}` }
    }

    if (matches.length >= 2) {
      return { type: 'Person', confidence: 0.7, reasoning: `Person indicators: ${matches.join(', ')}` }
    }

    return { type: 'Person', confidence: 0.1, reasoning: 'Insufficient person indicators' }
  }

  private checkForOrganization(name: string, description: string, text: string): ClassificationResult {
    const orgIndicators = [
      ...this.roleKeywords['Organization'],
      'managing', 'governing', 'regulatory', 'official', 'national', 'international',
      'continental', 'regional', 'local', 'community', 'amateur', 'professional'
    ]

    const matches = orgIndicators.filter(indicator => text.includes(indicator))

    if (matches.length >= 2) {
      return { type: 'Organization', confidence: 0.8, reasoning: `Organization indicators: ${matches.join(', ')}` }
    }

    if (matches.length >= 1) {
      return { type: 'Organization', confidence: 0.6, reasoning: `Organization indicator: ${matches[0]}` }
    }

    return { type: 'Organization', confidence: 0.1, reasoning: 'No organization indicators' }
  }

  private checkForClub(name: string, description: string, text: string, sport?: string, league?: string): ClassificationResult {
    const clubIndicators = [
      ...this.clubKeywords,
      'professional', 'team', 'squad', 'players', 'manager', 'coach', 'stadium', 'home ground',
      'based in', 'founded', 'established', 'member', 'supporters', 'fans'
    ]

    const matches = clubIndicators.filter(indicator => text.includes(indicator))

    // High confidence if sport and league match
    if (sport && league && matches.length >= 2) {
      return { 
        type: 'Club', 
        confidence: 0.9, 
        reasoning: `Club in ${sport} (${league}) with indicators: ${matches.join(', ')}` 
      }
    }

    if (matches.length >= 3) {
      return { type: 'Club', confidence: 0.8, reasoning: `Multiple club indicators: ${matches.join(', ')}` }
    }

    if (matches.length >= 2 && sport) {
      return { type: 'Club', confidence: 0.7, reasoning: `Club indicators in ${sport}: ${matches.join(', ')}` }
    }

    if (matches.length >= 2) {
      return { type: 'Club', confidence: 0.6, reasoning: `Club indicators: ${matches.join(', ')}` }
    }

    return { type: 'Club', confidence: 0.1, reasoning: 'Insufficient club indicators' }
  }

  private checkForLeague(name: string, description: string, text: string): ClassificationResult {
    const leagueIndicators = [
      ...this.leagueKeywords,
      'division', 'tier', 'level', 'season', 'competition', 'standings', 'table', 'fixtures',
      'clubs', 'teams', 'participants', 'format', 'schedule', 'playoffs', 'finals'
    ]

    const matches = leagueIndicators.filter(indicator => text.includes(indicator))

    if (matches.length >= 3) {
      return { type: 'League', confidence: 0.8, reasoning: `Multiple league indicators: ${matches.join(', ')}` }
    }

    if (matches.length >= 2) {
      return { type: 'League', confidence: 0.7, reasoning: `League indicators: ${matches.join(', ')}` }
    }

    return { type: 'League', confidence: 0.1, reasoning: 'Insufficient league indicators' }
  }

  private checkForMedia(name: string, description: string, text: string): ClassificationResult {
    const mediaIndicators = [
      ...this.roleKeywords['Media'],
      'broadcast', 'streaming', 'channel', 'network', 'coverage', 'commentary', 'analysis',
      'journalist', 'reporter', 'anchor', 'host', 'producer', 'director', 'media rights'
    ]

    const matches = mediaIndicators.filter(indicator => text.includes(indicator))

    if (matches.length >= 2) {
      return { type: 'Media', confidence: 0.7, reasoning: `Media indicators: ${matches.join(', ')}` }
    }

    return { type: 'Media', confidence: 0.1, reasoning: 'Insufficient media indicators' }
  }

  private checkForTechnology(name: string, description: string, text: string): ClassificationResult {
    const techIndicators = [
      ...this.roleKeywords['Technology'],
      'software', 'application', 'platform', 'system', 'digital', 'online', 'website',
      'app', 'mobile', 'data', 'analytics', 'ai', 'artificial intelligence', 'machine learning'
    ]

    const matches = techIndicators.filter(indicator => text.includes(indicator))

    if (matches.length >= 2) {
      return { type: 'Technology', confidence: 0.7, reasoning: `Technology indicators: ${matches.join(', ')}` }
    }

    return { type: 'Technology', confidence: 0.1, reasoning: 'Insufficient technology indicators' }
  }

  private checkForBrand(name: string, description: string, text: string): ClassificationResult {
    const brandIndicators = [
      ...this.roleKeywords['Brand'],
      'apparel', 'equipment', 'gear', 'manufacturer', 'supplier', 'branding', 'logo',
      'product', 'retail', 'store', 'shop', 'merchandise'
    ]

    const matches = brandIndicators.filter(indicator => text.includes(indicator))

    if (matches.length >= 2) {
      return { type: 'Brand', confidence: 0.7, reasoning: `Brand indicators: ${matches.join(', ')}` }
    }

    return { type: 'Brand', confidence: 0.1, reasoning: 'Insufficient brand indicators' }
  }

  private classifyByPatternOnly(name: string, sport?: string, league?: string): ClassificationResult {
    const normalizedName = name.trim()
    const lowerName = normalizedName.toLowerCase()

    // Check for continents
    if (this.continents.includes(normalizedName)) {
      return { type: 'Federation', confidence: 0.8, reasoning: `Continent: ${normalizedName}` }
    }

    // Check for country codes (all caps, 2-4 letters)
    if (/^[A-Z]{2,4}$/.test(normalizedName) && this.countryCodes.includes(normalizedName)) {
      return { type: 'Federation', confidence: 0.9, reasoning: `Country code: ${normalizedName}` }
    }

    // Check for sports disciplines
    if (this.sportsTerms.includes(normalizedName) || this.sportsDisciplines.includes(normalizedName)) {
      return { type: 'Federation', confidence: 0.8, reasoning: `Sport discipline: ${normalizedName}` }
    }

    // Check for tier/level indicators
    if (this.tierTerms.includes(lowerName)) {
      return { type: 'Organization', confidence: 0.7, reasoning: `Competition tier: ${normalizedName}` }
    }

    // Check for business/geographic terms
    if (this.businessTerms.includes(normalizedName)) {
      return { type: 'Organization', confidence: 0.6, reasoning: `Business/geographic scope: ${normalizedName}` }
    }

    // Check for known country/region patterns (single word, first letter capitalized)
    if (/^[A-Z][a-z]+$/.test(normalizedName) && normalizedName.length <= 10) {
      // Additional checks for common country suffixes/patterns
      const countryIndicators = ['ia', 'land', 'stan', 'coast', ' islands', 'republic', 'kingdom', 'state', 'city']
      if (countryIndicators.some(indicator => lowerName.includes(indicator))) {
        return { type: 'Federation', confidence: 0.6, reasoning: `Country/region pattern: ${normalizedName}` }
      }
    }

    // Check for multi-sport entities with no description
    if (sport === 'Multi-sport') {
      // If it's a known sports term or country, it's likely a federation
      if (this.sportsTerms.some(term => lowerName.includes(term.toLowerCase()))) {
        return { type: 'Federation', confidence: 0.7, reasoning: `Multi-sport entity: ${normalizedName}` }
      }
    }

    // Check for organization-like patterns
    const orgPatterns = ['association', 'federation', 'committee', 'council', 'board', 'authority', 'agency']
    if (orgPatterns.some(pattern => lowerName.includes(pattern))) {
      return { type: 'Organization', confidence: 0.7, reasoning: `Organization pattern: ${normalizedName}` }
    }

    // Default fallback
    return { type: 'Unknown', confidence: 0.3, reasoning: `Insufficient pattern data for: ${normalizedName}` }
  }

  async classifyUnknownEntities(batchSize = 50): Promise<void> {
    console.log('🔍 Starting classification of unknown entities...')
    
    try {
      // Fetch unknown entities
      const { data: unknownEntities, error } = await supabase
        .from('cached_entities')
        .select('*')
        .or('properties->>type.eq.Unknown,properties->>type.is.null')
        .limit(batchSize)

      if (error) {
        console.error('❌ Error fetching unknown entities:', error)
        throw error
      }

      console.log(`📋 Found ${unknownEntities.length} unknown entities to classify`)

      const updates: unknown[] = []
      
      for (const entity of unknownEntities) {
        const name = entity.properties?.name || ''
        const description = entity.properties?.description || ''
        const sport = entity.properties?.sport
        const league = entity.properties?.league

        const classification = this.classifyEntity(name, description, sport, league)

        if (classification.confidence > 0.5) {
          updates.push({
            id: entity.id,
            properties: {
              ...entity.properties,
              type: classification.type,
              classification_confidence: classification.confidence,
              classification_reasoning: classification.reasoning,
              classified_at: new Date().toISOString()
            }
          })

          console.log(`✅ ${name}: ${classification.type} (${Math.round(classification.confidence * 100)}% confidence)`)
        } else {
          console.log(`⚠️ ${name}: Unable to classify (${classification.reasoning})`)
        }
      }

      // Update classified entities
      if (updates.length > 0) {
        for (const update of updates) {
          const { error } = await supabase
            .from('cached_entities')
            .update({ properties: update.properties })
            .eq('id', update.id)

          if (error) {
            console.error(`❌ Error updating entity ${update.id}:`, error)
          }
        }
        
        console.log(`🎯 Successfully classified ${updates.length} entities`)
      } else {
        console.log('ℹ️ No entities met confidence threshold for classification')
      }

    } catch (error) {
      console.error('❌ Classification process failed:', error)
      throw error
    }
  }

  async generateClassificationReport(): Promise<string> {
    try {
      // Get classification stats
      const { data: stats, error } = await supabase
        .from('cached_entities')
        .select('properties->>type')
        .not('properties->>type', 'is', null)

      if (error) throw error

      const typeCounts = stats.reduce((acc, item) => {
        const type = item.type || 'Unknown'
        acc[type] = (acc[type] || 0) + 1
        return acc
      }, {} as Record<string, number>)

      let report = '# Entity Classification Report\n\n'
      report += `**Total Entities**: ${stats.length}\n`
      report += `**Last Updated**: ${new Date().toISOString()}\n\n`

      report += '## Classification Distribution\n\n'
      Object.entries(typeCounts)
        .sort(([,a], [,b]) => b - a)
        .forEach(([type, count]) => {
          const percentage = ((count / stats.length) * 100).toFixed(1)
          report += `- **${type}**: ${count} (${percentage}%)\n`
        })

      return report

    } catch (error) {
      console.error('❌ Error generating classification report:', error)
      return 'Error generating report'
    }
  }
}

export const entityClassificationService = new EntityClassificationService()