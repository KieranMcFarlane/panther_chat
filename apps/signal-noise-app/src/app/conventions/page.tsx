'use client'

import { useState, useEffect } from 'react'
import { Calendar, MapPin, Users, Building2, ExternalLink, Target, TrendingUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import ConventionCalendar from '@/components/calendar/ConventionCalendar'

interface Convention {
  id: string
  title: string
  start: Date
  end: Date
  location: string
  type: string
  description: string
  targetAttendees: string[]
  federations: string[]
  industries: string[]
  networkingScore: number
  expectedAttendees: number
  webUrl: string
  relatedEntities?: Array<{
    id: string
    name: string
    type: string
    labels: string[]
  }>
  hasRelatedEntities?: boolean
}

export default function ConventionsPage() {
  const [selectedConvention, setSelectedConvention] = useState<Convention | null>(null)
  const [conventions, setConventions] = useState<Convention[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Fetch initial conventions data
    const fetchConventions = async () => {
      try {
        const response = await fetch('/api/conventions')
        if (!response.ok) throw new Error('Failed to fetch conventions')
        
        const data = await response.json()
        
        // Convert string dates to Date objects
        const conventionsWithDates = data.conventions.map((conv: any) => ({
          ...conv,
          start: new Date(conv.start),
          end: new Date(conv.end)
        }))
        
        setConventions(conventionsWithDates)
      } catch (error) {
        console.error('Error fetching conventions:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchConventions()
  }, [])

  // Handle event selection
  const handleSelectEvent = (event: Convention) => {
    setSelectedConvention(event)
  }

  // Get upcoming high-value events (next 90 days)
  const getUpcomingHighValueEvents = () => {
    const now = new Date()
    const ninetyDaysFromNow = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000)
    
    return conventions
      .filter(conv => conv.start >= now && conv.start <= ninetyDaysFromNow)
      .filter(conv => conv.networkingScore >= 8)
      .sort((a, b) => a.start.getTime() - b.start.getTime())
      .slice(0, 5)
  }

  // Get federation hotspots
  const getFederationHotspots = () => {
    const locationCounts: { [key: string]: number } = {}
    
    conventions.forEach(conv => {
      const city = conv.location.split(',')[0]
      locationCounts[city] = (locationCounts[city] || 0) + 1
    })

    return Object.entries(locationCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([city, count]) => ({ city, count }))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-400"></div>
      </div>
    )
  }

  const upcomingHighValue = getUpcomingHighValueEvents()
  const federationHotspots = getFederationHotspots()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2 page-title">Sports Convention Intelligence</h1>
          <p className="text-fm-light-grey">Track key sports industry events and federation networking opportunities</p>
        </div>
        <Button className="bg-yellow-500 text-black hover:bg-yellow-400">
          <Calendar className="w-4 h-4 mr-2" />
          Export Calendar
        </Button>
      </div>

      {/* Quick Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-custom-box border border-custom-border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <Calendar className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <div className="text-2xl font-bold text-white">{conventions.length}</div>
              <div className="text-fm-medium-grey text-sm">Total Events</div>
            </div>
          </div>
        </Card>

        <Card className="bg-custom-box border border-custom-border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-500/20 rounded-lg">
              <TrendingUp className="w-6 h-6 text-green-400" />
            </div>
            <div>
              <div className="text-2xl font-bold text-white">
                {conventions.filter(c => c.networkingScore >= 8).length}
              </div>
              <div className="text-fm-medium-grey text-sm">High Value (8+ score)</div>
            </div>
          </div>
        </Card>

        <Card className="bg-custom-box border border-custom-border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <Building2 className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <div className="text-2xl font-bold text-white">
                {[...new Set(conventions.flatMap(c => c.federations))].length}
              </div>
              <div className="text-fm-medium-grey text-sm">Federations Tracked</div>
            </div>
          </div>
        </Card>

        <Card className="bg-custom-box border border-custom-border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-500/20 rounded-lg">
              <Target className="w-6 h-6 text-orange-400" />
            </div>
            <div>
              <div className="text-2xl font-bold text-white">
                {conventions.filter(c => c.location.toLowerCase().includes('london')).length}
              </div>
              <div className="text-fm-medium-grey text-sm">London Events</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upcoming High-Value Events */}
        <div className="lg:col-span-1">
          <Card className="bg-custom-box border border-custom-border p-4">
            <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-400" />
              Upcoming High-Value Events
            </h3>
            <div className="space-y-3">
              {upcomingHighValue.length > 0 ? (
                upcomingHighValue.map((conv) => (
                  <div
                    key={conv.id}
                    onClick={() => setSelectedConvention(conv)}
                    className="p-3 rounded-lg bg-custom-bg border border-custom-border cursor-pointer hover:border-yellow-400 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="text-white font-medium text-sm">{conv.title}</h4>
                      <Badge variant="secondary" className="text-xs">
                        {conv.networkingScore}/10
                      </Badge>
                    </div>
                    <div className="space-y-1 text-xs text-fm-light-grey">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-3 h-3" />
                        {conv.start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin className="w-3 h-3" />
                        {conv.location}
                      </div>
                      <div className="flex items-center gap-2">
                        <Users className="w-3 h-3" />
                        {conv.expectedAttendees.toLocaleString()} attendees
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {conv.federations.slice(0, 2).map((fed, index) => (
                        <Badge key={index} variant="outline" className="text-xs">
                          {fed}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center text-fm-medium-grey py-8">
                  No high-value events in the next 90 days
                </div>
              )}
            </div>
          </Card>

          {/* Federation Hotspots */}
          <Card className="bg-custom-box border border-custom-border p-4 mt-6">
            <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-orange-400" />
              Federation Hotspots
            </h3>
            <div className="space-y-2">
              {federationHotspots.map(({ city, count }, index) => (
                <div key={city} className="flex items-center justify-between p-2 rounded-lg bg-custom-bg">
                  <div className="flex items-center gap-2">
                    <div className="text-fm-light-grey text-sm">#{index + 1}</div>
                    <div className="text-white text-sm font-medium">{city}</div>
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    {count} events
                  </Badge>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Calendar */}
        <div className="lg:col-span-2">
          <ConventionCalendar onSelectEvent={handleSelectEvent} />
        </div>
      </div>

      {/* Selected Event Detail Modal/Overlay */}
      {selectedConvention && (
        <Card className="bg-custom-box border border-custom-border p-6 mt-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold text-white mb-2">{selectedConvention.title}</h2>
              <p className="text-fm-light-grey">{selectedConvention.description}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedConvention(null)}
              className="border-custom-border text-white hover:bg-custom-bg"
            >
              ×
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-fm-medium-grey">
                <Calendar className="w-4 h-4" />
                <span className="text-sm">Date</span>
              </div>
              <div className="text-white">
                {selectedConvention.start.toLocaleDateString('en-US', { 
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-fm-medium-grey">
                <MapPin className="w-4 h-4" />
                <span className="text-sm">Location</span>
              </div>
              <div className="text-white">{selectedConvention.location}</div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-fm-medium-grey">
                <Users className="w-4 h-4" />
                <span className="text-sm">Expected Attendance</span>
              </div>
              <div className="text-white">{selectedConvention.expectedAttendees.toLocaleString()}</div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-fm-medium-grey">
                <Target className="w-4 h-4" />
                <span className="text-sm">Networking Value</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex">
                  {[...Array(10)].map((_, i) => (
                    <div
                      key={i}
                      className={`w-2 h-4 ${i < selectedConvention.networkingScore ? 'bg-yellow-400' : 'bg-gray-600'}`}
                    />
                  ))}
                </div>
                <span className="text-white ml-2">{selectedConvention.networkingScore}/10</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-white font-semibold mb-3">Target Attendees</h3>
              <div className="space-y-2">
                {selectedConvention.targetAttendees.map((attendee, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-yellow-400 rounded-full"></div>
                    <span className="text-fm-light-grey text-sm">{attendee}</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-white font-semibold mb-3">Key Federations</h3>
              <div className="flex flex-wrap gap-2">
                {selectedConvention.federations.map((fed, index) => (
                  <Badge key={index} variant="secondary" className="text-xs">
                    {fed}
                  </Badge>
                ))}
              </div>
            </div>
          </div>

          {selectedConvention.hasRelatedEntities && (
            <div className="mt-6">
              <h3 className="text-white font-semibold mb-3">Related Entities in Database</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {selectedConvention.relatedEntities?.map((entity) => (
                  <div key={entity.id} className="p-3 rounded-lg bg-custom-bg border border-custom-border">
                    <div className="text-white font-medium text-sm">{entity.name}</div>
                    <div className="text-fm-medium-grey text-xs mt-1">{entity.type}</div>
                    <div className="flex gap-1 mt-2">
                      {entity.labels.slice(0, 2).map((label, index) => (
                        <Badge key={index} variant="outline" className="text-xs">
                          {label}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-4 mt-6">
            <Button
              className="bg-yellow-500 text-black hover:bg-yellow-400"
              onClick={() => window.open(selectedConvention.webUrl, '_blank')}
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              Visit Official Website
            </Button>
            <Button
              variant="outline"
              className="border-custom-border text-white hover:bg-custom-bg"
            >
              <Target className="w-4 h-4 mr-2" />
              Generate Lead Strategy
            </Button>
          </div>
        </Card>
      )}
    </div>
  )
}