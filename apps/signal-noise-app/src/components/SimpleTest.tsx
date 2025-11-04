'use client'

import React, { useState, useEffect } from 'react'

export default function SimpleTest() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    console.log('🧪 SimpleTest: Starting data fetch')
    
    fetch('/api/entities?limit=10')
      .then(res => {
        console.log('🧪 SimpleTest: Response status:', res.status)
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${res.statusText}`)
        }
        return res.json()
      })
      .then(json => {
        console.log('🧪 SimpleTest: Data received:', {
          entitiesCount: json.entities?.length || 0,
          sampleEntity: json.entities?.[0]?.properties?.name
        })
        setData(json)
        setLoading(false)
      })
      .catch(err => {
        console.error('🧪 SimpleTest: Error:', err)
        setError(err)
        setLoading(false)
      })
  }, [])

  if (loading) {
    return <div className="text-white p-4">🧪 Loading test...</div>
  }

  if (error) {
    return <div className="text-red-500 p-4">🧪 Error: {error.message}</div>
  }

  return (
    <div className="text-white p-4">
      <h3 className="text-lg font-bold mb-4">🧪 Simple Test Component</h3>
      <div className="text-sm text-green-400 mb-2">
        ✓ API is working! Found {data?.entities?.length || 0} entities
      </div>
      <div className="text-xs text-gray-400">
        Sample entity: {data?.entities?.[0]?.properties?.name || 'None'}
      </div>
    </div>
  )
}