'use client'

import { useEffect, useState } from 'react'
import { FileText, Calendar, Bookmark, Clock, ArrowRight, ExternalLink } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'

interface DashboardData {
  newOpportunities: number
  upcomingDeadlines: number
  savedOpportunities: number
  recentActivity: string[]
}

export function YourDashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        // Fetch new opportunities (last 24 hours)
        const rfpResponse = await fetch('/api/tenders?action=opportunities&limit=100')
        const rfpData = await rfpResponse.json()
        
        const now = new Date()
        const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
        
        const newRFPs = rfpData.opportunities?.filter((opp: any) => {
          const detectedAt = new Date(opp.detected_at || opp.created_at)
          return detectedAt >= dayAgo
        }) || []

        // Calculate upcoming deadlines (next 7 days)
        const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
        const upcomingDeadlines = rfpData.opportunities?.filter((opp: any) => {
          if (!opp.deadline) return false
          const deadline = new Date(opp.deadline)
          return deadline >= now && deadline <= weekFromNow
        }) || []

        setData({
          newOpportunities: newRFPs.length,
          upcomingDeadlines: upcomingDeadlines.length,
          savedOpportunities: 0, // TODO: Implement saved opportunities
          recentActivity: []
        })
      } catch (error) {
        console.error('Error fetching dashboard data:', error)
        setData({
          newOpportunities: 0,
          upcomingDeadlines: 0,
          savedOpportunities: 0,
          recentActivity: []
        })
      } finally {
        setLoading(false)
      }
    }

    fetchDashboardData()
  }, [])

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="bg-custom-box/80 backdrop-blur-md border border-custom-border">
            <CardContent className="p-6">
              <div className="animate-pulse">
                <div className="h-6 w-32 bg-white/10 rounded mb-4" />
                <div className="h-8 w-16 bg-white/10 rounded mb-2" />
                <div className="h-4 w-48 bg-white/10 rounded" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (!data) return null

  const dashboardCards = [
    {
      icon: FileText,
      title: 'New Opportunities',
      count: data.newOpportunities,
      description: data.newOpportunities > 0 
        ? `${data.newOpportunities} RFPs detected in the last 24 hours`
        : 'No new opportunities',
      link: '/tenders?filter=new',
      color: 'text-green-400',
      bgColor: 'bg-green-500/20',
      action: 'View New'
    },
    {
      icon: Clock,
      title: 'Upcoming Deadlines',
      count: data.upcomingDeadlines,
      description: data.upcomingDeadlines > 0
        ? `${data.upcomingDeadlines} deadlines this week`
        : 'No upcoming deadlines',
      link: '/tenders?filter=deadlines',
      color: 'text-orange-400',
      bgColor: 'bg-orange-500/20',
      action: 'View Calendar'
    },
    {
      icon: Bookmark,
      title: 'Saved Opportunities',
      count: data.savedOpportunities,
      description: data.savedOpportunities > 0
        ? `${data.savedOpportunities} saved RFPs`
        : 'Save opportunities to track them',
      link: '/tenders?filter=saved',
      color: 'text-yellow-400',
      bgColor: 'bg-yellow-500/20',
      action: 'Manage Saved'
    }
  ]

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-2xl font-bold text-white mb-1">Your Dashboard</h2>
          <p className="text-sm text-fm-light-grey">Quick overview of what matters to you</p>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {dashboardCards.map((card, index) => (
          <Link key={index} href={card.link}>
            <Card className="bg-custom-box/80 backdrop-blur-md border border-custom-border hover:border-yellow-400 transition-all cursor-pointer h-full">
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className={`p-3 rounded-lg ${card.bgColor}`}>
                    <card.icon className={`w-6 h-6 ${card.color}`} />
                  </div>
                  <ArrowRight className="w-4 h-4 text-fm-medium-grey" />
                </div>
                <div className="text-3xl font-bold text-white mb-2">{card.count}</div>
                <div className="text-sm font-semibold text-fm-light-grey mb-2">{card.title}</div>
                <div className="text-xs text-fm-medium-grey mb-4">{card.description}</div>
                <Button 
                  variant="outline" 
                  size="sm"
                  className="w-full border-custom-border text-fm-light-grey hover:text-white hover:border-yellow-400"
                  onClick={(e) => {
                    e.preventDefault()
                    window.location.href = card.link
                  }}
                >
                  {card.action}
                  <ExternalLink className="w-3 h-3 ml-2" />
                </Button>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}











