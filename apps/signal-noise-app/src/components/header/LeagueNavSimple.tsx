'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EntityBadge } from '@/components/badge/EntityBadge';
import { useEntitySummaries, useEntity } from '@/lib/swr-config';
import { useVectorSearch } from '@/hooks/useVectorSearch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ChevronUp, ChevronDown, Search, ArrowLeft } from 'lucide-react';

interface SportData {
  sport: string;
  popularity: number;
  leagues: LeagueData[];
}

interface LeagueData {
  league: string;
  popularity: number;
  country: string;
  clubs: Club[];
}

interface Club {
  id: string;
  neo4j_id: string;
  properties: {
    name: string;
    league?: string;
    sport: string;
    country?: string;
    type: string;
  };
}

// Sport popularity and country dominance for real-world ordering
const SPORT_COUNTRY_POPULARITY: { [sport: string]: Array<{country: string, priority: number}> } = {
  'Football': [
    { country: 'England', priority: 100 },     // Premier League
    { country: 'Spain', priority: 95 },        // LaLiga
    { country: 'Germany', priority: 90 },      // Bundesliga
    { country: 'Italy', priority: 85 },        // Serie A
    { country: 'France', priority: 80 },       // Ligue 1
    { country: 'Brazil', priority: 82 },       // Brasileirão
    { country: 'Argentina', priority: 78 },    // Primera División
    { country: 'United States', priority: 70 }, // MLS
    { country: 'Netherlands', priority: 68 },   // Eredivisie
  ],
  'Basketball': [
    { country: 'United States', priority: 100 }, // NBA
    { country: 'Spain', priority: 82 },        // ACB
    { country: 'France', priority: 85 },        // LNB
    { country: 'Greece', priority: 78 },       // Greek Basket League
    { country: 'Turkey', priority: 75 },       // BSL
    { country: 'Italy', priority: 72 },        // LBA
    { country: 'Germany', priority: 70 },      // BBL
    { country: 'Russia', priority: 68 },       // VTB United League
  ],
  'Tennis': [
    { country: 'United States', priority: 90 }, // US Open
    { country: 'England', priority: 88 },      // Wimbledon
    { country: 'France', priority: 85 },       // Roland Garros
    { country: 'Australia', priority: 82 },    // Australian Open
    { country: 'Italy', priority: 75 },       // Italian Open
    { country: 'Germany', priority: 73 },      // German Open
  ],
  'Cricket': [
    { country: 'India', priority: 100 },       // IPL
    { country: 'England', priority: 95 },      // The Hundred
    { country: 'Australia', priority: 90 },     // Big Bash League
    { country: 'Pakistan', priority: 85 },      // PSL
    { country: 'South Africa', priority: 82 },  // SA T20 League
    { country: 'West Indies', priority: 80 },  // CPL
  ],
  'Baseball': [
    { country: 'United States', priority: 100 }, // MLB
    { country: 'Japan', priority: 85 },         // NPB
    { country: 'South Korea', priority: 78 },   // KBO
    { country: 'Mexico', priority: 75 },        // LMB
    { country: 'Dominican Republic', priority: 72 }, // LIDOM
  ],
  'Ice Hockey': [
    { country: 'Canada', priority: 100 },        // NHL
    { country: 'United States', priority: 95 },  // NHL
    { country: 'Sweden', priority: 85 },         // SHL
    { country: 'Finland', priority: 82 },        // Liiga
    { country: 'Russia', priority: 88 },         // KHL
    { country: 'Czech Republic', priority: 78 }, // Czech Extraliga
    { country: 'Germany', priority: 75 },        // DEL
    { country: 'Switzerland', priority: 72 },    // National League
  ],
  'Rugby': [
    { country: 'England', priority: 100 },       // Premiership Rugby
    { country: 'France', priority: 95 },         // Top 14
    { country: 'New Zealand', priority: 98 },    // Super Rugby
    { country: 'South Africa', priority: 92 },    // United Rugby Championship
    { country: 'Ireland', priority: 88 },        // United Rugby Championship
    { country: 'Wales', priority: 85 },          // United Rugby Championship
    { country: 'Scotland', priority: 82 },       // United Rugby Championship
    { country: 'Italy', priority: 78 },          // United Rugby Championship
    { country: 'Australia', priority: 90 },      // Super Rugby
    { country: 'Argentina', priority: 80 },      // Super Rugby
  ],
  'Motorsport': [
    { country: 'International', priority: 100 },     // FIA, Formula 1
    { country: 'United States', priority: 95 },      // NASCAR, IndyCar
    { country: 'Italy', priority: 90 },              // Ferrari, Italian racing
    { country: 'Germany', priority: 88 },            // Mercedes, German racing
    { country: 'United Kingdom', priority: 92 },     // Silverstone, British racing
    { country: 'France', priority: 85 },             // French Grand Prix
    { country: 'Belgium', priority: 82 },            // Spa-Francorchamps
    { country: 'Monaco', priority: 78 },             // Monaco Grand Prix
  ],
  'Volleyball': [
    { country: 'Brazil', priority: 100 },            // World champions
    { country: 'Italy', priority: 95 },              // Serie A1
    { country: 'Poland', priority: 92 },             // PlusLiga
    { country: 'Russia', priority: 90 },             // Super League
    { country: 'United States', priority: 85 },      // NCAA, national team
    { country: 'Turkey', priority: 88 },             // Turkish League
    { country: 'Japan', priority: 82 },              // V.League
    { country: 'Argentina', priority: 78 },          // ACLAV
  ],
  'Handball': [
    { country: 'France', priority: 100 },            // World champions
    { country: 'Germany', priority: 95 },            // Bundesliga
    { country: 'Spain', priority: 92 },              // Liga ASOBAL
    { country: 'Denmark', priority: 98 },            // World champions
    { country: 'Norway', priority: 96 },             // World champions
    { country: 'Sweden', priority: 88 },             // Handbollsligan
    { country: 'Hungary', priority: 85 },            // NB I
    { country: 'Poland', priority: 82 },             // Superliga
  ],
  'Cycling': [
    { country: 'France', priority: 100 },            // Tour de France
    { country: 'Italy', priority: 95 },              // Giro d'Italia
    { country: 'Spain', priority: 92 },              // Vuelta a España
    { country: 'Belgium', priority: 98 },            // Classic races
    { country: 'Netherlands', priority: 88 },        // Dutch cycling
    { country: 'United Kingdom', priority: 85 },     // British Cycling
    { country: 'Denmark', priority: 82 },            // Danish cycling
    { country: 'Switzerland', priority: 78 },        // Swiss cycling
  ],
  'Multi-sport': [
    { country: 'International', priority: 100 },     // IOC, multi-sport events
    { country: 'United States', priority: 95 },      // NCAA, multi-sport orgs
    { country: 'United Kingdom', priority: 90 },     // Multi-sport governance
    { country: 'China', priority: 88 },              // Multi-sport federations
    { country: 'Germany', priority: 85 },            // German sports confederations
    { country: 'France', priority: 82 },             // French sports organizations
    { country: 'Japan', priority: 80 },              // Japanese sports bodies
    { country: 'Australia', priority: 78 },          // Australian sports
  ],
  'Rugby Union': [
    { country: 'New Zealand', priority: 100 },       // All Blacks
    { country: 'South Africa', priority: 98 },       // Springboks
    { country: 'England', priority: 95 },            // Rugby Football Union
    { country: 'France', priority: 92 },             // FFR
    { country: 'Ireland', priority: 90 },            // IRFU
    { country: 'Wales', priority: 88 },              // Welsh Rugby Union
    { country: 'Australia', priority: 85 },          // Rugby Australia
    { country: 'Scotland', priority: 82 },           // Scottish Rugby Union
    { country: 'Argentina', priority: 78 },          // UAR
  ],
  'Formula 1': [
    { country: 'International', priority: 100 },     // FIA, F1 Organization
    { country: 'United Kingdom', priority: 98 },     // Silverstone, British teams
    { country: 'Italy', priority: 95 },              // Monza, Ferrari
    { country: 'Germany', priority: 90 },            // Nürburgring, German GP
    { country: 'France', priority: 85 },             // French Grand Prix
    { country: 'Belgium', priority: 82 },            // Spa-Francorchamps
    { country: 'Monaco', priority: 88 },             // Monaco Grand Prix
    { country: 'United States', priority: 87 },      // F1 in US
  ],
  'Olympic Sports': [
    { country: 'International', priority: 100 },     // IOC
    { country: 'Switzerland', priority: 95 },        // IOC HQ
    { country: 'France', priority: 92 },             // Paris 2024
    { country: 'United States', priority: 90 },      // LA 2028
    { country: 'Australia', priority: 88 },          // Brisbane 2032
    { country: 'Japan', priority: 85 },              // Tokyo 2020
    { country: 'United Kingdom', priority: 82 },     // London 2012
    { country: 'China', priority: 80 },              // Beijing 2022
  ],
  'Golf': [
    { country: 'United States', priority: 100 },     // PGA Tour
    { country: 'United Kingdom', priority: 95 },    // The Open, R&A
    { country: 'Ireland', priority: 90 },            // Golf Ireland
    { country: 'Scotland', priority: 98 },           // St Andrews, home of golf
    { country: 'Australia', priority: 85 },          // Australian Open
    { country: 'Japan', priority: 82 },              // JGTO
    { country: 'South Africa', priority: 78 },       // Sunshine Tour
    { country: 'Spain', priority: 75 },              // Spanish golf
  ],
  'Tennis': [
    { country: 'United Kingdom', priority: 100 },    // Wimbledon
    { country: 'United States', priority: 95 },      // US Open
    { country: 'France', priority: 92 },             // Roland Garros
    { country: 'Australia', priority: 88 },          // Australian Open
    { country: 'Italy', priority: 85 },              // Italian Open
    { country: 'Switzerland', priority: 82 },        // Swiss tennis
    { country: 'Spain', priority: 80 },              // Spanish tennis
    { country: 'Germany', priority: 78 },            // German tennis
  ],
  'Equestrian': [
    { country: 'United Kingdom', priority: 100 },    // British Equestrian
    { country: 'Germany', priority: 95 },            // German equestrian
    { country: 'Netherlands', priority: 92 },        // Dutch equestrian
    { country: 'United States', priority: 90 },      // USEF
    { country: 'France', priority: 88 },             // French equestrian
    { country: 'Sweden', priority: 85 },             // Swedish equestrian
    { country: 'Belgium', priority: 82 },            // Belgian equestrian
    { country: 'Ireland', priority: 80 },            // Irish equestrian
  ],
  'Australian Rules Football': [
    { country: 'Australia', priority: 100 },         // AFL
    { country: 'Victoria', priority: 98 },           // AFL heartland
    { country: 'Western Australia', priority: 85 },  // WAFL
    { country: 'South Australia', priority: 82 },    // SANFL
    { country: 'Queensland', priority: 78 },         // QAFL
    { country: 'New South Wales', priority: 75 },    // NEAFL
  ],
  'Athletics (Track & Field)': [
    { country: 'United States', priority: 100 },     // USA Track & Field
    { country: 'Kenya', priority: 98 },              // Distance running
    { country: 'Jamaica', priority: 95 },            // Sprinting powerhouse
    { country: 'Ethiopia', priority: 92 },           // Distance running
    { country: 'United Kingdom', priority: 88 },     // British Athletics
    { country: 'Germany', priority: 85 },            // German athletics
    { country: 'Russia', priority: 82 },             // Russian athletics
    { country: 'China', priority: 80 },              // Chinese athletics
  ],
  'Badminton': [
    { country: 'China', priority: 100 },             // World powerhouse
    { country: 'Indonesia', priority: 95 },          // Badminton giants
    { country: 'Malaysia', priority: 92 },           // Professional badminton
    { country: 'Denmark', priority: 88 },            // European badminton
    { country: 'Japan', priority: 85 },              // Japanese badminton
    { country: 'India', priority: 82 },              // Growing badminton nation
    { country: 'South Korea', priority: 80 },        // Korean badminton
    { country: 'United Kingdom', priority: 78 },     // British badminton
  ],
  'Cricket (Women\'s)': [
    { country: 'Australia', priority: 100 },         // World champions
    { country: 'England', priority: 95 },            // ECB women's cricket
    { country: 'India', priority: 92 },              // Growing women's cricket
    { country: 'New Zealand', priority: 88 },        // White Ferns
    { country: 'South Africa', priority: 85 },       // Proteas women
    { country: 'West Indies', priority: 82 },        // West Indies women
    { country: 'Pakistan', priority: 78 },           // Emerging women's cricket
    { country: 'Sri Lanka', priority: 75 },          // Sri Lanka women
  ],
  'Cricket (First-Class)': [
    { country: 'England', priority: 100 },           // County Championship
    { country: 'Australia', priority: 98 },          // Sheffield Shield
    { country: 'India', priority: 95 },              // Ranji Trophy
    { country: 'South Africa', priority: 92 },       // CSA First Class
    { country: 'New Zealand', priority: 88 },        // Plunket Shield
    { country: 'Pakistan', priority: 85 },           // Quaid-e-Azam Trophy
    { country: 'Sri Lanka', priority: 82 },          // SLC First Class
    { country: 'West Indies', priority: 78 },        // Regional First Class
  ],
  'Other Sports': [
    { country: 'International', priority: 50 }
  ]
};

