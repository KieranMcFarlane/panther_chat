/**
 * EntityTimeline Component
 *
 * Displays a temporal timeline of events for a sports entity.
 * Shows RFP detections, partnerships, executive changes, etc.
 *
 * Usage:
 *   <EntityTimeline entityId="arsenal-fc" limit={20} />
 */

'use client'

import { useState, useEffect } from 'react'
import useSWR from 'swr'

interface TimelineEvent {
  timestamp: string
  event_type: string
  description: string
  source?: string
  metadata?: Record<string, any>
}

interface TimelineResponse {
  entity_id: string
  event_count: number
  events: TimelineEvent[]
  timestamp: string
}

interface EntityTimelineProps {
  entityId: string
  limit?: number
  className?: string
  showHeader?: boolean
}

const fetcher = async (url: string) => {
  const res = await fetch(url)
  if (!res.ok) throw new Error('Failed to fetch timeline')
  return res.json()
}

function getEventTypeColor(eventType: string): string {
  const colors: Record<string, string> = {
    RFP_DETECTED: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    RFP_RESPONDED: 'bg-green-500/20 text-green-400 border-green-500/30',
    PARTNERSHIP_FORMED: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    PARTNERSHIP_ENDED: 'bg-red-500/20 text-red-400 border-red-500/30',
    EXECUTIVE_CHANGE: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    TECHNOLOGY_ADOPTED: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
    LEAGUE_PROMOTION: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    LEAGUE_RELEGATION: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  }
  return colors[eventType] || 'bg-gray-500/20 text-gray-400 border-gray-500/30'
}

function getEventTypeLabel(eventType: string): string {
  const labels: Record<string, string> = {
    RFP_DETECTED: 'RFP Detected',
    RFP_RESPONDED: 'RFP Responded',
    PARTNERSHIP_FORMED: 'Partnership',
    PARTNERSHIP_ENDED: 'Partnership Ended',
    EXECUTIVE_CHANGE: 'Executive Change',
    TECHNOLOGY_ADOPTED: 'Technology Adopted',
    LEAGUE_PROMOTION: 'Promoted',
    LEAGUE_RELEGATION: 'Relegated',
  }
  return labels[eventType] || eventType.replace(/_/g, ' ')
}

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`
  return date.toLocaleDateString()
}

export function EntityTimeline({
  entityId,
  limit = 20,
  className = '',
  showHeader = true,
}: EntityTimelineProps) {
  const { data, error, isLoading } = useSWR<TimelineResponse>(
    `/api/temporal/entity/${encodeURIComponent(entityId)}/timeline?limit=${limit}`,
    fetcher
  )

  if (isLoading) {
    return (
      <div className={`bg-zinc-900/50 border border-zinc-800 rounded-lg p-6 ${className}`}>
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={`bg-zinc-900/50 border border-zinc-800 rounded-lg p-6 ${className}`}>
        <div className="text-center text-zinc-500">
          <p className="mb-2">Unable to load timeline</p>
          <p className="text-sm">{error.message}</p>
        </div>
      </div>
    )
  }

  const events = data?.events || []

  if (events.length === 0) {
    return (
      <div className={`bg-zinc-900/50 border border-zinc-800 rounded-lg p-6 ${className}`}>
        {showHeader && (
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">Timeline</h3>
            <span className="text-sm text-zinc-500">No events</span>
          </div>
        )}
        <div className="text-center text-zinc-500 py-8">
          <p>No temporal events recorded for this entity</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`bg-zinc-900/50 border border-zinc-800 rounded-lg ${className}`}>
      {showHeader && (
        <div className="flex items-center justify-between p-4 border-b border-zinc-800">
          <h3 className="text-lg font-semibold text-white">Timeline</h3>
          <span className="text-sm text-zinc-400">{events.length} events</span>
        </div>
      )}

      <div className="p-4">
        {/* Timeline */}
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-4 top-0 bottom-0 w-px bg-zinc-800" />

          {/* Events */}
          <div className="space-y-4">
            {events.map((event, index) => (
              <div key={index} className="relative flex items-start gap-4">
                {/* Dot */}
                <div className={`w-2 h-2 rounded-full mt-2 ${
                  event.event_type === 'RFP_DETECTED'
                    ? 'bg-blue-500'
                    : 'bg-zinc-600'
                }`} />

                {/* Content */}
                <div className="flex-1 min-w-0 pb-4">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${getEventTypeColor(event.event_type)}`}>
                      {getEventTypeLabel(event.event_type)}
                    </span>
                    <span className="text-xs text-zinc-500 whitespace-nowrap">
                      {formatTimestamp(event.timestamp)}
                    </span>
                  </div>
                  <p className="text-sm text-zinc-300">{event.description}</p>
                  {event.source && (
                    <p className="text-xs text-zinc-600 mt-1">Source: {event.source}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Compact version for inline display
 */
export function EntityTimelineCompact({ entityId, limit = 5 }: { entityId: string; limit?: number }) {
  const { data, error } = useSWR<TimelineResponse>(
    `/api/temporal/entity/${encodeURIComponent(entityId)}/timeline?limit=${limit}`,
    fetcher
  )

  if (error || !data) return null

  const events = data.events || []

  return (
    <div className="space-y-2">
      {events.slice(0, 3).map((event, index) => (
        <div key={index} className="flex items-center gap-2 text-sm">
          <span className={`w-2 h-2 rounded-full ${
            event.event_type === 'RFP_DETECTED' ? 'bg-blue-500' : 'bg-zinc-600'
          }`} />
          <span className="text-zinc-400">{formatTimestamp(event.timestamp)}</span>
          <span className="text-zinc-300 truncate">{event.description}</span>
        </div>
      ))}
    </div>
  )
}
