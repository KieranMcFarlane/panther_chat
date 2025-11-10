'use client'

import { FileText, Database, Calendar, Network, ArrowRight, Brain, TrendingUp, MapPin } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

interface FeatureCardProps {
  icon: React.ElementType
  title: string
  description: string
  stats: string
  preview?: React.ReactNode
  href: string
  color: string
  bgColor: string
}

function FeatureCard({ icon: Icon, title, description, stats, preview, href, color, bgColor }: FeatureCardProps) {
  return (
    <Link href={href}>
      <Card className="bg-custom-box/80 backdrop-blur-md border border-custom-border hover:border-yellow-400 transition-all cursor-pointer h-full group">
        <CardContent className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div className={`p-3 rounded-lg ${bgColor}`}>
              <Icon className={`w-6 h-6 ${color}`} />
            </div>
            <ArrowRight className="w-5 h-5 text-fm-medium-grey group-hover:text-yellow-400 group-hover:translate-x-1 transition-all" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
          <p className="text-sm text-fm-light-grey mb-4">{description}</p>
          <div className="text-xs text-fm-medium-grey mb-4">{stats}</div>
          {preview && (
            <div className="mt-4 pt-4 border-t border-custom-border">
              {preview}
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  )
}

export function FeatureCards() {
  const features = [
    {
      icon: Brain,
      title: 'RFP Intelligence',
      description: 'AI-powered RFP detection and analysis with real-time opportunity scoring',
      stats: '40+ opportunities detected | £21M+ pipeline',
      href: '/rfp-intelligence',
      color: 'text-green-400',
      bgColor: 'bg-green-500/20',
      preview: (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-fm-light-grey">Top Fit Score</span>
            <span className="text-yellow-400 font-semibold">95%</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-fm-light-grey">High Value RFPs</span>
            <span className="text-white font-semibold">15+</span>
          </div>
        </div>
      )
    },
    {
      icon: Database,
      title: 'Entity Browser',
      description: 'Comprehensive sports entity database with Neo4j knowledge graph integration',
      stats: '4,422+ entities | Real-time search',
      href: '/entity-browser',
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/20',
      preview: (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-fm-light-grey">Total Entities</span>
            <span className="text-white font-semibold">4,422+</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-fm-light-grey">Cached</span>
            <span className="text-green-400 font-semibold">✓ Active</span>
          </div>
        </div>
      )
    },
    {
      icon: Calendar,
      title: 'Conventions',
      description: 'Sports convention intelligence with networking scores and event tracking',
      stats: 'Upcoming events | High-value networking',
      href: '/conventions',
      color: 'text-purple-400',
      bgColor: 'bg-purple-500/20',
      preview: (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-fm-light-grey">Upcoming</span>
            <span className="text-white font-semibold">12+ events</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-fm-light-grey">High Value</span>
            <span className="text-purple-400 font-semibold">8+</span>
          </div>
        </div>
      )
    },
    {
      icon: Network,
      title: 'Knowledge Graph',
      description: 'Interactive visualization of entity relationships and connections',
      stats: '4,422+ nodes | 15,000+ relationships',
      href: '/graph',
      color: 'text-orange-400',
      bgColor: 'bg-orange-500/20',
      preview: (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-fm-light-grey">Graph Nodes</span>
            <span className="text-white font-semibold">4,422+</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-fm-light-grey">Relationships</span>
            <span className="text-orange-400 font-semibold">15K+</span>
          </div>
        </div>
      )
    }
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {features.map((feature, index) => (
        <FeatureCard key={index} {...feature} />
      ))}
    </div>
  )
}

