"use client"

import { useState, useEffect, useMemo } from 'react'
import { useApi } from '@/lib/swr-config'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ChevronUp, ChevronDown } from 'lucide-react'

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

export function LeagueNavigator() {
  console.log('🏆 LeagueNavigator: Component rendering')
  
  const { data: entitiesData, isLoading } = useApi('/api/entities?limit=2000')
  
  console.log('🏆 LeagueNavigator: isLoading:', isLoading, 'has data:', !!entitiesData)
  
  // Group clubs by league alphabetically
  const leaguesData = useMemo(() => {
    if (!entitiesData?.entities) {
      console.log('🏆 LeagueNavigator: No entities data')
      return []
    }
    
    console.log(`🏆 LeagueNavigator: Processing ${entitiesData.entities.length} entities`)
    
    const clubs = entitiesData.entities.filter(
      (entity: any) => entity.properties?.type === 'Club' && entity.properties?.level
    ) as Club[]
    
    console.log(`🏆 LeagueNavigator: Found ${clubs.length} clubs with level data`)
    
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
    const result = Array.from(leagueMap.entries())
      .map(([league, clubs]) => ({ league, clubs }))
      .sort((a, b) => a.league.localeCompare(b.league))
    
    console.log(`🏆 LeagueNavigator: Found ${result.length} leagues:`, result.map(l => `${l.league} (${l.clubs.length} clubs)`))
    
    return result
  }, [entitiesData])
  
  const [currentLeagueIndex, setCurrentLeagueIndex] = useState(0)
  const [currentClubIndex, setCurrentClubIndex] = useState(0)
  
  const currentLeague = leaguesData[currentLeagueIndex]
  const currentClub = currentLeague?.clubs[currentClubIndex]
  
  // Reset club index when changing leagues
  useEffect(() => {
    setCurrentClubIndex(0)
  }, [currentLeagueIndex])
  
  const handleUp = () => {
    if (!currentLeague) return
    
    if (currentClubIndex > 0) {
      // Move to previous club in current league
      setCurrentClubIndex(prev => prev - 1)
    } else if (currentLeagueIndex > 0) {
      // Move to last club of previous league
      setCurrentLeagueIndex(prev => prev - 1)
      setCurrentClubIndex(leaguesData[currentLeagueIndex - 1].clubs.length - 1)
    }
  }
  
  const handleDown = () => {
    if (!currentLeague) return
    
    if (currentClubIndex < currentLeague.clubs.length - 1) {
      // Move to next club in current league
      setCurrentClubIndex(prev => prev + 1)
    } else if (currentLeagueIndex < leaguesData.length - 1) {
      // Move to first club of next league
      setCurrentLeagueIndex(prev => prev + 1)
      setCurrentClubIndex(0)
    }
  }
  
  const canGoUp = currentLeagueIndex > 0 || currentClubIndex > 0
  const canGoDown = currentLeagueIndex < leaguesData.length - 1 || 
                  (currentLeague && currentClubIndex < currentLeague.clubs.length - 1)
  
  if (isLoading) {
    return (
      <Card className="w-80">
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">
            Loading leagues...
          </div>
        </CardContent>
      </Card>
    )
  }
  
  if (!currentClub || leaguesData.length === 0) {
    return (
      <Card className="w-80">
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">
            No clubs found
          </div>
        </CardContent>
      </Card>
    )
  }
  
  return (
    <Card className="w-80">
      <CardContent className="p-4 space-y-4">
        {/* Navigation Controls */}
        <div className="flex justify-center">
          <div className="flex flex-col gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleUp}
              disabled={!canGoUp}
              className="text-white hover:bg-white/10 disabled:opacity-50 disabled:hover:bg-transparent"
              aria-label="Previous club"
            >
              <ChevronUp className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDown}
              disabled={!canGoDown}
              className="text-white hover:bg-white/10 disabled:opacity-50 disabled:hover:bg-transparent"
              aria-label="Next club"
            >
              <ChevronDown className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        {/* Current Club Info */}
        <div className="text-center space-y-2">
          <div className="text-xs text-muted-foreground">
            {currentLeagueIndex + 1} of {leaguesData.length} leagues
          </div>
          <div className="text-sm font-medium text-muted-foreground">
            {currentLeague.league}
          </div>
          <div className="text-lg font-semibold">
            {currentClub.properties.name}
          </div>
          <div className="text-xs text-muted-foreground">
            {currentClubIndex + 1} of {currentLeague.clubs.length} clubs
          </div>
          {currentClub.properties.country && (
            <div className="text-xs text-muted-foreground">
              {currentClub.properties.country}
            </div>
          )}
        </div>
        
        {/* League Progress */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>League Progress</span>
            <span>{Math.round(((currentLeagueIndex + 1) / leaguesData.length) * 100)}%</span>
          </div>
          <div className="w-full bg-muted rounded-full h-1">
            <div className="bg-primary h-1 rounded-full transition-all duration-300" style={{ width: `${((currentLeagueIndex + 1) / leaguesData.length) * 100}%` }} />
          </div>
        </div>
        
        {/* Club Progress */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Club Progress</span>
            <span>{Math.round(((currentClubIndex + 1) / currentLeague.clubs.length) * 100)}%</span>
          </div>
          <div className="w-full bg-muted rounded-full h-1">
            <div className="bg-secondary h-1 rounded-full transition-all duration-300" style={{ width: `${((currentClubIndex + 1) / currentLeague.clubs.length) * 100}%` }} />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}