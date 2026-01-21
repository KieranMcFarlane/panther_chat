'use client'

import { useState, useEffect, useCallback } from 'react'
import { Calendar, dateFnsLocalizer, View, Views } from 'react-big-calendar'
import { format, parse, startOfWeek, getDay } from 'date-fns'
import { enUS } from 'date-fns/locale'
import { 
  Calendar as CalendarIcon, 
  MapPin, 
  Users, 
  Building2, 
  ExternalLink,
  Filter,
  ChevronLeft,
  ChevronRight,
  Plus
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'

// Import calendar styles
import 'react-big-calendar/lib/css/react-big-calendar.css'

// Setup the localizer
const locales = {
  'en-US': enUS,
}

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
})

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

interface ConventionCalendarProps {
  onSelectEvent?: (event: Convention) => void
  onCreateEvent?: (date: Date) => void
}

export default function ConventionCalendar({ onSelectEvent, onCreateEvent }: ConventionCalendarProps) {
  const [conventions, setConventions] = useState<Convention[]>([])
  const [loading, setLoading] = useState(true)
  const [currentView, setCurrentView] = useState<View>(Views.MONTH)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedConvention, setSelectedConvention] = useState<Convention | null>(null)
  const [filters, setFilters] = useState({
    type: '',
    location: '',
    federation: ''
  })

  // Fetch conventions from API
  const fetchConventions = useCallback(async () => {
    try {
      setLoading(true)
      const searchParams = new URLSearchParams({
        year: currentDate.getFullYear().toString(),
        ...(filters.type && { type: filters.type }),
        ...(filters.location && { location: filters.location }),
        ...(filters.federation && { federation: filters.federation })
      })
      
      const response = await fetch(`/api/conventions?${searchParams}`)
      if (!response.ok) throw new Error('Failed to fetch conventions')
      
      const data = await response.json()
      
      // Convert string dates to Date objects for the calendar
      const conventionsWithDates = data.conventions.map((conv: any) => ({
        ...conv,
        start: new Date(conv.start),
        end: new Date(conv.end)
      }))
      
      setConventions(conventionsWithDates)
    } catch (error) {
      console.error('Error fetching conventions:', error)
      setConventions([])
    } finally {
      setLoading(false)
    }
  }, [currentDate, filters])

  useEffect(() => {
    fetchConventions()
  }, [fetchConventions])

  // Persist preferences (view/date/filters)
  useEffect(() => {
    try {
      const savedView = localStorage.getItem('conventions:view')
      const savedDate = localStorage.getItem('conventions:date')
      const savedFilters = localStorage.getItem('conventions:filters')
      if (savedView) setCurrentView(savedView as View)
      if (savedDate) setCurrentDate(new Date(savedDate))
      if (savedFilters) setFilters(JSON.parse(savedFilters))
    } catch {}
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem('conventions:view', String(currentView))
      localStorage.setItem('conventions:date', currentDate.toISOString())
      localStorage.setItem('conventions:filters', JSON.stringify(filters))
    } catch {}
  }, [currentView, currentDate, filters])

  // Keyboard shortcuts: ←/→ to navigate, T for today
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        const d = new Date(currentDate)
        if (currentView === Views.WEEK) d.setDate(d.getDate() - 7)
        else d.setMonth(d.getMonth() - 1)
        setCurrentDate(d)
      } else if (e.key === 'ArrowRight') {
        const d = new Date(currentDate)
        if (currentView === Views.WEEK) d.setDate(d.getDate() + 7)
        else d.setMonth(d.getMonth() + 1)
        setCurrentDate(d)
      } else if (e.key.toLowerCase() === 't') {
        setCurrentDate(new Date())
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [currentDate, currentView])

  // Custom event styling
  const eventStyleGetter = (event: Convention) => {
    const colors = {
      'c-level': 'bg-red-500 border-red-600',
      'media-rights': 'bg-blue-500 border-blue-600',
      'digital-ott': 'bg-green-500 border-green-600',
      'football-business': 'bg-purple-500 border-purple-600',
      'venue-stadium': 'bg-orange-500 border-orange-600',
      'federation-official': 'bg-indigo-500 border-indigo-600',
      'tech-innovation': 'bg-pink-500 border-pink-600',
      'networking-social': 'bg-yellow-500 border-yellow-600'
    }
    
    const colorClass = colors[event.type as keyof typeof colors] || 'bg-gray-500 border-gray-600'
    
    return {
      className: `${colorClass} text-white text-xs rounded px-1 py-0.5 border`,
      style: {
        borderRadius: '4px',
        opacity: 0.9,
        border: '1px solid'
      }
    }
  }

  // Custom toolbar
  const CustomToolbar = ({ date, onNavigate, onView }) => (
    <div className="flex items-center justify-between mb-4 bg-custom-box border border-custom-border rounded-lg p-4 sticky top-0 z-10">
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          onClick={() => onNavigate('PREV')}
          className="bg-custom-box/70 border border-custom-border text-white hover:bg-custom-box"
          aria-label="Previous"
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <Button
          size="sm"
          onClick={() => onNavigate('TODAY')}
          className="bg-custom-box/70 border border-custom-border text-white hover:bg-custom-box"
          aria-label="Today"
        >
          Today
        </Button>
        <Button
          size="sm"
          onClick={() => onNavigate('NEXT')}
          className="bg-custom-box/70 border border-custom-border text-white hover:bg-custom-box"
          aria-label="Next"
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
        <span className="text-white font-semibold ml-4">
          {format(date, 'MMMM yyyy')}
        </span>
      </div>
      
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          onClick={() => onView(Views.MONTH)}
          className={currentView === Views.MONTH ? 'bg-yellow-500 text-black' : 'bg-custom-box/70 border border-custom-border text-white hover:bg-custom-box'}
          aria-pressed={currentView === Views.MONTH}
          aria-label="Month view"
        >
          Month
        </Button>
        <Button
          size="sm"
          onClick={() => onView(Views.WEEK)}
          className={currentView === Views.WEEK ? 'bg-yellow-500 text-black' : 'bg-custom-box/70 border border-custom-border text-white hover:bg-custom-box'}
          aria-pressed={currentView === Views.WEEK}
          aria-label="Week view"
        >
          Week
        </Button>
        <Button
          size="sm"
          onClick={() => onView(Views.AGENDA)}
          className={currentView === Views.AGENDA ? 'bg-yellow-500 text-black' : 'bg-custom-box/70 border border-custom-border text-white hover:bg-custom-box'}
          aria-pressed={currentView === Views.AGENDA}
          aria-label="List view"
        >
          List
        </Button>
      </div>
    </div>
  )

  // Unified event type colors (legend + styling reference)
  const EVENT_TYPE_COLORS: Record<string, string> = {
    'c-level': 'bg-red-500',
    'media-rights': 'bg-blue-500',
    'digital-ott': 'bg-green-500',
    'federation-official': 'bg-indigo-500',
    'tech-innovation': 'bg-pink-500'
  }

  // Custom event card
  const EventCard = ({ event }: { event: Convention }) => (
    <div className="text-xs" onMouseEnter={() => onSelectEvent?.(event)}>
      <div className="font-semibold">{event.title}</div>
      <div className="flex items-center gap-1 mt-1">
        <MapPin className="w-3 h-3" />
        <span>{event.location}</span>
      </div>
      {event.expectedAttendees && (
        <div className="flex items-center gap-1 mt-1">
          <Users className="w-3 h-3" />
          <span>{event.expectedAttendees.toLocaleString()}</span>
        </div>
      )}
    </div>
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-400"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header with Filters */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2 page-title">Sports Convention Calendar</h1>
          <p className="text-fm-light-grey">Track key sports industry events and networking opportunities</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-fm-medium-grey" />
            <Input
              placeholder="Filter by location..."
              value={filters.location}
              onChange={(e) => setFilters(prev => ({ ...prev, location: e.target.value }))}
              className="bg-custom-box border-custom-border text-white placeholder:text-fm-medium-grey w-48"
            />
            <Input
              placeholder="Filter by federation..."
              value={filters.federation}
              onChange={(e) => setFilters(prev => ({ ...prev, federation: e.target.value }))}
              className="bg-custom-box border-custom-border text-white placeholder:text-fm-medium-grey w-48"
            />
          </div>
          <Button 
            onClick={() => setCurrentView(currentView === Views.MONTH ? Views.AGENDA : Views.MONTH)}
            className="bg-yellow-500 text-black hover:bg-yellow-400"
          >
            <CalendarIcon className="w-4 h-4 mr-2" />
            Toggle View
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Calendar */}
        <div className="lg:col-span-3">
          <Card className="bg-custom-box border border-custom-border">
            <div className="p-4">
              <Calendar
                localizer={localizer}
                events={conventions}
                startAccessor="start"
                endAccessor="end"
                view={currentView}
                views={[Views.MONTH, Views.WEEK, Views.AGENDA]}
                date={currentDate}
                onNavigate={setCurrentDate}
                onView={setCurrentView}
                onSelectEvent={(event) => {
                  setSelectedConvention(event as Convention)
                  onSelectEvent?.(event as Convention)
                }}
                onSelectSlot={(slotInfo) => {
                  if (slotInfo.start && onCreateEvent) {
                    onCreateEvent(slotInfo.start)
                  }
                }}
                components={{
                  toolbar: CustomToolbar,
                  event: EventCard
                }}
                eventPropGetter={eventStyleGetter}
                style={{ 
                  height: 600, 
                  backgroundColor: '#1a1a1a',
                  color: '#ffffff'
                }}
                messages={{
                  next: "Next",
                  previous: "Previous",
                  today: "Today",
                  month: "Month",
                  week: "Week",
                  day: "Day",
                  agenda: "List",
                  date: "Date",
                  time: "Time",
                  event: "Event",
                  noEventsInRange: "No events in this range."
                }}
              />
            </div>
          </Card>
        </div>

        {/* Sidebar with Event Details */}
        <div className="lg:col-span-1">
          <div className="space-y-4">
            {/* Event Type Legend */}
            <Card className="bg-custom-box border border-custom-border p-4">
              <h3 className="text-white font-semibold mb-3">Event Types</h3>
              <div className="space-y-2">
                {(
                  [
                    { type: 'c-level', label: 'C-Level Executive' },
                    { type: 'media-rights', label: 'Media Rights' },
                    { type: 'digital-ott', label: 'Digital/OTT' },
                    { type: 'federation-official', label: 'Federation Official' },
                    { type: 'tech-innovation', label: 'Tech Innovation' }
                  ] as Array<{ type: string; label: string }>
                ).map(({ type, label }) => (
                  <div key={type} className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded ${EVENT_TYPE_COLORS[type] || 'bg-gray-500'}`}></div>
                    <span className="text-fm-light-grey text-sm">{label}</span>
                  </div>
                ))}
              </div>
            </Card>

            {/* Selected Event Details */}
            {selectedConvention && (
              <Card className="bg-custom-box border border-custom-border p-4">
                <h3 className="text-white font-semibold mb-3">Event Details</h3>
                <div className="space-y-3">
                  <div>
                    <h4 className="text-white font-medium">{selectedConvention.title}</h4>
                    <p className="text-fm-light-grey text-sm mt-1">{selectedConvention.description}</p>
                  </div>
                  
                  <div>
                    <div className="flex items-center gap-2 text-fm-light-grey text-sm">
                      <CalendarIcon className="w-4 h-4" />
                      {format(selectedConvention.start, 'MMM dd, yyyy')}
                    </div>
                    <div className="flex items-center gap-2 text-fm-light-grey text-sm mt-1">
                      <MapPin className="w-4 h-4" />
                      {selectedConvention.location}
                    </div>
                    <div className="flex items-center gap-2 text-fm-light-grey text-sm mt-1">
                      <Users className="w-4 h-4" />
                      {selectedConvention.expectedAttendees?.toLocaleString()} attendees
                    </div>
                  </div>

                  <div>
                    <div className="text-fm-medium-grey text-sm mb-2">Networking Score</div>
                    <div className="flex items-center gap-2">
                      <div className="flex">
                        {[...Array(10)].map((_, i) => (
                          <div
                            key={i}
                            className={`w-2 h-4 ${i < selectedConvention.networkingScore ? 'bg-yellow-400' : 'bg-gray-600'}`}
                          />
                        ))}
                      </div>
                      <span className="text-white text-sm">{selectedConvention.networkingScore}/10</span>
                    </div>
                  </div>

                  <div>
                    <div className="text-fm-medium-grey text-sm mb-2">Key Federations</div>
                    <div className="flex flex-wrap gap-1">
                      {selectedConvention.federations.slice(0, 4).map((fed, index) => (
                        <Badge key={index} variant="secondary" className="text-xs">
                          {fed}
                        </Badge>
                      ))}
                      {selectedConvention.federations.length > 4 && (
                        <Badge variant="outline" className="text-xs">
                          +{selectedConvention.federations.length - 4} more
                        </Badge>
                      )}
                    </div>
                  </div>

                  {selectedConvention.hasRelatedEntities && (
                    <div>
                      <div className="text-fm-medium-grey text-sm mb-2">Related Entities in Database</div>
                      <div className="space-y-1">
                        {selectedConvention.relatedEntities?.slice(0, 3).map((entity, index) => (
                          <div key={entity.id} className="text-fm-light-grey text-xs">
                            • {entity.name} ({entity.type})
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedConvention.webUrl && (
                    <Button
                      size="sm"
                      className="w-full bg-yellow-500 text-black hover:bg-yellow-400"
                      onClick={() => window.open(selectedConvention.webUrl, '_blank')}
                    >
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Visit Website
                    </Button>
                  )}
                </div>
              </Card>
            )}

            {/* Quick Stats */}
            <Card className="bg-custom-box border border-custom-border p-4">
              <h3 className="text-white font-semibold mb-3">This Month</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-fm-light-grey">Total Events</span>
                  <span className="text-white">{conventions.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-fm-light-grey">High Value (8+ score)</span>
                  <span className="text-green-400">
                    {conventions.filter(c => c.networkingScore >= 8).length}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-fm-light-grey">UK Based</span>
                  <span className="text-blue-400">
                    {conventions.filter(c => c.location.toLowerCase().includes('london') || c.location.toLowerCase().includes('manchester')).length}
                  </span>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}