'use client'

import { useEffect, useState } from 'react'
import { Calendar, MapPin, Users, ExternalLink } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'

interface Convention {
  id: string
  title: string
  location: string
  start_date: string
  networking_score: number
  expected_attendees?: number
}

export function UpcomingConventions() {
  const [conventions, setConventions] = useState<Convention[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchConventions = async () => {
      try {
        const response = await fetch('/api/conventions')
        const data = await response.json()
        if (data.conventions) {
          // Filter upcoming and sort by networking score
          const now = new Date()
          const upcoming = data.conventions
            .filter((conv: any) => new Date(conv.start || conv.start_date) >= now)
            .sort((a: any, b: any) => (b.networkingScore || b.networking_score || 0) - (a.networkingScore || a.networking_score || 0))
            .slice(0, 3)
          setConventions(upcoming)
        }
      } catch (error) {
        console.error('Error fetching conventions:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchConventions()
  }, [])

  if (loading) {
    return (
      <Card className="bg-custom-box/80 backdrop-blur-md border border-custom-border">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Calendar className="w-5 h-5 text-purple-400" />
            Upcoming Conventions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse">
                <div className="h-4 w-48 bg-white/10 rounded mb-2" />
                <div className="h-3 w-32 bg-white/10 rounded" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (conventions.length === 0) {
    return null
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  return (
    <Card className="bg-custom-box/80 backdrop-blur-md border border-custom-border">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-white flex items-center gap-2">
            <Calendar className="w-5 h-5 text-purple-400" />
            Upcoming Conventions
          </CardTitle>
          <Link href="/conventions">
            <Button variant="ghost" size="sm" className="text-fm-light-grey hover:text-white">
              View Calendar
              <ExternalLink className="w-4 h-4 ml-1" />
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {conventions.map((conv, index) => {
            const networkingScore = conv.networking_score || (conv as any).networkingScore || 0
            return (
              <div
                key={conv.id || index}
                className="p-4 rounded-lg bg-custom-bg border border-custom-border hover:border-purple-400 transition-colors"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="text-white font-semibold mb-1">{conv.title}</div>
                    <div className="flex items-center gap-4 text-sm text-fm-light-grey">
                      <div className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {conv.location}
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {formatDate(conv.start_date || (conv as any).start)}
                      </div>
                    </div>
                  </div>
                  <Badge variant="secondary" className="ml-2">
                    {networkingScore}/10
                  </Badge>
                </div>
                {conv.expected_attendees && (
                  <div className="flex items-center gap-1 text-xs text-fm-medium-grey mt-2">
                    <Users className="w-3 h-3" />
                    {conv.expected_attendees.toLocaleString()}+ attendees
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}











