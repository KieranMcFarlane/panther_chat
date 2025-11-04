'use client'

import React, { useState, useEffect } from 'react'
import { EntityBadge } from '@/components/badge/EntityBadge'

export default function SimpleLeagueNav() {
  const [entities, setEntities] = useState([])
  const [loading, setLoading] = useState(true)
  const [currentEntity, setCurrentEntity] = useState(null)

  useEffect(() => {
    console.log('🏆 SimpleLeagueNav: Fetching entities')
    
    fetch('/api/entities?limit=100')
      .then(res => res.json())
      .then(data => {
        console.log('🏆 SimpleLeagueNav: Got entities:', data.entities?.length || 0)
        
        // Filter for clubs only
        const clubs = data.entities?.filter(entity => {
          const type = entity.properties?.type?.toLowerCase() || ''
          return type.includes('club') || type.includes('team')
        }) || []
        
        console.log('🏆 SimpleLeagueNav: Found clubs:', clubs.length)
        setEntities(clubs)
        if (clubs.length > 0) {
          setCurrentEntity(clubs[0])
        }
        setLoading(false)
      })
      .catch(err => {
        console.error('🏆 SimpleLeagueNav: Error:', err)
        setLoading(false)
      })
  }, [])

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-4 bg-gray-800 rounded">
        <div className="w-16 h-16 bg-gray-600 rounded animate-pulse"></div>
        <div className="text-white">Loading clubs...</div>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-4 p-4 bg-gray-800 rounded">
      <div className="text-white text-sm">
        🏆 Found {entities.length} clubs
      </div>
      
      {currentEntity && (
        <>
          <EntityBadge entity={currentEntity} size="lg" />
          <div className="text-white">
            <div className="font-bold">{currentEntity.properties?.name}</div>
            <div className="text-sm text-gray-400">{currentEntity.properties?.level}</div>
          </div>
        </>
      )}
    </div>
  )
}