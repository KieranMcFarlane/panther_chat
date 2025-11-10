'use client'

import { useEffect, useState } from 'react'
import { FileText, TrendingUp, ExternalLink, Target } from 'lucide-react'
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
}

export function FeaturedOpportunities() {
  const [rfps, setRfps] = useState<RFP[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchRFPs = async () => {
      try {
        const response = await fetch('/api/tenders?action=opportunities&limit=3&orderBy=yellow_panther_fit&orderDirection=desc')
        const data = await response.json()
        if (data.opportunities) {
          setRfps(data.opportunities.slice(0, 3))
        }
      } catch (error) {
        console.error('Error fetching featured RFPs:', error)
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
            Featured Opportunities
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

  return (
    <Card className="bg-custom-box/80 backdrop-blur-md border border-custom-border">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-white flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-yellow-400" />
            Featured Opportunities
          </CardTitle>
          <Link href="/tenders">
            <Button variant="ghost" size="sm" className="text-fm-light-grey hover:text-white">
              View All
              <ExternalLink className="w-4 h-4 ml-1" />
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {rfps.map((rfp, index) => (
            <div
              key={rfp.id || index}
              className="p-4 rounded-lg bg-custom-bg border border-custom-border hover:border-yellow-400 transition-colors"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <div className="text-white font-semibold mb-1">{rfp.organization}</div>
                  <div className="text-sm text-fm-light-grey mb-2">{rfp.title}</div>
                </div>
                <Badge variant="secondary" className="ml-2">
                  {Math.round(rfp.yellow_panther_fit || 0)}% Fit
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <div className="text-sm text-fm-medium-grey">
                  {formatValue(rfp)}
                </div>
                <div className="flex gap-2">
                  <Link href={`/tenders#${rfp.id}`}>
                    <Button variant="outline" size="sm" className="text-xs">
                      View Details
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

