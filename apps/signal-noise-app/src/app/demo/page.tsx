"use client"

import { MetricsDashboard } from "@/components/home/MetricsDashboard"
import { FeaturedOpportunities } from "@/components/home/FeaturedOpportunities"
import { UpcomingConventions } from "@/components/home/UpcomingConventions"
import { ActivityFeed } from "@/components/home/ActivityFeed"
import { SystemStatusPanel } from "@/components/home/SystemStatusPanel"
import { FeatureCards } from "@/components/home/FeatureCards"

export default function DemoHero() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900">
      {/* Content Overlay */}
      <div className="relative z-10 px-6 py-12">
        <div className="max-w-7xl mx-auto">
          {/* Hero Section */}
          <div className="text-center mb-12">
            <h1 className="font-header-large text-fm-white text-center mb-6 drop-shadow-lg">
              Signal Noise App
            </h1>
            
            <p className="font-body-primary-large text-fm-light-grey text-center mb-4 drop-shadow-md">
              AI-powered sports intelligence platform with real-time RFP detection
            </p>
            
            <p className="font-body-primary text-fm-medium-grey text-center mb-8 drop-shadow max-w-3xl mx-auto">
              Advanced dossier enrichment system combining Neo4j knowledge graphs with 
              BrightData web scraping for comprehensive sports industry intelligence
            </p>
          </div>

          {/* Key Metrics Dashboard */}
          <MetricsDashboard />

          {/* Featured Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <FeaturedOpportunities />
            <ActivityFeed />
          </div>

          {/* Quick Access Feature Cards */}
          <FeatureCards />

          {/* Bottom Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <UpcomingConventions />
            <SystemStatusPanel />
          </div>

          {/* Value Proposition Section */}
          <div className="bg-custom-box/80 backdrop-blur-md border border-custom-border rounded-lg p-8 mb-8">
            <h2 className="text-2xl font-bold text-white mb-6 text-center">Why Signal Noise?</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
              <div className="text-center">
                <div className="text-3xl mb-2">🤖</div>
                <div className="text-sm font-semibold text-white mb-1">AI-Powered Detection</div>
                <div className="text-xs text-fm-light-grey">Never miss an opportunity</div>
              </div>
              <div className="text-center">
                <div className="text-3xl mb-2">📊</div>
                <div className="text-sm font-semibold text-white mb-1">Comprehensive Database</div>
                <div className="text-xs text-fm-light-grey">4,422+ sports entities</div>
              </div>
              <div className="text-center">
                <div className="text-3xl mb-2">⚡</div>
                <div className="text-sm font-semibold text-white mb-1">Real-time Intelligence</div>
                <div className="text-xs text-fm-light-grey">Live updates and alerts</div>
              </div>
              <div className="text-center">
                <div className="text-3xl mb-2">🕸️</div>
                <div className="text-sm font-semibold text-white mb-1">Knowledge Graph</div>
                <div className="text-xs text-fm-light-grey">See relationships</div>
              </div>
              <div className="text-center">
                <div className="text-3xl mb-2">📅</div>
                <div className="text-sm font-semibold text-white mb-1">Convention Intelligence</div>
                <div className="text-xs text-fm-light-grey">Network at the right events</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