// Helper function to get sport popularity
function getSportPopularity(sport: string): number {
  const sportData = SPORT_COUNTRY_POPULARITY[sport];
  return sportData ? Math.max(...sportData.map(s => s.priority)) : 20;
}

export default function LeagueNavSimple() {
  const router = useRouter()
  const params = useParams()
  const entityId = params.entityId as string || '197'
  
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedSport, setSelectedSport] = useState<string | null>(null)
  const [selectedLeague, setSelectedLeague] = useState<LeagueData | null>(null)
  const [currentClubIndex, setCurrentClubIndex] = useState(0)
  const [isNavigating, setIsNavigating] = useState(false)
  
  // API calls - use lightweight summaries for navigation, full entity data only when needed
  const currentEntityData = useEntity(entityId).entity
  const { summaries, error: summaryError, isLoading: summariesLoading } = useEntitySummaries('/api/entities/summary')
  
  // Cache for full entity data to avoid re-fetching
  const [fullEntitiesCache, setFullEntitiesCache] = useState<Map<string, any>>(new Map())
  const [loadingEntity, setLoadingEntity] = useState<string | null>(null)
  
  // Lazy load full entity when needed
  const loadFullEntity = async (entityId: string) => {
    if (fullEntitiesCache.has(entityId)) {
      return fullEntitiesCache.get(entityId)
    }
    
    setLoadingEntity(entityId)
    try {
      const response = await fetch(`/api/entities/${entityId}`)
      const data = await response.json()
      fullEntitiesCache.set(entityId, data.entity)
      return data.entity
    } catch (error) {
      console.error('Failed to load full entity:', error)
      return null
    } finally {
      setLoadingEntity(null)
    }
  }
  
  // Vector search using existing hook
  const { results: vectorResults, loading: isVectorSearching } = useVectorSearch(
    searchTerm,
    { limit: 10, threshold: 0.3, entityType: '' },
    'vector'
  )
  
  // Process entity summaries for navigation
  const sportsData = useMemo(() => {
    if (!summaries?.length) return []
    
    console.log('🔍 LeagueNavSimple: Processing', summaries.length, 'entity summaries')
    console.log('📊 Summary API result count:', summaries.length)
    
    // Convert summaries to entity format for processing
    const entities = summaries.map(summary => ({
      id: summary.id,
      neo4j_id: summary.neo4j_id,
      properties: {
        name: summary.name,
        type: summary.type,
        sport: summary.sport,
        country: summary.country,
        league: summary.league,
        level: summary.level
      }
    }))
    
    console.log('🎯 LeagueNavSimple: Found', entities.length, 'entities with sport property')
    console.log('📋 LeagueNavSimple: Sports found:', [...new Set(entities.map(e => e.properties.sport))])
    
    // Group by sport
    const sportMap = new Map<string, LeagueData[]>()
    
    entities.forEach(entity => {
      const sport = entity.properties.sport || 'Other Sports'
      
      if (!sportMap.has(sport)) {
        sportMap.set(sport, [])
      }
      
      const sportLeagues = sportMap.get(sport)!
      
      // Determine group name based on entity type
      let groupName = 'General'
      if (entity.properties.league) {
        groupName = entity.properties.league
      } else if (entity.properties.type === 'Federation') {
        groupName = 'Federations'
      } else if (entity.properties.type === 'Organization') {
        groupName = 'Organizations'
      } else if (entity.properties.type === 'Tournament') {
        groupName = 'Tournaments'
      } else if (entity.properties.type === 'League') {
        groupName = 'Leagues'
      } else if (entity.properties.type === 'Club') {
        groupName = entity.properties.league || 'Clubs'
      }
      
      let league = sportLeagues.find(l => l.league === groupName)
      if (!league) {
        league = {
          league: groupName,
          popularity: getLeaguePopularity(groupName),
          country: entity.properties.country || 'International',
          clubs: []
        }
        sportLeagues.push(league)
      }
      
      league.clubs.push(entity)
    })
    
    // Sort clubs alphabetically within each league
    sportMap.forEach(leagues => {
      leagues.forEach(league => {
        league.clubs.sort((a, b) => {
          const aName = a.properties?.name || ''
          const bName = b.properties?.name || ''
          return aName.localeCompare(bName)
        })
      })
      // Sort leagues by popularity within each sport
      leagues.sort((a, b) => b.popularity - a.popularity)
    })
    
    // Sort leagues by country dominance within each sport
    sportMap.forEach((leagues, sport) => {
      const countryPriorities = SPORT_COUNTRY_POPULARITY[sport] || [{country: 'International', priority: 50}];
      
      leagues.forEach(league => {
        // Find country priority for this league
        const countryPriority = countryPriorities.find(cp => 
          cp.country === league.country || cp.country === 'International'
        );
        league.popularity = countryPriority ? countryPriority.priority : 50;
      });
      
      // Sort leagues by country priority (descending)
      leagues.sort((a, b) => b.popularity - a.popularity);
    });
    
    // Convert to sport objects and sort by overall sport popularity
    const result = Array.from(sportMap.entries())
      .map(([sport, leagues]) => ({
        sport,
        popularity: getSportPopularity(sport),
        leagues
      }))
      .sort((a, b) => b.popularity - a.popularity)
    
    console.log('🏆 LeagueNavSimple: Final result -', result.length, 'sports:', result.map(s => ({ sport: s.sport, count: s.leagues.reduce((sum, l) => sum + l.clubs.length, 0) })))
    
    return result
  }, [summaries])
  
  // Get current club and league for navigation
  const currentClub = useMemo(() => {
    // First check if we have cached full entity data
    if (fullEntitiesCache.has(entityId)) {
      return fullEntitiesCache.get(entityId)
    }
    
    // Then check if current entity data is available
    if (currentEntityData) {
      return currentEntityData
    }
    
    // Fallback to summary data
    const allLeagues = sportsData.flatMap(sport => sport.leagues)
    const allClubs = allLeagues.flatMap(league => league.clubs)
    return allClubs.find(club => club.id === entityId)
  }, [sportsData, entityId, currentEntityData, fullEntitiesCache])
  
  const currentLeague = useMemo(() => {
    if (!currentClub) return null
    
    const leagueName = currentClub.properties?.league || currentClub.league
    if (!leagueName) return null
    
    for (const sport of sportsData) {
      const league = sport.leagues.find(l => l.league === leagueName)
      if (league) return league
    }
    return null
  }, [sportsData, currentClub])
  
  // Set current club index based on URL
  useEffect(() => {
    if (currentLeague && !isNavigating) {
      const index = currentLeague.clubs.findIndex(club => club.id === entityId)
      if (index !== -1) {
        setCurrentClubIndex(index)
      }
    }
  }, [currentLeague, entityId, isNavigating])
  
  // Navigation handlers with lazy loading
  const navigateToClub = async (club: Club | any) => {
    setIsNavigating(true)
    
    // If we don't have full entity data yet, load it
    if (!fullEntitiesCache.has(club.id) && club.id !== entityId) {
      await loadFullEntity(club.id)
    }
    
    router.push(`/entity/${club.id}`)
    setTimeout(() => setIsNavigating(false), 500)
  }
  
  const handleUp = () => {
    if (!currentLeague || isNavigating) return
    
    const newIndex = currentClubIndex > 0 ? currentClubIndex - 1 : currentLeague.clubs.length - 1
    setCurrentClubIndex(newIndex)
    navigateToClub(currentLeague.clubs[newIndex])
  }
  
  const handleDown = () => {
    if (!currentLeague || isNavigating) return
    
    const newIndex = currentClubIndex < currentLeague.clubs.length - 1 ? currentClubIndex + 1 : 0
    setCurrentClubIndex(newIndex)
    navigateToClub(currentLeague.clubs[newIndex])
  }
  
  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isModalOpen) return
      
      if (event.key === 'ArrowUp') {
        event.preventDefault()
        handleUp()
      } else if (event.key === 'ArrowDown') {
        event.preventDefault()
        handleDown()
      }
    }
    
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isModalOpen, currentClubIndex, currentLeague])
  
  // Enhanced search with vector results
  const searchResults = useMemo(() => {
    if (!searchTerm || searchTerm.length < 2) return { type: 'browsing', data: sportsData }
    
    // If vector search results exist, prioritize them
    if (vectorResults?.length > 0) {
      return { type: 'vector', data: vectorResults }
    }
    
    // Fallback to local search
    const term = searchTerm.toLowerCase()
    const localResults = sportsData.map(sport => ({
      ...sport,
      leagues: sport.leagues
        .map(league => ({
          ...league,
          clubs: league.clubs.filter(club => 
            club.properties.name.toLowerCase().includes(term) ||
            league.league.toLowerCase().includes(term)
          )
        }))
        .filter(league => league.clubs.length > 0)
    })).filter(sport => sport.leagues.length > 0)
    
    return { type: 'local', data: localResults }
  }, [sportsData, searchTerm, vectorResults])
  
  // Handle Enter key for quick navigation
  const handleSearchSubmit = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && searchResults.type === 'vector' && searchResults.data.length > 0) {
      // Convert vector search result to entity format
      const result = searchResults.data[0]
      const clubEntity = {
        id: result.entity.id,
        properties: {
          name: result.entity.properties.name,
          league: result.entity.properties.league,
          country: result.entity.properties.country,
          type: result.entity.properties.type,
          sport: result.entity.properties.sport
        }
      }
      navigateToClub(clubEntity)
      setIsModalOpen(false)
      setSearchTerm('')
    }
  }
  
  const displayLeague = selectedLeague || currentLeague
  const displaySport = selectedSport || currentLeague?.sport
  
  return (
    <div className="flex items-center gap-2">
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[500px] bg-header-bg">
          <DialogHeader>
            <DialogTitle>
              {displaySport ? `${displaySport} → ${displayLeague?.league}` : 'Select Sport'}
            </DialogTitle>
            <DialogDescription>
              {displaySport 
                ? `Browse ${displayLeague?.clubs?.length || 0} clubs in ${displayLeague?.league}`
                : 'Choose a sport to browse leagues and clubs'
              }
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Search bar */}
            <div className="relative">
              <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground ${isVectorSearching ? 'animate-pulse' : ''}`} />
              <Input
                placeholder="Search clubs, leagues, or type for similar entities..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={handleSearchSubmit}
                className={`pl-10 bg-white/10 border-white/20 text-white placeholder:text-white/60 ${isVectorSearching ? 'opacity-80' : ''}`}
                disabled={isVectorSearching}
              />
              {isVectorSearching && (
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                </div>
              )}
            </div>
            
            {/* Navigation */}
            {selectedSport && (
              <Button 
                variant="ghost" 
                onClick={() => setSelectedSport(null)}
                className="text-white hover:bg-white/10"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                All Sports
              </Button>
            )}
            
            {/* Content */}
            {searchResults.type === 'vector' ? (
              // Vector search results
              <div className="max-h-[400px] overflow-y-auto space-y-2">
                <div className="text-sm text-white/60 mb-2">
                  Vector search results for "{searchTerm}"
                </div>
                {searchResults.data.map((result: any, index: number) => (
                  <div
                    key={result.entity.id}
                    className="flex items-center justify-between p-3 rounded-lg cursor-pointer hover:bg-white/10 text-white"
                    onClick={() => {
                      // Convert vector result to entity format
                      const clubEntity = {
                        id: result.entity.id,
                        properties: {
                          name: result.entity.properties.name,
                          league: result.entity.properties.league,
                          country: result.entity.properties.country,
                          type: result.entity.properties.type,
                          sport: result.entity.properties.sport
                        }
                      }
                      navigateToClub(clubEntity)
                      setIsModalOpen(false)
                      setSearchTerm('')
                    }}
                  >
                    <div>
                      <div className="font-medium">{result.entity.properties.name}</div>
                      <div className="text-sm text-white/60">
                        {result.entity.properties.league} • {result.entity.properties.country}
                      </div>
                      <div className="text-xs text-yellow-400">
                        {Math.round(result.similarity * 100)}% match
                      </div>
                    </div>
                    <div className="text-sm text-white/60">→</div>
                  </div>
                ))}
              </div>
            ) : !selectedSport ? (
              // Sports view
              <div className="max-h-[400px] overflow-y-auto space-y-2">
                {searchResults.data.map((sport: any) => (
                  <div
                    key={sport.sport}
                    className="flex items-center justify-between p-3 rounded-lg cursor-pointer hover:bg-white/10 text-white"
                    onClick={() => setSelectedSport(sport.sport)}
                  >
                    <div>
                      <div className="font-medium">{sport.sport}</div>
                      <div className="text-sm text-white/60">
                        {sport.leagues.length} leagues • {sport.leagues.reduce((sum, l) => sum + l.clubs.length, 0)} clubs
                      </div>
                    </div>
                    <div className="text-sm text-white/60">→</div>
                  </div>
                ))}
              </div>
            ) : (
              // Leagues view for selected sport
              <div className="max-h-[400px] overflow-y-auto space-y-2">
                {searchResults.data
                  .find((s: any) => s.sport === selectedSport)
                  ?.leagues.map((league: any) => (
                    <div
                      key={league.league}
                      className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${
                        currentLeague?.league === league.league 
                          ? 'bg-blue-600 text-white' 
                          : 'hover:bg-white/10 text-white'
                      }`}
                      onClick={() => {
                        setSelectedLeague(league)
                        setSelectedSport(null)
                        // Navigate to first club in league
                        if (league.clubs.length > 0) {
                          navigateToClub(league.clubs[0])
                        }
                      }}
                    >
                      <div>
                        <div className="font-medium">{league.league}</div>
                        <div className="text-sm text-white/60">
                          {league.country} • {league.clubs.length} clubs
                        </div>
                      </div>
                      <div className="text-sm text-white/60">→</div>
                    </div>
                  ))}
              </div>
            )}
            
            {/* Status */}
            <div className="flex items-center justify-between pt-4 border-t border-white/20">
              <div className="text-sm text-white/60">
                {searchResults.type === 'vector' 
                  ? `Found ${searchResults.data.length} similar entities for "${searchTerm}"`
                  : searchTerm
                  ? `Found ${searchResults.data.reduce((sum: any, s: any) => sum + s.leagues.length, 0)} leagues in ${searchResults.data.length} sports`
                  : `Browsing: ${displaySport || 'All Sports'}`
                }
              </div>
              <Button onClick={() => setIsModalOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Badge */}
      <div 
        className="cursor-pointer"
        onClick={() => setIsModalOpen(true)}
      >
        <EntityBadge 
          entity={currentClub} 
          size="xl" 
          className={`transition-all ${isNavigating ? 'opacity-60 scale-95' : ''}`}
        />
      </div>

      {/* Navigation buttons */}
      <div className="flex flex-col gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleUp}
          disabled={!currentLeague || currentClubIndex === 0 || isNavigating}
          className="text-white hover:bg-white/10 disabled:opacity-50"
        >
          <ChevronUp className="h-4 w-4" />
        </Button>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDown}
          disabled={!currentLeague || currentClubIndex === currentLeague.clubs.length - 1 || isNavigating}
          className="text-white hover:bg-white/10 disabled:opacity-50"
        >
          <ChevronDown className="h-4 w-4" />
        </Button>
      </div>

      {/* Club info */}
      <div className="min-w-[120px]">
        <div className="text-white text-3xl font-extrabold mb-1">
          {currentClub?.properties?.name || 'Loading...'}
        </div>
        <div className="text-white/60 text-xl">
          {currentLeague?.league} / {currentClub?.properties?.country}
        </div>
      </div>
    </div>
  )
}

// Helper function for league popularity
function getLeaguePopularity(leagueName: string): number {
  const leagueLower = leagueName.toLowerCase()
  
  // Top-tier global leagues
  if (leagueLower.includes('premier league')) return 100
  if (leagueLower.includes('laliga')) return 95
  if (leagueLower.includes('bundesliga')) return 90
  if (leagueLower.includes('nba')) return 95
  if (leagueLower.includes('serie a')) return 85
  if (leagueLower.includes('ligue 1')) return 80
  
  // Major international competitions
  if (leagueLower.includes('champions league')) return 110
  if (leagueLower.includes('world cup')) return 130
  if (leagueLower.includes('euro')) return 120
  
  // Second-tier leagues
  if (leagueLower.includes('championship')) return 75
  if (leagueLower.includes('ligue 2')) return 70
  if (leagueLower.includes('2. bundesliga')) return 72
  
  // Default popularity
  return 50
}