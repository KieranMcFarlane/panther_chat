'use client'

import { createContext, useContext, useState, useCallback, ReactNode } from 'react'

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

interface LeagueGroup {
  league: string
  clubs: Club[]
}

interface ClubNavigationContextType {
  currentClub: Club | null
  currentLeagueIndex: number
  currentClubIndex: number
  leaguesData: LeagueGroup[]
  isLoading: boolean
  setClubsData: (data: Club[]) => void
  navigateToClub: (club: Club) => void
  navigateUp: () => void
  navigateDown: () => void
  canGoUp: boolean
  canGoDown: boolean
}

const ClubNavigationContext = createContext<ClubNavigationContextType | undefined>(undefined)

export function useClubNavigation() {
  const context = useContext(ClubNavigationContext)
  if (!context) {
    throw new Error('useClubNavigation must be used within a ClubNavigationProvider')
  }
  return context
}

interface ClubNavigationProviderProps {
  children: ReactNode
}

export function ClubNavigationProvider({ children }: ClubNavigationProviderProps) {
  const [currentClub, setCurrentClub] = useState<Club | null>(null)
  const [currentLeagueIndex, setCurrentLeagueIndex] = useState(0)
  const [currentClubIndex, setCurrentClubIndex] = useState(0)
  const [leaguesData, setLeaguesData] = useState<LeagueGroup[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const setClubsData = useCallback((clubs: Club[]) => {
    setIsLoading(true)
    
    // Group by league
    const leagueMap = new Map<string, Club[]>()
    
    clubs.forEach(club => {
      const league = club.properties.level
      if (!leagueMap.has(league)) {
        leagueMap.set(league, [])
      }
      leagueMap.get(league)!.push(club)
    })
    
    // Sort clubs alphabetically within each league
    leagueMap.forEach(clubs => {
      clubs.sort((a, b) => a.properties.name.localeCompare(b.properties.name))
    })
    
    // Convert to array and sort leagues alphabetically
    const sortedLeagues = Array.from(leagueMap.entries())
      .map(([league, clubs]) => ({ league, clubs }))
      .sort((a, b) => a.league.localeCompare(b.league))
    
    setLeaguesData(sortedLeagues)
    
    // Set initial club if none selected
    if (!currentClub && sortedLeagues.length > 0 && sortedLeagues[0].clubs.length > 0) {
      const firstClub = sortedLeagues[0].clubs[0]
      setCurrentClub(firstClub)
      setCurrentLeagueIndex(0)
      setCurrentClubIndex(0)
    }
    
    setIsLoading(false)
  }, [currentClub])

  const navigateToClub = useCallback((club: Club) => {
    setCurrentClub(club)
    
    // Find and update indices
    const leagueIndex = leaguesData.findIndex(league => 
      league.clubs.some(c => c.id === club.id)
    )
    
    if (leagueIndex !== -1) {
      const clubIndex = leaguesData[leagueIndex].clubs.findIndex(c => c.id === club.id)
      setCurrentLeagueIndex(leagueIndex)
      setCurrentClubIndex(clubIndex)
    }
  }, [leaguesData])

  const navigateUp = useCallback(() => {
    if (!currentClub || leaguesData.length === 0) return
    
    if (currentClubIndex > 0) {
      // Move to previous club in current league
      const newClubIndex = currentClubIndex - 1
      const newClub = leaguesData[currentLeagueIndex].clubs[newClubIndex]
      setCurrentClub(newClub)
      setCurrentClubIndex(newClubIndex)
    } else if (currentLeagueIndex > 0) {
      // Move to last club of previous league
      const newLeagueIndex = currentLeagueIndex - 1
      const newClubIndex = leaguesData[newLeagueIndex].clubs.length - 1
      const newClub = leaguesData[newLeagueIndex].clubs[newClubIndex]
      setCurrentClub(newClub)
      setCurrentLeagueIndex(newLeagueIndex)
      setCurrentClubIndex(newClubIndex)
    }
  }, [currentClub, currentClubIndex, currentLeagueIndex, leaguesData])

  const navigateDown = useCallback(() => {
    if (!currentClub || leaguesData.length === 0) return
    
    if (currentClubIndex < leaguesData[currentLeagueIndex].clubs.length - 1) {
      // Move to next club in current league
      const newClubIndex = currentClubIndex + 1
      const newClub = leaguesData[currentLeagueIndex].clubs[newClubIndex]
      setCurrentClub(newClub)
      setCurrentClubIndex(newClubIndex)
    } else if (currentLeagueIndex < leaguesData.length - 1) {
      // Move to first club of next league
      const newLeagueIndex = currentLeagueIndex + 1
      const newClub = leaguesData[newLeagueIndex].clubs[0]
      setCurrentClub(newClub)
      setCurrentLeagueIndex(newLeagueIndex)
      setCurrentClubIndex(0)
    }
  }, [currentClub, currentClubIndex, currentLeagueIndex, leaguesData])

  const canGoUp = currentLeagueIndex > 0 || currentClubIndex > 0
  const canGoDown = currentLeagueIndex < leaguesData.length - 1 || 
                  (leaguesData[currentLeagueIndex] && currentClubIndex < leaguesData[currentLeagueIndex].clubs.length - 1)

  const value: ClubNavigationContextType = {
    currentClub,
    currentLeagueIndex,
    currentClubIndex,
    leaguesData,
    isLoading,
    setClubsData,
    navigateToClub,
    navigateUp,
    navigateDown,
    canGoUp,
    canGoDown
  }

  return (
    <ClubNavigationContext.Provider value={value}>
      {children}
    </ClubNavigationContext.Provider>
  )
}