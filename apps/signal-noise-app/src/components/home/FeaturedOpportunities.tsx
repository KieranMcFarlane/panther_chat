'use client'

import { useEffect, useState } from 'react'
import { FileText, TrendingUp, ExternalLink, Target, Clock, Bookmark, Sparkles } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'

interface RFP {
  id: string
  title: string
  organization: string
  value?: string
  value_numeric?: number
  yellow_panther_fit: number
  category?: string
  deadline?: string
  priority?: string
}

export function TopOpportunities() {
  const [rfps, setRfps] = useState<RFP[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchRFPs = async () => {
      try {
        const response = await fetch('/api/tenders?action=opportunities&limit=5&orderBy=yellow_panther_fit&orderDirection=desc')
        const data = await response.json()
        if (data.opportunities) {
          setRfps(data.opportunities.slice(0, 5))
        }
      } catch (error) {
        console.error('Error fetching top opportunities:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchRFPs()
  }, [])

  if (loading) {
    return (
      <Card className="bg-custom-box/80 backdrop-blur-md border border-custom-border">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-yellow-400" />
            Top Opportunities for You
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

  if (rfps.length === 0) {
    return null
  }

  const formatValue = (rfp: RFP) => {
    if (rfp.value_numeric) {
      if (rfp.value_numeric >= 1000000) {
        return `£${Math.round(rfp.value_numeric / 1000000)}M-£${Math.round(rfp.value_numeric / 1000000 * 1.5)}M`
      }
      return `£${Math.round(rfp.value_numeric / 1000)}K-£${Math.round(rfp.value_numeric / 1000 * 1.5)}K`
    }
    return rfp.value || 'Value TBD'
  }

  const getDaysUntilDeadline = (deadline?: string) => {
    if (!deadline) return null
    const deadlineDate = new Date(deadline)
    const now = new Date()
    const diffTime = deadlineDate.getTime() - now.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays > 0 ? diffDays : null
  }

  const getPriorityBadge = (fit: number, deadline?: string) => {
    const daysUntil = getDaysUntilDeadline(deadline)
    if (fit >= 90) return { label: 'High Priority', variant: 'destructive' as const }
    if (daysUntil !== null && daysUntil <= 7) return { label: 'Urgent', variant: 'destructive' as const }
    if (fit >= 85) return { label: 'High Value', variant: 'default' as const }
    return null
  }

  return (
    <Card className="bg-custom-box/80 backdrop-blur-md border border-custom-border">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-white flex items-center gap-2 mb-1">
              <TrendingUp className="w-5 h-5 text-yellow-400" />
              Top Opportunities for You
            </CardTitle>
            <p className="text-sm text-fm-light-grey">Highest fit score opportunities</p>
          </div>
          <Link href="/tenders">
            <Button variant="ghost" size="sm" className="text-fm-light-grey hover:text-white">
              View All 40+
              <ExternalLink className="w-4 h-4 ml-1" />
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {rfps.map((rfp, index) => {
            const daysUntil = getDaysUntilDeadline(rfp.deadline)
            const priorityBadge = getPriorityBadge(rfp.yellow_panther_fit, rfp.deadline)
            
            return (
              <div
                key={rfp.id || index}
                className="p-4 rounded-lg bg-custom-bg border border-custom-border hover:border-yellow-400 transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    {priorityBadge && (
                      <Badge variant={priorityBadge.variant} className="mb-2 text-xs">
                        {priorityBadge.label}
                      </Badge>
                    )}
                    <div className="text-white font-semibold mb-1">{rfp.organization}</div>
                    <div className="text-sm text-fm-light-grey mb-2">{rfp.title}</div>
                  </div>
                  <Badge variant="secondary" className="ml-2 bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
                    {Math.round(rfp.yellow_panther_fit || 0)}% Match
                  </Badge>
                </div>
                
                <div className="flex items-center gap-4 mb-3 text-xs text-fm-medium-grey">
                  <div className="flex items-center gap-1">
                    <Target className="w-3 h-3" />
                    {formatValue(rfp)}
                  </div>
                  {daysUntil !== null && (
                    <div className={`flex items-center gap-1 ${daysUntil <= 7 ? 'text-orange-400' : ''}`}>
                      <Clock className="w-3 h-3" />
                      Due in {daysUntil} {daysUntil === 1 ? 'day' : 'days'}
                    </div>
                  )}
                </div>
                
                <div className="flex gap-2">
                  <Link href={`/tenders#${rfp.id}`} className="flex-1">
                    <Button variant="outline" size="sm" className="w-full text-xs border-custom-border hover:border-yellow-400">
                      View Details
                    </Button>
                  </Link>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-xs"
                    onClick={() => {
                      // TODO: Implement save functionality
                      console.log('Save opportunity:', rfp.id)
                    }}
                  >
                    <Bookmark className="w-3 h-3" />
                  </Button>
                  <Link href={`/rfp-intelligence?entity=${rfp.organization}`}>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="text-xs"
                      title="Generate Intelligence Dossier"
                    >
                      <Sparkles className="w-3 h-3" />
                    </Button>
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

