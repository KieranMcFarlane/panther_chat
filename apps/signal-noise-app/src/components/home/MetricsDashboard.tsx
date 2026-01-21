'use client'

import { useEffect, useState } from 'react'
import { Database, FileText, Calendar, Network, ChevronDown, ChevronUp } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'

interface MetricsData {
  entities: { total: number; recent: number; cached: boolean }
  rfps: { total: number; pipeline_value: number; pipeline_value_formatted: string; high_fit: number; recent: number }
  conventions: { upcoming: number; high_value: number }
  graph: { nodes: number; edges: number; cached: boolean }
  timestamp: string
}

export function CollapsibleMetrics() {
  const [metrics, setMetrics] = useState<MetricsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const response = await fetch('/api/home/metrics')
        const data = await response.json()
        setMetrics(data)
      } catch (error) {
        console.error('Error fetching metrics:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchMetrics()
    // Refresh every 30 seconds
    const interval = setInterval(fetchMetrics, 30000)
    return () => clearInterval(interval)
  }, [])

  if (!metrics && !loading) return null

  const quickStats = metrics ? [
    { label: 'RFPs', value: metrics.rfps.total },
    { label: 'Pipeline', value: metrics.rfps.pipeline_value_formatted },
    { label: 'Conventions', value: metrics.conventions.upcoming }
  ] : []

  const metricCards = metrics ? [
    {
      icon: Database,
      title: 'Entities',
      value: metrics.entities.total.toLocaleString(),
      subtitle: `${metrics.entities.recent} recent`,
      link: '/entity-browser',
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/20'
    },
    {
      icon: FileText,
      title: 'RFPs',
      value: metrics.rfps.total.toString(),
      subtitle: metrics.rfps.pipeline_value_formatted,
      link: '/tenders',
      color: 'text-green-400',
      bgColor: 'bg-green-500/20'
    },
    {
      icon: Calendar,
      title: 'Conventions',
      value: metrics.conventions.upcoming.toString(),
      subtitle: `${metrics.conventions.high_value} high-value`,
      link: '/conventions',
      color: 'text-purple-400',
      bgColor: 'bg-purple-500/20'
    },
    {
      icon: Network,
      title: 'Graph Nodes',
      value: metrics.graph.nodes.toLocaleString(),
      subtitle: `${metrics.graph.edges.toLocaleString()} relationships`,
      link: '/graph',
      color: 'text-orange-400',
      bgColor: 'bg-orange-500/20'
    }
  ] : []

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-white mb-1">Platform Overview</h2>
          <p className="text-sm text-fm-light-grey">Key metrics at a glance</p>
        </div>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="text-fm-light-grey hover:text-white">
            {isOpen ? (
              <>
                <ChevronUp className="w-4 h-4 mr-2" />
                Hide Details
              </>
            ) : (
              <>
                <ChevronDown className="w-4 h-4 mr-2" />
                Show Details
              </>
            )}
          </Button>
        </CollapsibleTrigger>
      </div>

      {/* Quick Stats (Always Visible) */}
      <div className="flex flex-wrap gap-4 mb-4">
        {quickStats.map((stat, index) => (
          <div key={index} className="px-4 py-2 rounded-lg bg-custom-box/80 border border-custom-border">
            <div className="text-xs text-fm-medium-grey mb-1">{stat.label}</div>
            <div className="text-lg font-bold text-white">{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Detailed Metrics (Collapsible) */}
      <CollapsibleContent>
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} className="bg-custom-box/80 backdrop-blur-md border border-custom-border">
                <CardContent className="p-6">
                  <div className="animate-pulse">
                    <div className="h-6 w-24 bg-white/10 rounded mb-4" />
                    <div className="h-8 w-32 bg-white/10 rounded mb-2" />
                    <div className="h-4 w-20 bg-white/10 rounded" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {metricCards.map((card, index) => (
              <Link key={index} href={card.link}>
                <Card className="bg-custom-box/80 backdrop-blur-md border border-custom-border hover:border-yellow-400 transition-all cursor-pointer h-full">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className={`p-3 rounded-lg ${card.bgColor}`}>
                        <card.icon className={`w-6 h-6 ${card.color}`} />
                      </div>
                    </div>
                    <div className="text-3xl font-bold text-white mb-1">{card.value}</div>
                    <div className="text-sm text-fm-light-grey mb-2">{card.title}</div>
                    <div className="text-xs text-fm-medium-grey">{card.subtitle}</div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  )
}

