'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EntityBadge } from '@/components/badge/EntityBadge';
import { useEntities, useEntity } from '@/lib/swr-config';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ChevronUp, ChevronDown, Search } from 'lucide-react';

interface Club {
  id: string
  neo4j_id: string
  labels: string[]
  properties: {
    name: string
    level?: string
    league?: string
    competition?: string
    sport: string
    type: string
    country?: string
    [key: string]: any
  }
}

export default function LeagueNav() {
  const router = useRouter()
  const params = useParams()
  const entityId = params.entityId as string || '197'
  
  // ALL HOOKS MUST BE DECLARED BEFORE ANY CONDITIONAL RETURNS
  const [isMounted, setIsMounted] = useState(false)
  const [selectedSportIndex, setSelectedSportIndex] = useState(0)
  const [selectedLeagueIndex, setSelectedLeagueIndex] = useState(0)
  const [selectedClubIndex, setSelectedClubIndex] = useState(0)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isHoveringBadge, setIsHoveringBadge] = useState(false)
  const [isNavigating, setIsNavigating] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('')
  const [modalStep, setModalStep] = useState<'sport' | 'league'>('sport')
  const [selectedSportInModal, setSelectedSportInModal] = useState<string | null>(null)
  
  // API calls - MUST be before conditional returns
  const currentEntityData = useEntity(entityId).entity
  const { entities, error: entitiesError, isLoading: entitiesLoading } = useEntities(
    '/api/entities?leagues=premier,laliga,nba,seriea,bundesliga,ligue1&limit=150'
  )
  
  // Client-side mount effect
  useEffect(() => {
    setIsMounted(true)
  }, [])
  
  // Navigation handlers
  const handleClubSelect = (club: Club) => {
    setIsNavigating(true)
    router.push(`/entity/${club.id}`)
    setIsModalOpen(false)
    setTimeout(() => setIsNavigating(false), 500)
  }
  
  // Sports data grouping
  const sportsData = useMemo(() => {
    if (!entities) {
      return []
    }
    
    const getSportCategory = (sport: string, leagueName: string) => {
      const sportLower = sport.toLowerCase()
      const leagueLower = leagueName.toLowerCase()
      
      if (sportLower.includes('football') || sportLower.includes('soccer') || 
          leagueLower.includes('premier') || leagueLower.includes('liga') || 
          leagueLower.includes('bundesliga') || leagueLower.includes('serie') ||
          leagueLower.includes('ligue') || leagueLower.includes('champions')) {
        return 'Football'
      }
      
      if (sportLower.includes('basketball') || leagueLower.includes('basketball') ||
          leagueLower.includes('nba') || leagueLower.includes('euro')) {
        return 'Basketball'
      }
      
      if (sportLower.includes('rugby') || leagueLower.includes('rugby')) {
        return 'Rugby'
      }
      
      if (sportLower.includes('cricket') || leagueLower.includes('cricket') ||
          leagueLower.includes('premiership') || leagueLower.includes('trophy')) {
        return 'Cricket'
      }
      
      if (sportLower.includes('handball') || leagueLower.includes('handball')) {
        return 'Handball'
      }
      
      if (sportLower.includes('racing') || sportLower.includes('formula') || 
          leagueLower.includes('formula') || leagueLower.includes('indycar') ||
          leagueLower.includes('nascar') || leagueLower.includes('motogp')) {
        return 'Motorsports'
      }
      
      if (sportLower.includes('baseball') || leagueLower.includes('baseball') ||
          leagueLower.includes('mlb') || leagueLower.includes('baseball')) {
        return 'Baseball'
      }
      
      if (sportLower.includes('hockey') || leagueLower.includes('hockey') ||
          leagueLower.includes('nhl') || leagueLower.includes('hockey')) {
        return 'Hockey'
      }
      
      if (sportLower.includes('volleyball') || leagueLower.includes('volleyball')) {
        return 'Volleyball'
      }
      
      if (sportLower.includes('cycling') || leagueLower.includes('uci') ||
          leagueLower.includes('tour') || leagueLower.includes('cycling')) {
        return 'Cycling'
      }
      
      return 'Other Sports'
    }
    
    const clubs = entities.entities.filter((entity: any) => {
      const name = entity.properties?.name?.toLowerCase() || ''
      const type = entity.properties?.type?.toLowerCase() || ''
      const labels = (entity.labels || [])?.map((l: string) => l?.toLowerCase() || '') || []
      const level = entity.properties?.level || entity.properties?.league || entity.properties?.competition
      const sport = entity.properties?.sport?.toLowerCase() || ''
      const league = entity.properties?.league || ''
      
      // More inclusive club detection - check if it's actually a sports team
      const isClubByType = type.includes('club') || type.includes('team')
      const isClubByLabel = labels.some(label => label?.includes('club') || label?.includes('team'))
      const isClubBySport = sport.includes('football') || sport.includes('soccer') || sport.includes('basketball')
      const hasTeamLikeName = !name.includes('league') && !name.includes('cup') && !name.includes('championship')
      
      // Exclude obvious competition entities
      const isCompetitionOrGoverningBody = labels.some(label => 
        label?.includes('competition') || 
        label?.includes('governing') || 
        label?.includes('federation') || 
        label?.includes('association')
      )
      
      // Only exclude competition names that are clearly not team names
      const isLeagueCompetition = [
        'champions league', 'europa league', 'copa del rey', 'fa cup',
        'uefa', 'fifa', 'concacaf', 'conmebol', 'caf', 'afc'
      ].some(competition => name.includes(competition))
      
      const hasLeague = !!level && level.trim().length > 0
      const isClub = (isClubByType || isClubByLabel || isClubBySport) && hasTeamLikeName
      
      return isClub && hasLeague && !isCompetitionOrGoverningBody && !isLeagueCompetition
    }) as Club[]
    
    // Remove duplicates based on team name (case insensitive)
    const uniqueClubs = clubs.filter((club, index, self) => 
      index === self.findIndex((c) => 
        c.properties?.name?.toLowerCase() === club.properties?.name?.toLowerCase()
      )
    )
    
    const sportMap = new Map<string, Array<{league: string, clubs: Club[]}>>()
    
    uniqueClubs.forEach(club => {
      const sportCategory = getSportCategory(club.properties.sport || '', club.properties.level || '')
      
      if (!sportMap.has(sportCategory)) {
        sportMap.set(sportCategory, [])
      }
      
      const sportLeagues = sportMap.get(sportCategory)!
      
      let clubLeague = club.properties.league || club.properties.level || club.properties.competition
      
      // Normalize league names for consistency
      if (clubLeague) {
        clubLeague = clubLeague
          .replace('Championship', 'English League Championship')
          .replace('EFL Championship', 'English League Championship')
          .replace('Premier League', 'Premier League') // Keep as is
          .replace('League One', 'League One') // Keep as is
          .replace('League Two', 'League Two') // Keep as is
      }
      
      let leagueEntry = sportLeagues.find(l => l.league === clubLeague)
      if (!leagueEntry) {
        leagueEntry = { league: clubLeague, clubs: [] }
        sportLeagues.push(leagueEntry)
      }
      
      leagueEntry.clubs.push(club)
    })
    
    sportMap.forEach(sportLeagues => {
      sportLeagues.forEach(leagueEntry => {
        leagueEntry.clubs.sort((a, b) => a.properties.name.localeCompare(b.properties.name))
      })
      sportLeagues.sort((a, b) => a.league.localeCompare(b.league))
    })
    
    const result = Array.from(sportMap.entries())
      .map(([sport, leagues]) => ({ sport, leagues }))
      .sort((a, b) => a.sport.localeCompare(b.sport))
    
    return result
  }, [entities])
  
  // Current entity indices
  const { currentSportIndex, currentLeagueIndex, currentClubIndex } = useMemo(() => {
    if (!currentEntityData?.entity || !sportsData.length) {
      console.log('🏆 Calculated indices: No data, returning defaults', {
        hasCurrentEntity: !!currentEntityData?.entity,
        sportsDataLength: sportsData.length,
        entityId
      })
      return { currentSportIndex: 0, currentLeagueIndex: 0, currentClubIndex: 0 }
    }
    
    const currentClub = currentEntityData.entity as Club
    let currentClubLeague = currentClub.properties?.level || currentClub.properties?.league || currentClub.properties?.competition
    const currentClubName = currentClub.properties?.name
    
    // Normalize current league name for consistency
    if (currentClubLeague) {
      currentClubLeague = currentClubLeague
        .replace('Championship', 'English League Championship')
        .replace('EFL Championship', 'English League Championship')
        .replace('Premier League', 'Premier League')
        .replace('League One', 'League One')
        .replace('League Two', 'League Two')
        .replace('EFL League One', 'League One')
        .replace('EFL League Two', 'League Two')
        .replace('Tier 3', 'League One')
        .replace('Tier 2', 'English League Championship')
        .replace('Tier 4', 'League Two')
    }
    
    console.log('🏆 Calculating indices for:', {
      currentClubId: currentClub.id,
      currentClubNeo4jId: currentClub.neo4j_id,
      currentClubName,
      currentClubLeague,
      sportsDataLength: sportsData.length,
      sportsDataStructure: sportsData.map(s => ({
        sport: s.sport,
        leaguesCount: s.leagues.length,
        totalClubs: s.leagues.reduce((sum, l) => sum + l.clubs.length, 0)
      }))
    })
    
    for (let sportIndex = 0; sportIndex < sportsData.length; sportIndex++) {
      const sport = sportsData[sportIndex]
      for (let leagueIndex = 0; leagueIndex < sport.leagues.length; leagueIndex++) {
        const league = sport.leagues[leagueIndex]
        if (league.league === currentClubLeague) {
          // Try multiple ID matching strategies
          const clubIndex = league.clubs.findIndex(club => {
            // Direct ID match
            if (club.id === currentClub.id) return true
            // Neo4j ID match  
            if (club.neo4j_id === currentClub.neo4j_id) return true
            // Cross-format ID match (numeric vs UUID)
            if (club.id === entityId) return true
            if (club.neo4j_id === entityId) return true
            // Name-based fallback
            if (club.properties?.name === currentClubName) return true
            return false
          })
          
          if (clubIndex !== -1) {
            const foundClub = league.clubs[clubIndex]
            console.log('🏆 Calculated indices found:', {
              currentSportIndex: sportIndex,
              currentLeagueIndex: leagueIndex,
              currentClubIndex: clubIndex,
              sportName: sport.sport,
              leagueName: league.league,
              clubName: foundClub?.properties?.name,
              clubId: foundClub?.id,
              clubNeo4jId: foundClub?.neo4j_id,
              matchType: foundClub?.id === currentClub.id ? 'direct_id' :
                        foundClub?.neo4j_id === currentClub.neo4j_id ? 'neo4j_id' :
                        foundClub?.id === entityId ? 'entity_id' :
                        foundClub?.neo4j_id === entityId ? 'entity_neo4j_id' :
                        'name_match',
              clubsInLeague: league.clubs.length
            })
            return { currentSportIndex: sportIndex, currentLeagueIndex: leagueIndex, currentClubIndex: clubIndex }
          }
        }
      }
    }
    
    console.log('🏆 Calculated indices: No match found, returning defaults', {
      currentClubId: currentClub.id,
      currentClubNeo4jId: currentClub.neo4j_id,
      currentClubName,
      currentClubLeague,
      entityId,
      availableLeagues: sportsData.flatMap(s => s.leagues.map(l => l.league)),
      debugInfo: {
        hasCurrentClubId: !!currentClub.id,
        hasCurrentClubNeo4jId: !!currentClub.neo4j_id,
        entityIdValue: entityId,
        idMatch: currentClub.id === entityId,
        neo4jIdMatch: currentClub.neo4j_id === entityId
      }
    })
    return { currentSportIndex: 0, currentLeagueIndex: 0, currentClubIndex: 0 }
  }, [currentEntityData, sportsData, entityId])
  
  // Compatibility: Generate flat leaguesData for existing code
  const leaguesData = useMemo(() => {
    return sportsData.flatMap(sport => 
      sport.leagues.map(league => ({
        league: league.league,
        clubs: league.clubs
      }))
    )
  }, [sportsData])
  
  // Filtered data for search with popularity-based ranking and direct entity matching
  const filteredSportsData = useMemo(() => {
    if (!debouncedSearchTerm) {
      return sportsData
    }

    const searchTermLower = debouncedSearchTerm.toLowerCase()
    
    // Check for exact entity match first
    const exactEntityMatch = entities?.find((entity: any) => 
      entity.properties?.name?.toLowerCase() === searchTermLower
    )
    
    // If exact match found, navigate directly to that entity
    if (exactEntityMatch && !isModalOpen) {
      console.log('🎯 Exact entity match found:', exactEntityMatch.properties.name)
      handleClubSelect(exactEntityMatch)
      return sportsData // Return normal data to prevent UI flicker
    }
    
    // Define league popularity scores for ranking
    const leaguePopularity: { [key: string]: number } = {
      // Football - Major European leagues (highest popularity)
      'Premier League': 100,
      'LaLiga': 95,
      'Bundesliga': 90,
      'Serie A': 85,
      'Ligue 1': 80,
      'English League Championship': 75,
      'UEFA Champions League': 110,
      'UEFA Europa League': 105,
      'UEFA Euro': 120,
      'FIFA World Cup': 130,
      // Other major leagues
      'MLS': 70,
      'Eredivisie': 65,
      'Primeira Liga': 60,
      'Liga MX': 55,
      'Saudi Pro League': 50,
      'Chinese Super League': 45,
      'Australian A-League': 40,
      'Japanese J1 League': 48,
      'Korean K League 1': 46,
      'Brazilian Serie A': 72,
      'Argentine Primera División': 68,
      // Lower priority leagues
      'League One': 35,
      'League Two': 30,
      'Scottish Premiership': 38,
      'Turkish Süper Lig': 42,
      'Russian Premier League': 43,
      // International competitions
      'Copa Libertadores': 85,
      'Copa Sudamericana': 75,
      'AFC Champions League': 70,
      'CONCACAF Champions League': 65,
      'CAF Champions League': 60,
      // Default for unknown leagues
      'default_league': 20
    }
    
    return sportsData
      .map(sport => ({
        ...sport,
        leagues: sport.leagues
          .map(league => {
            const filteredClubs = league.clubs.filter(club => 
              club.properties.name.toLowerCase().includes(searchTermLower) ||
              league.league.toLowerCase().includes(searchTermLower) ||
              sport.sport.toLowerCase().includes(searchTermLower) ||
              (club.properties.country && club.properties.country.toLowerCase().includes(searchTermLower)) ||
              (club.properties.level && club.properties.level.toLowerCase().includes(searchTermLower)) ||
              (club.properties.league && club.properties.league.toLowerCase().includes(searchTermLower)) ||
              (club.properties.competition && club.properties.competition.toLowerCase().includes(searchTermLower))
            )
            
            return {
              ...league,
              clubs: filteredClubs.sort((a, b) => {
                const aName = a.properties.name.toLowerCase()
                const bName = b.properties.name.toLowerCase()
                const searchTerm = searchTermLower
                
                // Priority 1: Exact name match
                if (aName === searchTerm && bName !== searchTerm) return -1
                if (bName === searchTerm && aName !== searchTerm) return 1
                
                // Priority 2: Starts with search term
                const aStarts = aName.startsWith(searchTerm)
                const bStarts = bName.startsWith(searchTerm)
                if (aStarts && !bStarts) return -1
                if (bStarts && !aStarts) return 1
                
                // Priority 3: League popularity boost
                const aLeaguePopScore = leaguePopularity[a.properties.league || a.properties.level] || leaguePopularity.default_league
                const bLeaguePopScore = leaguePopularity[b.properties.league || b.properties.level] || leaguePopularity.default_league
                
                // Priority 3: League popularity
                if (aLeaguePopScore !== bLeaguePopScore) {
                  return bLeaguePopScore - aLeaguePopScore // Higher score first
                }
                
                // Priority 4: Alphabetical
                return aName.localeCompare(bName)
              }),
              popularityScore: leaguePopularity[league.league] || leaguePopularity.default_league
            }
          })
          .filter(league => league.clubs.length > 0)
          .sort((a, b) => {
            // Sort leagues by popularity score, then alphabetically
            if (a.popularityScore !== b.popularityScore) {
              return b.popularityScore - a.popularityScore
            }
            return a.league.localeCompare(b.league)
          })
      }))
      .filter(sport => sport.leagues.length > 0)
  }, [sportsData, debouncedSearchTerm, entities, isModalOpen])

  const filteredLeaguesForSelectedSport = useMemo(() => {
    if (!selectedSportInModal) return []
    
    const selectedSport = filteredSportsData.find(s => s.sport === selectedSportInModal)
    return selectedSport?.leagues || []
  }, [selectedSportInModal, filteredSportsData])
  
  // Current selections
  const currentSport = sportsData[selectedSportIndex]
  const currentLeague = currentSport?.leagues[selectedLeagueIndex]
  const currentClub = currentLeague?.clubs[selectedClubIndex]
  
  // Initialize state with calculated values only on mount or when no navigation is active
  useEffect(() => {
    if (!isNavigating && !isModalOpen) {
      console.log('🏆 State sync useEffect:', {
        reason: 'Syncing calculated values',
        currentSportIndex,
        currentLeagueIndex,
        currentClubIndex,
        selectedSportIndex,
        selectedLeagueIndex,
        selectedClubIndex,
        isNavigating,
        isModalOpen
      })
      setSelectedSportIndex(currentSportIndex)
      setSelectedLeagueIndex(currentLeagueIndex)
      setSelectedClubIndex(currentClubIndex)
    } else {
      console.log('🏆 State sync useEffect SKIPPED:', {
        reason: isNavigating ? 'Navigation in progress' : 'Modal is open',
        currentSportIndex,
        currentLeagueIndex,
        currentClubIndex,
        selectedSportIndex,
        selectedLeagueIndex,
        selectedClubIndex,
        isNavigating,
        isModalOpen
      })
    }
  }, [currentSportIndex, currentLeagueIndex, currentClubIndex, isNavigating, isModalOpen])
  
  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm)
    }, 300)

    return () => clearTimeout(timer)
  }, [searchTerm])
  
  // Reset to first club when changing leagues
  useEffect(() => {
    if (!isNavigating) {
      setSelectedClubIndex(0)
    }
  }, [selectedLeagueIndex, isNavigating])
  
  // Sync navigation state with current entity from URL
  useEffect(() => {
    if (currentEntityData?.entity && sportsData.length > 0) {
      const currentClub = currentEntityData.entity as Club
      const currentClubId = currentClub.id.toString()
      const currentClubName = currentClub.properties?.name
      let currentClubLeague = currentClub.properties?.level || currentClub.properties?.league || currentClub.properties?.competition
      
      // Normalize current league name for consistency
      if (currentClubLeague) {
        currentClubLeague = currentClubLeague
          .replace('Championship', 'English League Championship')
          .replace('EFL Championship', 'English League Championship')
          .replace('Premier League', 'Premier League')
          .replace('League One', 'League One')
          .replace('League Two', 'League Two')
      }
      
      console.log('🏆 URL sync useEffect:', {
        currentClubId,
        currentClubName,
        currentClubLeague,
        sportsDataLength: sportsData.length,
        isNavigating
      })
      
      let foundMatch = false
      let targetSportIndex = -1
      let targetLeagueIndex = -1
      let targetClubIndex = -1
      
      // Search for matching club in hierarchical sportsData structure
      for (let sportIndex = 0; sportIndex < sportsData.length; sportIndex++) {
        const sport = sportsData[sportIndex]
        for (let leagueIndex = 0; leagueIndex < sport.leagues.length; leagueIndex++) {
          const league = sport.leagues[leagueIndex]
          const clubIndex = league.clubs.findIndex(club => club.id.toString() === currentClubId)
          
          if (clubIndex !== -1) {
            targetSportIndex = sportIndex
            targetLeagueIndex = leagueIndex
            targetClubIndex = clubIndex
            foundMatch = true
            console.log('🏆 URL sync found match:', {
              targetSportIndex,
              targetLeagueIndex,
              targetClubIndex,
              sportName: sport.sport,
              leagueName: league.league,
              clubName: league.clubs[clubIndex]?.properties?.name
            })
            break
          }
        }
        if (foundMatch) break
      }
      
      if (foundMatch) {
        setSelectedSportIndex(targetSportIndex)
        setSelectedLeagueIndex(targetLeagueIndex)
        setSelectedClubIndex(targetClubIndex)
        console.log('🏆 URL sync applied:', {
          targetSportIndex,
          targetLeagueIndex,
          targetClubIndex
        })
      } else {
        console.log('🏆 URL sync: No match found for current club')
      }
    }
  }, [currentEntityData, sportsData, entityId])
  
  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Disable keyboard navigation on entity browser page
      if (typeof window !== 'undefined' && window.location.pathname === '/entity-browser') {
        return
      }
      
      if (isModalOpen) return
      
      if (event.key === 'ArrowUp') {
        console.log('🏆 ARROW UP KEY DETECTED - attempting navigation')
        event.preventDefault()
        handleUp()
      } else if (event.key === 'ArrowDown') {
        console.log('🏆 ARROW DOWN KEY DETECTED - attempting navigation')
        event.preventDefault()
        handleDown()
      } else if (event.key === 'Enter' && currentClub) {
        event.preventDefault()
        handleClubSelect(currentClub)
      }
    }
    
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isModalOpen, currentLeague, selectedClubIndex, currentClub])

  // Calculate display entity
  const displayEntity = currentEntityData?.entity
  const entityFromCache = entities?.find((entity: any) => entity.id === entityId)
  const finalDisplayEntity = displayEntity || entityFromCache
  const renderDisplayClub = finalDisplayEntity || currentClub
  
  const finalLoading = entitiesLoading
  const finalError = entitiesError
  
  // Debug logging (without timestamps to avoid hydration issues)
  console.log('🏆 LeagueNav: Component state', {
    hookCallTime: 'DEBUG',
    entityId: entityId,
    entitiesExists: !!entities,
    entitiesLength: entities?.length,
    entitiesLoading: finalLoading,
    entitiesError: finalError?.message,
    isMounted
  })
  
  // Handler functions
  const handleUp = () => {
    // Ensure we're on client-side with proper data
    if (typeof window === 'undefined') {
      console.log('🏆 UP NAVIGATION BLOCKED: Server-side rendering')
      return
    }
    
    if (!currentLeague || isNavigating) {
      console.log('🏆 UP NAVIGATION BLOCKED:', {
        hasCurrentLeague: !!currentLeague,
        isNavigating,
        sportsDataLength: sportsData.length,
        hasCurrentEntityData: !!currentEntityData?.entity
      })
      return
    }
    
    // 🔧 FIX: Find the actual current club in the league by name matching
    const currentClubName = currentLeague?.clubs[selectedClubIndex]?.properties?.name
    let actualCurrentClubIndex = selectedClubIndex // Start with selected state
    
    // Find the club that matches the current entity by name
    if (currentClubName && renderDisplayClub?.properties?.name) {
      const foundIndex = currentLeague.clubs.findIndex(club => 
        club.properties?.name === renderDisplayClub.properties.name
      )
      if (foundIndex !== -1) {
        actualCurrentClubIndex = foundIndex
        console.log('🔧 FIXED: Found actual club index:', {
          selectedStateIndex: selectedClubIndex,
          actualLeagueIndex: actualCurrentClubIndex,
          clubName: currentLeague.clubs[actualCurrentClubIndex]?.properties?.name
        })
      }
    }
    
    let newIndex = actualCurrentClubIndex
    if (actualCurrentClubIndex > 0) {
      newIndex = actualCurrentClubIndex - 1
    } else {
      newIndex = currentLeague.clubs.length - 1
    }
    
    const previousClub = currentLeague.clubs[newIndex]
    
    console.log('🏆 UP NAVIGATION EXECUTING:', {
      currentLeagueName: currentLeague.league,
      selectedStateIndex: selectedClubIndex,
      actualCurrentClubIndex,
      fromIndex: actualCurrentClubIndex,
      toIndex: newIndex,
      fromClubName: currentLeague.clubs[actualCurrentClubIndex]?.properties?.name,
      fromClubId: currentLeague.clubs[actualCurrentClubIndex]?.id,
      toClubName: previousClub?.properties?.name,
      toClubId: previousClub?.id,
      navigationUrl: previousClub ? `/entity/${previousClub.id}` : 'NO TARGET',
      wrapAround: actualCurrentClubIndex === 0
    })
    
    setSelectedClubIndex(newIndex)
    setSelectedLeagueIndex(currentLeagueIndex)
    setSelectedSportIndex(currentSportIndex)
    setIsNavigating(true)
    
    if (previousClub) {
      router.push(`/entity/${previousClub.id}`)
    }
    
    setTimeout(() => setIsNavigating(false), 500)
  }
  
  const handleDown = () => {
    // Ensure we're on client-side with proper data
    if (typeof window === 'undefined') {
      console.log('🏆 NAVIGATION BLOCKED: Server-side rendering')
      return
    }
    
    if (!currentLeague || isNavigating) {
      console.log('🏆 NAVIGATION BLOCKED:', {
        hasCurrentLeague: !!currentLeague,
        isNavigating,
        sportsDataLength: sportsData.length,
        hasCurrentEntityData: !!currentEntityData?.entity
      })
      return
    }
    
    // 🔧 FIX: Find the actual current club in the league by name matching
    const currentClubName = currentLeague?.clubs[selectedClubIndex]?.properties?.name
    let actualCurrentClubIndex = selectedClubIndex // Start with selected state
    
    // Debug current state
    console.log('🔍 NAVIGATION DEBUG:', {
      currentLeagueName: currentLeague?.league,
      currentLeagueClubs: currentLeague?.clubs?.map(c => c.properties?.name),
      renderDisplayClubName: renderDisplayClub?.properties?.name,
      selectedStateIndex: selectedClubIndex,
      currentClubName
    })
    
    // Find the club that matches the current entity by name
    if (currentClubName && renderDisplayClub?.properties?.name) {
      const foundIndex = currentLeague.clubs.findIndex(club => 
        club.properties?.name === renderDisplayClub.properties.name
      )
      if (foundIndex !== -1) {
        actualCurrentClubIndex = foundIndex
        console.log('🔧 FIXED: Found actual club index:', {
          selectedStateIndex: selectedClubIndex,
          actualLeagueIndex: actualCurrentClubIndex,
          clubName: currentLeague.clubs[actualCurrentClubIndex]?.properties?.name
        })
      } else {
        console.log('🚨 ERROR: Could not find club in current league array!', {
          lookingFor: renderDisplayClub.properties.name,
          availableClubs: currentLeague.clubs.map(c => c.properties?.name)
        })
      }
    }
    
    console.log('🏆 NAVIGATION TRIGGERED:', {
      entityId,
      selectedStateIndex: selectedClubIndex,
      actualCurrentClubIndex,
      currentSportIndex,
      currentLeagueIndex,
      selectedSportIndex,
      selectedLeagueIndex,
      selectedClubIndex,
      currentLeagueName: currentLeague.league,
      currentClubName: currentLeague.clubs[actualCurrentClubIndex]?.properties?.name,
      currentClubId: currentLeague.clubs[actualCurrentClubIndex]?.id,
      sportsDataLength: sportsData.length,
      currentLeagueClubsLength: currentLeague.clubs.length,
      isClientSide: typeof window !== 'undefined'
    })
    
    let newIndex = actualCurrentClubIndex
    if (actualCurrentClubIndex < currentLeague.clubs.length - 1) {
      newIndex = actualCurrentClubIndex + 1
    } else {
      newIndex = 0
    }
    
    const nextClub = currentLeague.clubs[newIndex]
    
    console.log('🏆 NAVIGATION EXECUTING:', {
      currentLeagueName: currentLeague.league,
      selectedStateIndex: selectedClubIndex,
      actualCurrentClubIndex,
      fromIndex: actualCurrentClubIndex,
      toIndex: newIndex,
      fromClubName: currentLeague.clubs[actualCurrentClubIndex]?.properties?.name,
      fromClubId: currentLeague.clubs[actualCurrentClubIndex]?.id,
      toClubName: nextClub?.properties?.name,
      toClubId: nextClub?.id,
      navigationUrl: nextClub ? `/entity/${nextClub.id}` : 'NO TARGET'
    })
    
    setSelectedClubIndex(newIndex)
    setSelectedLeagueIndex(currentLeagueIndex)
    setSelectedSportIndex(currentSportIndex)
    setIsNavigating(true)
    
    if (nextClub) {
      router.push(`/entity/${nextClub.id}`)
    }
    
    setTimeout(() => setIsNavigating(false), 500)
  }
  
  const handleSportLeagueSelect = (sportIndex: number, leagueIndex: number) => {
    setIsNavigating(true)
    setIsModalOpen(false)
    
    setTimeout(() => {
      setSelectedSportIndex(sportIndex)
      setSelectedLeagueIndex(leagueIndex)
      setSelectedClubIndex(0)
      
      const firstClub = sportsData[sportIndex]?.leagues[leagueIndex]?.clubs[0]
      if (firstClub) {
        router.push(`/entity/${firstClub.id}`)
      }
      
      setTimeout(() => setIsNavigating(false), 1500)
    }, 50)
  }
  
  // Show loading placeholder during server-side rendering - MUST BE AFTER ALL HOOKS
  if (!isMounted) {
    return (
      <div className="flex items-center gap-2">
        <div className="relative rounded-lg overflow-hidden bg-gray-600 w-25 h-25">
          <div className="w-full h-full flex items-center justify-center text-white text-xs">
            Loading...
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <div className="w-8 h-8 bg-gray-600 rounded"></div>
          <div className="w-8 h-8 bg-gray-600 rounded"></div>
        </div>
        <div className="flex flex-col items-left min-w-[120px]">
          <div className="h-8 w-32 bg-gray-600 rounded mb-1"></div>
          <div className="h-6 w-40 bg-gray-600/60 rounded"></div>
        </div>
      </div>
    )
  }
  
  // Show error state
  if (entitiesError || (!renderDisplayClub && !finalLoading && (sportsData.length > 0 || entities?.length > 0))) {
    return (
      <div className="flex items-center gap-2">
        <div className="relative rounded-lg overflow-hidden w-25 h-25">
          <div className="w-full h-full bg-gray-600 animate-pulse rounded-lg"></div>
        </div>
        <div className="flex flex-col gap-1">
          <div className="w-8 h-8 bg-gray-600 rounded animate-pulse"></div>
          <div className="w-8 h-8 bg-gray-600 rounded animate-pulse"></div>
        </div>
        <div className="flex flex-col items-left min-w-[120px]">
          <div className="h-8 w-32 bg-gray-600 rounded animate-pulse mb-1"></div>
          <div className="h-6 w-40 bg-gray-600/60 rounded animate-pulse"></div>
        </div>
      </div>
    )
  }

  // Fallback for missing entity
  if (!renderDisplayClub && entityId) {
    const minimalFallback = {
      id: entityId,
      properties: {
        name: `Entity ${entityId}`,
        league: 'Loading...',
        level: 'Loading...',
        competition: 'Loading...',
        country: 'Loading...',
        type: 'Club'
      },
      labels: ['Club']
    }
    
    return (
      <div className="flex items-center gap-2">
        <div className="relative rounded-lg overflow-hidden bg-gray-600 w-25 h-25">
          <div className="w-full h-full flex items-center justify-center text-white text-xs">
            {entityId}
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <button className="w-8 h-8 bg-white/10 rounded-full flex items-center justify-center text-white hover:bg-white/20 transition-colors" disabled>
            ↑
          </button>
          <button className="w-8 h-8 bg-white/10 rounded-full flex items-center justify-center text-white hover:bg-white/20 transition-colors" disabled>
            ↓
          </button>
        </div>
        <div className="flex flex-col items-left min-w-[120px]">
          <div className="mb-1">
            <span className="text-white text-3xl font-extrabold font-medium">
              {minimalFallback.properties.name}
            </span>
          </div>
          <div>
            <span className="text-white/60 text-xl">
              Loading... / Loading...
            </span>
          </div>
        </div>
      </div>
    )
  }

  const canGoUp = currentLeague && currentClubIndex > 0
  const canGoDown = currentLeague && currentClubIndex < currentLeague.clubs.length - 1

  return (
    <div className="flex items-center gap-2" data-testid="league-nav">
      <Dialog open={isModalOpen} onOpenChange={(open) => {
        setIsModalOpen(open)
        if (open) {
          setModalStep('sport')
          setSelectedSportInModal(null)
          setSearchTerm('')
        }
      }}>
        <DialogTrigger asChild>
          <div className="flex flex-col items-center">
            <div className={`relative rounded-lg flex items-center justify-center overflow-hidden cursor-pointer group transition-all duration-200 w-25 h-25 ${
              isNavigating ? 'opacity-70 scale-95' : ''
            }`} 
                 title={renderDisplayClub?.properties?.name || 'Club'}
                 data-testid="league-nav-badge"
                 onMouseEnter={() => setIsHoveringBadge(true)}
                 onMouseLeave={() => setIsHoveringBadge(false)}>
              <EntityBadge entity={renderDisplayClub} size="xl" className={`transition-all duration-200 ${
                isNavigating ? 'opacity-60' : ''
              }`} />
              
              {isNavigating && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-10">
                  <div className="w-full h-full bg-white/10 animate-pulse"></div>
                </div>
              )}
              
              <div className={`absolute inset-0 bg-black/60 flex items-center justify-center transition-opacity duration-200 ${
                isHoveringBadge && !isNavigating ? 'opacity-100' : 'opacity-0'
              }`}>
                <div className="text-white text-center px-2">
                  <div className="text-xs font-medium">Click to change</div>
                  <div className="text-xs font-medium">league</div>
                  <div className="text-xs opacity-75 mt-1">↑↓ keys to navigate</div>
                </div>
              </div>
            </div>
          </div>
        </DialogTrigger>
        
        <DialogContent className="sm:max-w-[500px] bg-header-bg" data-testid="league-nav-dialog">
          <DialogHeader>
            <DialogTitle>
              {modalStep === 'sport' ? 'Select Sport' : `Select League in ${selectedSportInModal}`}
            </DialogTitle>
            <DialogDescription>
              {modalStep === 'sport' 
                ? 'Choose a sport to browse available leagues and clubs.'
                : `Choose a league to browse clubs alphabetically. Current: ${currentLeague?.league || 'None'}`
              }
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {modalStep === 'league' && (
              <div className="flex items-center gap-2 text-sm text-white/60">
                <button onClick={() => setModalStep('sport')} className="hover:text-white transition-colors">
                  All Sports
                </button>
                <span>/</span>
                <span className="text-white font-medium">{selectedSportInModal}</span>
              </div>
            )}
            
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={modalStep === 'sport' ? 'Search sports...' : 'Search leagues and clubs...'}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-white/10 border-white/20 text-white placeholder:text-white/60 focus:bg-white/15 focus:border-white/30"
                data-testid="league-nav-search"
              />
            </div>
            
            {modalStep === 'sport' && (
              <div className="max-h-[400px] overflow-y-auto space-y-2">
                {filteredSportsData.map((sport) => {
                  const totalClubs = sport.leagues.reduce((acc, league) => acc + league.clubs.length, 0)
                  
                  return (
                    <div 
                      key={sport.sport} 
                      className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors hover:bg-white/10 text-white`}
                      onClick={() => {
                        setSelectedSportInModal(sport.sport)
                        setModalStep('league')
                        setSearchTerm('')
                      }}
                    >
                      <div>
                        <div className="font-medium">{sport.sport}</div>
                        <div className="text-sm text-white/60">
                          {sport.leagues.length} leagues • {totalClubs} clubs
                        </div>
                      </div>
                      <div className="text-sm text-white/60">→</div>
                    </div>
                  )
                })}
              </div>
            )}
            
            {modalStep === 'league' && (
              <div className="max-h-[400px] overflow-y-auto space-y-2" data-testid="league-nav-results">
                {filteredLeaguesForSelectedSport.map((league, index) => {
                  const sportIndex = sportsData.findIndex(s => s.sport === selectedSportInModal)
                  const leagueIndex = sportsData[sportIndex]?.leagues.findIndex(l => l.league === league.league) || 0
                  const isCurrentlySelected = sportIndex === selectedSportIndex && leagueIndex === selectedLeagueIndex
                  
                  return (
                    <div 
                      key={league.league} 
                      className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${
                        isCurrentlySelected 
                          ? 'bg-blue-600 text-white' 
                          : 'hover:bg-white/10 text-white'
                      }`}
                      onClick={() => handleSportLeagueSelect(sportIndex, leagueIndex)}
                      data-result-index={index}
                    >
                      <div>
                        <div className="font-medium" data-testid="result-name">{league.league}</div>
                        <div className={`text-sm ${isCurrentlySelected ? 'text-blue-100' : 'text-white/60'}`}>
                          {league.clubs.length} clubs
                        </div>
                      </div>
                      <div className="text-sm" data-testid="result-league">
                      {(() => {
                        const leagueCountries = [...new Set(league.clubs.map(c => c.properties?.country).filter(Boolean))]
                        if (league.league === 'Premier League') {
                          return 'England' // Premier League is always English
                        } else if (leagueCountries.length === 1) {
                          return leagueCountries[0]
                        } else if (leagueCountries.length > 1) {
                          return 'International'
                        } else {
                          return 'International'
                        }
                      })()}
                    </div>
                    </div>
                  )
                })}
              </div>
            )}
            
            <div className="flex items-center justify-between pt-4 border-t border-white/20">
              <div className="text-sm text-white/60">
                {debouncedSearchTerm ? (
                  <span>
                    {modalStep === 'sport' 
                      ? `Found ${filteredSportsData.reduce((acc, sport) => acc + sport.leagues.length, 0)} leagues in ${filteredSportsData.length} sports`
                      : `Found ${filteredLeaguesForSelectedSport.reduce((acc, league) => acc + league.clubs.length, 0)} clubs in ${filteredLeaguesForSelectedSport.length} leagues`
                    }
                  </span>
                ) : (
                  <span>
                    Currently browsing: <span className="text-white font-medium">{currentSport?.sport} → {currentLeague?.league}</span>
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                {modalStep === 'league' && (
                  <Button size="sm" variant="outline" onClick={() => setModalStep('sport')} className="border-white/20 text-white hover:bg-white/10">
                    Back
                  </Button>
                )}
                <Button size="sm" onClick={() => {
                  setIsModalOpen(false)
                  setModalStep('sport')
                  setSelectedSportInModal(null)
                  setSearchTerm('')
                }} data-testid="league-nav-close">
                  Close
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <div className="flex flex-col gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleUp}
          disabled={!canGoUp || isNavigating}
          className={`text-white hover:bg-white/10 disabled:opacity-50 disabled:hover:bg-transparent transition-all duration-200 ${
            isNavigating ? 'scale-95' : ''
          }`}
        >
          {isNavigating ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
          ) : (
            <ChevronUp className="h-4 w-4" />
          )}
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={handleDown}
          disabled={!canGoDown || isNavigating}
          className={`text-white hover:bg-white/10 disabled:opacity-50 disabled:hover:bg-transparent transition-all duration-200 ${
            isNavigating ? 'scale-95' : ''
          }`}
        >
          {isNavigating ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </Button>
      </div>

      <div className={`flex flex-col items-left min-w-[120px] transition-all duration-200 ${
        isNavigating ? 'opacity-60' : ''
      }`}>
        <div className={`mb-1 transition-all duration-200 ${
          isNavigating ? 'h-8 w-32 bg-gray-600 rounded animate-pulse' : ''
        }`}>
          {!isNavigating && (
            <span className="text-white text-3xl font-extrabold font-medium">
              {renderDisplayClub?.properties?.name}
            </span>
          )}
        </div>
        
        <div className={`transition-all duration-200 ${
          isNavigating ? 'h-6 w-40 bg-gray-600/60 rounded animate-pulse' : ''
        }`}>
          {!isNavigating && (
            <span className="text-white/60 text-xl">
              {renderDisplayClub?.properties?.league || renderDisplayClub?.properties?.level || renderDisplayClub?.properties?.competition || currentLeague?.league || 'Unknown League'} / {renderDisplayClub?.properties?.country || 'Unknown Country'}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}