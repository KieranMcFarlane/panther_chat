'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EntityBadge } from '@/components/badge/EntityBadge';
import { useApi, useEntity } from '@/lib/swr-config';
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
    level: string
    sport: string
    type: string
    country?: string
    [key: string]: any
  }
}

export default function LeagueNav() {
  const router = useRouter()
  const params = useParams()
  const entityId = params.entityId as string || '197' // Get entity ID from URL or fallback
  
  // CRITICAL: Always log when component renders or entityId changes
  console.log('🏆 LeagueNav: Component render', {
    entityId,
    timestamp: new Date().toISOString(),
    url: typeof window !== 'undefined' ? window.location.pathname : 'server'
  })
  
  const { data: entitiesData, isLoading, error } = useApi('/api/entities?limit=2000')
  const { data: currentEntityData } = useEntity(entityId) // Get current entity data
  
  console.log('🏆 LeagueNav: API state', { 
    isLoading, 
    error, 
    hasData: !!entitiesData, 
    currentEntity: currentEntityData?.entity?.properties?.name, 
    currentId: currentEntityData?.entity?.id,
    entityIdParam: entityId
  })
    
    // Debug: Check if Manchester clubs are in the raw data
    if (entitiesData?.entities) {
      const manchesterClubs = entitiesData.entities.filter((entity: any) => 
        entity.properties?.name?.toLowerCase().includes('manchester')
      )
      console.log('🏆 Manchester clubs found in raw data:', manchesterClubs.map(c => ({
        name: c.properties?.name,
        type: c.properties?.type,
        level: c.properties?.level,
        sport: c.properties?.sport
      })))
    }
  
  // Enhanced club filtering with comprehensive validation
  const leaguesData = useMemo(() => {
    if (!entitiesData?.entities) {
      return []
    }
    
    console.log('🏆 Total entities received:', entitiesData.entities.length)
    
    // Comprehensive analysis of all entities
    const manchesterEntities = entitiesData.entities.filter((entity: any) => 
      entity.properties?.name?.toLowerCase().includes('manchester')
    )
    
    console.log('🔍 Manchester entities analysis:', manchesterEntities.map((entity, index) => ({
      index,
      name: entity.properties?.name,
      type: entity.properties?.type,
      level: entity.properties?.level,
      sport: entity.properties?.sport,
      country: entity.properties?.country,
      labels: entity.labels
    })))
    
    // Enhanced club filtering - more inclusive to catch variations
    const clubs = entitiesData.entities.filter((entity: any) => {
      const name = entity.properties?.name?.toLowerCase() || ''
      const type = entity.properties?.type?.toLowerCase() || ''
      const labels = entity.labels?.map((l: string) => l.toLowerCase()) || []
      const level = entity.properties?.level
      const sport = entity.properties?.sport?.toLowerCase() || ''
      
      // Multiple ways to identify clubs
      const isClubByType = type.includes('club') || type.includes('team')
      const isClubByLabel = labels.some(label => label.includes('club') || label.includes('team'))
      const isClubBySport = sport.includes('football') || sport.includes('soccer')
      
      // Must have a league/level to be included in navigation
      const hasLeague = !!level && level.trim().length > 0
      
      const isClub = isClubByType || isClubByLabel
      
      // Special logging for Manchester clubs
      if (name.includes('manchester')) {
        console.log(`🔍 Manchester entity "${entity.properties?.name}":`, {
          isClub,
          isClubByType,
          isClubByLabel,
          hasLeague,
          level,
          type,
          labels
        })
      }
      
      return isClub && hasLeague
    }) as Club[]
    
    console.log('🏆 Filtered clubs count:', clubs.length)
    console.log('🏆 All filtered clubs:', clubs.map(c => ({ 
      name: c.properties.name, 
      level: c.properties.level, 
      type: c.properties.type,
      sport: c.properties.sport
    })))
    
    // League name normalization mapping
    const normalizeLeagueName = (leagueName: string) => {
      const normalized = leagueName.toLowerCase().trim()
      const leagueMapping: Record<string, string> = {
        'premier league': 'Premier League',
        'english premier league': 'Premier League',
        'epl': 'Premier League',
        'la liga': 'La Liga',
        'laliga': 'La Liga',
        'serie a': 'Serie A',
        'serie a tim': 'Serie A',
        'bundesliga': 'Bundesliga',
        'ligue 1': 'Ligue 1',
        'champions league': 'Champions League',
        'europa league': 'Europa League',
        'scottish premier league': 'Scottish Premier League',
        'scottish premiership': 'Scottish Premiership'
      }
      
      return leagueMapping[normalized] || leagueName
    }
    
    // Group by normalized league names
    const leagueMap = new Map<string, Club[]>()
    
    clubs.forEach(club => {
      const rawLeague = club.properties.level
      const normalizedLeague = normalizeLeagueName(rawLeague)
      
      if (!leagueMap.has(normalizedLeague)) {
        leagueMap.set(normalizedLeague, [])
      }
      leagueMap.get(normalizedLeague)!.push(club)
    })
    
    // Sort clubs alphabetically within each league
    leagueMap.forEach(clubs => {
      clubs.sort((a, b) => a.properties.name.localeCompare(b.properties.name))
    })
    
    // Convert to array and sort leagues alphabetically
    const result = Array.from(leagueMap.entries())
      .map(([league, clubs]) => ({ league, clubs }))
      .sort((a, b) => a.league.localeCompare(b.league))
    
    // Detailed Premier League analysis
    const premierLeague = result.find(l => l.league === 'Premier League')
    if (premierLeague) {
      console.log('✅ Premier League found with', premierLeague.clubs.length, 'clubs:')
      premierLeague.clubs.forEach((club, index) => {
        console.log(`  ${index + 1}. ${club.properties.name} (${club.properties.country})`)
      })
      
      // Check for Manchester clubs specifically
      const manchesterInPremierLeague = premierLeague.clubs.filter(c => 
        c.properties.name.toLowerCase().includes('manchester')
      )
      console.log('🔍 Manchester clubs in Premier League:', manchesterInPremierLeague.map(c => c.properties.name))
    } else {
      console.log('❌ No Premier League found. Available leagues:')
      result.forEach(league => {
        console.log(`  - ${league.league} (${league.clubs.length} clubs)`)
      })
    }
    
    // Check if any Manchester clubs were filtered out
    const manchesterClubsInResults = result.flatMap(league => 
      league.clubs.filter(club => club.properties.name.toLowerCase().includes('manchester'))
    )
    console.log('🏆 Manchester clubs in final results:', manchesterClubsInResults.map(c => c.properties.name))
    
    return result
  }, [entitiesData])
  
  // Find the current entity's league and club index
  const { currentLeagueIndex, currentClubIndex } = useMemo(() => {
    if (!currentEntityData?.entity || !leaguesData.length) {
      return { currentLeagueIndex: 0, currentClubIndex: 0 }
    }
    
    const currentClub = currentEntityData.entity as Club
    const currentClubLeague = currentClub.properties?.level
    
    for (let leagueIndex = 0; leagueIndex < leaguesData.length; leagueIndex++) {
      const league = leaguesData[leagueIndex]
      if (league.league === currentClubLeague) {
        const clubIndex = league.clubs.findIndex(club => club.id === currentClub.id)
        if (clubIndex !== -1) {
          return { currentLeagueIndex: leagueIndex, currentClubIndex: clubIndex }
        }
      }
    }
    
    // If current club not found, default to first league and club
    return { currentLeagueIndex: 0, currentClubIndex: 0 }
  }, [currentEntityData, leaguesData])
  
  const [selectedLeagueIndex, setSelectedLeagueIndex] = useState(currentLeagueIndex)
  const [selectedClubIndex, setSelectedClubIndex] = useState(currentClubIndex)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isHoveringBadge, setIsHoveringBadge] = useState(false)
  const [isNavigating, setIsNavigating] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('')
  
  const currentLeague = leaguesData[selectedLeagueIndex]
  const currentClub = currentLeague?.clubs[selectedClubIndex]
  
  // CRITICAL: Debug current selection state and potential sync issues
  console.log('🏆 LeagueNav: Current selection state', {
    entityId,
    selectedLeagueIndex,
    selectedClubIndex,
    currentLeague: currentLeague?.league,
    currentClub: currentClub?.properties?.name,
    currentClubId: currentClub?.id,
    entityName: currentEntityData?.entity?.properties?.name,
    entityIdFromData: currentEntityData?.entity?.id,
    isSynced: currentClub?.properties?.name === currentEntityData?.entity?.properties?.name,
    timestamp: new Date().toISOString()
  })
  
  // CRITICAL: Force immediate sync if there's a mismatch (but only if data is available)
  if (currentEntityData?.entity && currentClub && 
      currentClub.properties && currentClub.properties.name && 
      currentEntityData.entity.properties && currentEntityData.entity.properties.name &&
      currentClub.properties.name !== currentEntityData.entity.properties.name) {
    console.log('🚨 IMMEDIATE SYNC CORRECTION NEEDED!', {
      headerClub: currentClub.properties.name,
      entityClub: currentEntityData.entity.properties.name,
      entityId: currentEntityData.entity.id
    })
  }
  
  // Reset to first club when changing leagues (but not during URL-triggered sync)
  useEffect(() => {
    if (!isNavigating) {
      setSelectedClubIndex(0)
    }
  }, [selectedLeagueIndex])
  
  // Debounce search term to prevent excessive filtering
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm)
    }, 300) // 300ms debounce delay

    return () => clearTimeout(timer)
  }, [searchTerm])

  // Filter leagues based on search term
  const filteredLeaguesData = useMemo(() => {
    if (!debouncedSearchTerm) {
      return leaguesData
    }

    const searchTermLower = debouncedSearchTerm.toLowerCase()
    return leaguesData
      .map(league => ({
        ...league,
        clubs: league.clubs.filter(club => 
          club.properties.name.toLowerCase().includes(searchTermLower) ||
          league.league.toLowerCase().includes(searchTermLower) ||
          (club.properties.country && club.properties.country.toLowerCase().includes(searchTermLower))
        )
      }))
      .filter(league => league.clubs.length > 0) // Only show leagues that have matching clubs
  }, [leaguesData, debouncedSearchTerm])

  // Sync navigation state with current entity from URL
  useEffect(() => {
    console.log('🔄 SYNC EFFECT TRIGGERED:', {
      hasEntityData: !!currentEntityData?.entity,
      hasLeaguesData: leaguesData.length > 0,
      entityId: entityId,
      timestamp: new Date().toISOString()
    })
    
    if (currentEntityData?.entity && leaguesData.length > 0) {
      const currentClub = currentEntityData.entity as Club
      const currentClubId = currentClub.id.toString() // Ensure string comparison
      const currentClubName = currentClub.properties?.name
      const currentClubLeague = currentClub.properties?.level
      
      console.log('🔄 FORCE SYNCING navigation for entity:', {
        id: currentClubId,
        name: currentClubName,
        level: currentClubLeague,
        idType: typeof currentClubId,
        availableLeagues: leaguesData.map(l => ({ league: l.league, clubs: l.clubs.length }))
      })
      
      let foundMatch = false
      let targetLeagueIndex = -1
      let targetClubIndex = -1
      
      // First try: Exact league match with normalized names
      for (let leagueIndex = 0; leagueIndex < leaguesData.length; leagueIndex++) {
        const league = leaguesData[leagueIndex]
        
        // Normalize league names for comparison
        const normalizeLeague = (name: string) => name.toLowerCase().trim()
        const currentLeagueNormalized = normalizeLeague(league.league)
        const clubLeagueNormalized = normalizeLeague(currentClubLeague || '')
        
        console.log(`🔍 Checking league "${league.league}" (${currentLeagueNormalized}) vs "${currentClubLeague}" (${clubLeagueNormalized})`)
        
        if (currentLeagueNormalized === clubLeagueNormalized) {
          // Found the matching league
          console.log(`✅ Found matching league: ${league.league}`)
          
          // Find the club within this league - ensure both IDs are strings for comparison
          const clubIndex = league.clubs.findIndex(club => club.id.toString() === currentClubId)
          console.log(`🔍 Looking for club ID ${currentClubId} in ${league.league}:`, {
            totalClubs: league.clubs.length,
            clubNames: league.clubs.map(c => ({ 
              id: c.id, 
              idType: typeof c.id,
              idToString: c.id.toString(),
              name: c.properties.name 
            })),
            foundIndex: clubIndex
          })
          
          if (clubIndex !== -1) {
            console.log(`✅ Found club at index ${clubIndex}: ${league.clubs[clubIndex].properties.name}`)
            targetLeagueIndex = leagueIndex
            targetClubIndex = clubIndex
            foundMatch = true
            break
          } else {
            console.log(`⚠️ Club ${currentClubName} not found in league ${league.league}`)
            console.log('Available clubs in this league:', league.clubs.map(c => `${c.id}: ${c.properties.name}`))
          }
        }
      }
      
      // Second try: If no exact league match, search for the club by ID across all leagues
      if (!foundMatch) {
        console.log(`⚠️ No exact league match found, searching for club by ID across all leagues...`)
        
        for (let leagueIndex = 0; leagueIndex < leaguesData.length; leagueIndex++) {
          const league = leaguesData[leagueIndex]
          const clubIndex = league.clubs.findIndex(club => club.id.toString() === currentClubId)
          
          if (clubIndex !== -1) {
            console.log(`✅ Found club ${currentClubName} in league ${league.league} at index ${clubIndex}`)
            targetLeagueIndex = leagueIndex
            targetClubIndex = clubIndex
            foundMatch = true
            break
          }
        }
      }
      
      // Third try: If still no match, search by name as fallback
      if (!foundMatch) {
        console.log(`⚠️ No ID match found, searching for club by name across all leagues...`)
        
        for (let leagueIndex = 0; leagueIndex < leaguesData.length; leagueIndex++) {
          const league = leaguesData[leagueIndex]
          const clubIndex = league.clubs.findIndex(club => {
            const clubName = club.properties?.name?.toLowerCase().trim() || ''
            const currentName = currentClubName?.toLowerCase().trim() || ''
            return clubName === currentName
          })
          
          if (clubIndex !== -1) {
            console.log(`✅ Found club by name ${currentClubName} in league ${league.league} at index ${clubIndex}`)
            targetLeagueIndex = leagueIndex
            targetClubIndex = clubIndex
            foundMatch = true
            break
          }
        }
      }
      
      if (!foundMatch) {
        console.log(`❌ CRITICAL: Could not find any match for ${currentClubName} (${currentClubLeague})`)
        console.log('Available leagues:', leaguesData.map(l => l.league))
        console.log('All available clubs:', leaguesData.flatMap(l => 
          l.clubs.map(c => ({ id: c.id, name: c.properties.name, league: l.league }))
        ))
        
        // EMERGENCY: If Bayern München is expected but not found, search more broadly
        if (currentClubName?.toLowerCase().includes('bayern') || currentClubName?.toLowerCase().includes('munich')) {
          console.log('🚨 EMERGENCY BAYERN SEARCH ACTIVATED')
          
          // Search for any club containing "Bayern" or "Munich"
          for (let leagueIndex = 0; leagueIndex < leaguesData.length; leagueIndex++) {
            const league = leaguesData[leagueIndex]
            const emergencyIndex = league.clubs.findIndex(club => {
              const clubName = club.properties?.name?.toLowerCase() || ''
              return clubName.includes('bayern') || clubName.includes('munich')
            })
            
            if (emergencyIndex !== -1) {
              const foundClub = league.clubs[emergencyIndex]
              console.log(`🚨 EMERGENCY FOUND: ${foundClub.properties.name} at index ${emergencyIndex}`)
              targetLeagueIndex = leagueIndex
              targetClubIndex = emergencyIndex
              foundMatch = true
              break
            }
          }
        }
        
        // As a last resort, reset to first league and club
        if (!foundMatch) {
          console.log('🔄 Resetting to first league and club as fallback')
          targetLeagueIndex = 0
          targetClubIndex = 0
          foundMatch = true
        }
      }
      
      // CRITICAL: Batch state updates to prevent race conditions
      if (foundMatch) {
        console.log('🎯 UPDATING STATE IN BATCH:', {
          targetLeagueIndex,
          targetClubIndex,
          targetClub: leaguesData[targetLeagueIndex]?.clubs[targetClubIndex]?.properties?.name,
          currentSelectedLeague: selectedLeagueIndex,
          currentSelectedClub: selectedClubIndex
        })
        
        // Use flushSync to ensure immediate state updates
        import('react-dom').then(({ flushSync }) => {
          flushSync(() => {
            setSelectedLeagueIndex(targetLeagueIndex)
            setSelectedClubIndex(targetClubIndex)
          })
          
          console.log('✅ STATE UPDATED - New selection:', {
            leagueIndex: targetLeagueIndex,
            clubIndex: targetClubIndex,
            clubName: leaguesData[targetLeagueIndex]?.clubs[targetClubIndex]?.properties?.name
          })
        })
      }
    } else {
      console.log('⏸️ Sync waiting for data:', { 
        hasEntityData: !!currentEntityData?.entity, 
        hasLeaguesData: leaguesData.length > 0,
        entityId,
        timestamp: new Date().toISOString()
      })
    }
  }, [currentEntityData, leaguesData, entityId]) // Added entityId to dependency array
  
  // Verification effect: Double-check synchronization after state updates
  useEffect(() => {
    if (currentEntityData?.entity && leaguesData.length > 0 && currentLeague && currentClub) {
      const currentClubName = currentEntityData.entity.properties?.name
      const selectedClubName = currentClub.properties?.name
      
      console.log('🔍 VERIFICATION CHECK:', {
        entityName: currentClubName,
        selectedClubName: selectedClubName,
        isMatch: currentClubName === selectedClubName,
        entityId: currentEntityData.entity.id,
        selectedClubId: currentClub.id,
        timestamp: new Date().toISOString()
      })
      
      // If there's still a mismatch after sync, force correction
      if (currentClubName !== selectedClubName) {
        console.log('⚠️ SYNC MISMATCH DETECTED - FORCING CORRECTION')
        
        // Search for the correct club again with more aggressive matching
        for (let leagueIndex = 0; leagueIndex < leaguesData.length; leagueIndex++) {
          const league = leaguesData[leagueIndex]
          const clubIndex = league.clubs.findIndex(club => {
            const clubName = club.properties?.name?.toLowerCase().trim() || ''
            const targetName = currentClubName?.toLowerCase().trim() || ''
            return clubName === targetName || clubName.includes(targetName) || targetName.includes(clubName)
          })
          
          if (clubIndex !== -1) {
            console.log(`🔧 FORCING SYNC TO: ${league.clubs[clubIndex].properties.name}`)
            setSelectedLeagueIndex(leagueIndex)
            setSelectedClubIndex(clubIndex)
            break
          }
        }
      }
    }
  }, [currentEntityData, leaguesData, selectedLeagueIndex, selectedClubIndex])
  
  // Keyboard shortcuts for navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Only respond to arrow keys when modal is not open
      if (isModalOpen) return
      
      if (event.key === 'ArrowUp') {
        event.preventDefault()
        handleUp()
      } else if (event.key === 'ArrowDown') {
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
  
  const handleUp = () => {
    if (!currentLeague || isNavigating) return
    
    let newIndex = selectedClubIndex
    if (selectedClubIndex > 0) {
      // Move to previous club in current league (A-Z going backwards)
      newIndex = selectedClubIndex - 1
    } else {
      // Loop back to last club in current league
      newIndex = currentLeague.clubs.length - 1
    }
    
    console.log('⬆️ NAVIGATING UP:', {
      fromIndex: selectedClubIndex,
      toIndex: newIndex,
      fromClub: currentClub?.properties?.name,
      toClub: currentLeague.clubs[newIndex]?.properties?.name
    })
    
    setSelectedClubIndex(newIndex)
    setIsNavigating(true)
    
    // Navigate to the selected club
    const selectedClub = currentLeague.clubs[newIndex]
    if (selectedClub) {
      router.push(`/entity/${selectedClub.id}`)
    }
    
    // Reset navigation state after a short delay
    setTimeout(() => setIsNavigating(false), 500)
  }
  
  const handleDown = () => {
    if (!currentLeague || isNavigating) return
    
    let newIndex = selectedClubIndex
    if (selectedClubIndex < currentLeague.clubs.length - 1) {
      // Move to next club in current league (A-Z going forwards)
      newIndex = selectedClubIndex + 1
    } else {
      // Loop back to first club in current league
      newIndex = 0
    }
    
    console.log('⬇️ NAVIGATING DOWN:', {
      fromIndex: selectedClubIndex,
      toIndex: newIndex,
      fromClub: currentClub?.properties?.name,
      toClub: currentLeague.clubs[newIndex]?.properties?.name
    })
    
    setSelectedClubIndex(newIndex)
    setIsNavigating(true)
    
    // Navigate to the selected club
    const selectedClub = currentLeague.clubs[newIndex]
    if (selectedClub) {
      router.push(`/entity/${selectedClub.id}`)
    }
    
    // Reset navigation state after a short delay
    setTimeout(() => setIsNavigating(false), 500)
  }
  
  const canGoUp = currentLeague && selectedClubIndex > 0
  const canGoDown = currentLeague && selectedClubIndex < currentLeague.clubs.length - 1
  
  // Handle league selection in modal
  const handleLeagueSelect = (leagueIndex: number) => {
    console.log('🏆 LEAGUE SELECTED:', {
      newLeagueIndex: leagueIndex,
      newLeagueName: leaguesData[leagueIndex]?.league,
      firstClub: leaguesData[leagueIndex]?.clubs[0]?.properties?.name,
      firstClubId: leaguesData[leagueIndex]?.clubs[0]?.id
    })
    
    // CRITICAL: Set loading state IMMEDIATELY to show skeleton right away
    setIsNavigating(true)
    setIsModalOpen(false)
    
    // Small delay to ensure skeleton renders before navigation
    setTimeout(() => {
      // Update the selected league and club
      setSelectedLeagueIndex(leagueIndex)
      setSelectedClubIndex(0)
      
      // Navigate to the first club in the selected league
      const firstClub = leaguesData[leagueIndex]?.clubs[0]
      if (firstClub) {
        console.log('🚀 NAVIGATING TO FIRST CLUB:', firstClub.properties?.name)
        router.push(`/entity/${firstClub.id}`)
      }
      
      // Reset navigation state after a longer delay to allow page to load
      setTimeout(() => setIsNavigating(false), 1500)
    }, 50) // 50ms delay to ensure skeleton shows first
  }
  
  const handleClubSelect = (club: Club) => {
    // Navigate to the club's entity page
    setIsNavigating(true)
    router.push(`/entity/${club.id}`)
    setIsModalOpen(false)
    
    // Reset navigation state after a short delay
    setTimeout(() => setIsNavigating(false), 500)
  }

  if (isLoading) {
    console.log('🏆 LeagueNav: Loading state - showing skeleton indicator')
    return (
      <div className="flex items-center gap-2">
        {/* Badge skeleton */}
        <div className="relative rounded-lg overflow-hidden" style={{ width: '6.25rem', height: '6.25rem' }}>
          <div className="w-full h-full bg-gray-600 animate-pulse rounded-lg"></div>
        </div>
        
        {/* Arrow skeleton */}
        <div className="flex flex-col gap-1">
          <div className="w-8 h-8 bg-gray-600 rounded animate-pulse"></div>
          <div className="w-8 h-8 bg-gray-600 rounded animate-pulse"></div>
        </div>
        
        {/* Text skeleton */}
        <div className="flex flex-col items-left min-w-[120px]">
          <div className="h-8 w-32 bg-gray-600 rounded animate-pulse mb-1"></div>
          <div className="h-6 w-40 bg-gray-600/60 rounded animate-pulse"></div>
        </div>
      </div>
    )
  }

  if (error || !currentClub || leaguesData.length === 0) {
    console.log('🏆 LeagueNav: Error state', { error, currentClub: !!currentClub, leaguesCount: leaguesData.length })
    return (
      <div className="flex items-center gap-2">
        {/* Badge skeleton */}
        <div className="relative rounded-lg overflow-hidden" style={{ width: '6.25rem', height: '6.25rem' }}>
          <div className="w-full h-full bg-gray-600 animate-pulse rounded-lg"></div>
        </div>
        
        {/* Arrow skeleton */}
        <div className="flex flex-col gap-1">
          <div className="w-8 h-8 bg-gray-600 rounded animate-pulse"></div>
          <div className="w-8 h-8 bg-gray-600 rounded animate-pulse"></div>
        </div>
        
        {/* Text skeleton */}
        <div className="flex flex-col items-left min-w-[120px]">
          <div className="h-8 w-32 bg-gray-600 rounded animate-pulse mb-1"></div>
          <div className="h-6 w-40 bg-gray-600/60 rounded animate-pulse"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      {/* Debug info */}
      {/* <div className="text-white/60 text-xs bg-red-500 px-2 py-1 rounded">
        CLUBS: {leaguesData.reduce((total, league) => total + league.clubs.length, 0)}
      </div> */}
      
      {/* Club Badge with Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogTrigger asChild>
          <div className="flex flex-col items-center">
            <div className={`relative rounded-lg flex items-center justify-center overflow-hidden cursor-pointer group transition-all duration-200 ${
              isNavigating ? 'opacity-70 scale-95' : ''
            }`} 
                 title={currentClub.properties?.name || 'Club'}
                 style={{ width: '6.25rem', height: '6.25rem' }}
                 onMouseEnter={() => setIsHoveringBadge(true)}
                 onMouseLeave={() => setIsHoveringBadge(false)}>
              <EntityBadge entity={currentClub} size="xl" className={`transition-all duration-200 ${
                isNavigating ? 'opacity-60' : ''
              }`} />
              
              {/* Subtle loading skeleton overlay */}
              {isNavigating && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-10">
                  {/* Subtle pulse effect */}
                  <div className="w-full h-full bg-white/10 animate-pulse"></div>
                </div>
              )}
              
              {/* Hover overlay with hint */}
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
        <DialogContent 
          className="sm:max-w-[500px]" 
          style={{ backgroundColor: '#1c1e2d' }}
        >
          <DialogHeader>
            <DialogTitle>Select League</DialogTitle>
            <DialogDescription>
              Choose a league to browse clubs alphabetically. Current: {currentLeague?.league || 'None'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search leagues and clubs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-white/10 border-white/20 text-white placeholder:text-white/60 focus:bg-white/15 focus:border-white/30"
              />
            </div>
            
            <div className="max-h-[400px] overflow-y-auto space-y-2">
              {filteredLeaguesData.map((league, index) => {
                // Get the original index from the full leaguesData array
                const originalIndex = leaguesData.findIndex(l => l.league === league.league)
                
                return (
                  <div 
                  key={league.league} 
                  className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${
                    index === selectedLeagueIndex 
                      ? 'bg-blue-600 text-white' 
                      : 'hover:bg-white/10 text-white'
                  }`}
                  onClick={() => handleLeagueSelect(originalIndex)}
                >
                  <div>
                    <div className="font-medium">{league.league}</div>
                    <div className={`text-sm ${index === selectedLeagueIndex ? 'text-blue-100' : 'text-white/60'}`}>
                      {league.clubs.length} clubs
                    </div>
                  </div>
                  <div className="text-sm">
                    {league.clubs[0]?.properties.country || 'International'}
                  </div>
                  </div>
                )
              })}
            </div>
            
            <div className="flex items-center justify-between pt-4 border-t border-white/20">
              <div className="text-sm text-white/60">
                {debouncedSearchTerm ? (
                  <span>
                    Found {filteredLeaguesData.reduce((acc, league) => acc + league.clubs.length, 0)} clubs in {filteredLeaguesData.length} leagues
                  </span>
                ) : (
                  <span>
                    Currently browsing: <span className="text-white font-medium">{currentLeague?.league}</span>
                  </span>
                )}
              </div>
              <Button size="sm" onClick={() => setIsModalOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Vertical Arrow Navigation */}
      <div className="flex flex-col gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleUp}
          disabled={!canGoUp || isNavigating}
          className={`text-white hover:bg-white/10 disabled:opacity-50 disabled:hover:bg-transparent group relative transition-all duration-200 ${
            isNavigating ? 'scale-95' : ''
          }`}
          aria-label="Previous club (↑ key)"
          title="Previous club (↑ key)"
        >
          {isNavigating ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
          ) : (
            <ChevronUp className="h-4 w-4" />
          )}
          <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-black/80 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
            ↑ Key
          </div>
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={handleDown}
          disabled={!canGoDown || isNavigating}
          className={`text-white hover:bg-white/10 disabled:opacity-50 disabled:hover:bg-transparent group relative transition-all duration-200 ${
            isNavigating ? 'scale-95' : ''
          }`}
          aria-label="Next club (↓ key)"
          title="Next club (↓ key)"
        >
          {isNavigating ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
          <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 bg-black/80 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
            ↓ Key
          </div>
        </Button>
      </div>

      {/* Current club info */}
      <div className={`flex flex-col items-left min-w-[120px] transition-all duration-200 ${
        isNavigating ? 'opacity-60' : ''
      }`}>
        {/* Club name skeleton */}
        <div className={`mb-1 transition-all duration-200 ${
          isNavigating ? 'h-8 w-32 bg-gray-600 rounded animate-pulse' : ''
        }`}>
          {!isNavigating && (
            <span className="text-white text-3xl font-extrabold font-medium">
              {currentClub.properties.name}
            </span>
          )}
        </div>
        
        {/* League/country skeleton */}
        <div className={`transition-all duration-200 ${
          isNavigating ? 'h-6 w-40 bg-gray-600/60 rounded animate-pulse' : ''
        }`}>
          {!isNavigating && (
            <span className="text-white/60 text-xl">
              {currentLeague.league} / {currentClub.properties.country}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}