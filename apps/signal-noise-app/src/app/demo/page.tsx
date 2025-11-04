"use client"

import { LiquidButton } from "@/components/ui/liquid-glass-button"
import Link from "next/link"

export default function DemoHero() {
  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900">
      {/* Content Overlay */}
      <div className="relative z-10 text-center px-6 py-12">
        <div className="max-w-4xl mx-auto">
          {/* Main Title */}
          <h1 className="font-header-large text-fm-white text-center mb-6 drop-shadow-lg">
            Signal Noise App
          </h1>
          
          {/* Subtitle */}
          <p className="font-body-primary-large text-fm-light-grey text-center mb-12 drop-shadow-md">
            AI-powered sports intelligence platform with real-time RFP detection
          </p>
          
          {/* Description */}
          <div className="text-center mb-16">
            <p className="font-body-primary text-fm-medium-grey mb-8 drop-shadow">
              Advanced dossier enrichment system combining Neo4j knowledge graphs with 
              BrightData web scraping for comprehensive sports industry intelligence
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap justify-center gap-6 mb-16">
            <Link href="/tenders">
              <LiquidButton 
                size="xxl"
                className="text-white font-body-medium"
              >
                🏆 View Tenders
              </LiquidButton>
            </Link>
            
            <Link href="/sports-dashboard">
              <LiquidButton 
                size="xxl"
                className="text-white font-body-medium"
              >
                🏈 Sports Dashboard
              </LiquidButton>
            </Link>
            
            <Link href="/api/health">
              <LiquidButton 
                size="xxl"
                className="text-white font-body-medium"
              >
                🔌 API Health
              </LiquidButton>
            </Link>
          </div>

          {/* Feature Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="bg-custom-box/80 backdrop-blur-md border border-custom-border rounded-lg p-6">
              <h3 className="font-subheader text-fm-white mb-3">🏗️ System Architecture</h3>
              <ul className="font-body-secondary text-fm-light-grey space-y-2">
                <li>• FastAPI Backend</li>
                <li>• Neo4j Knowledge Graph</li>
                <li>• Celery Background Workers</li>
                <li>• Redis Message Broker</li>
              </ul>
            </div>

            <div className="bg-custom-box/80 backdrop-blur-md border border-custom-border rounded-lg p-6">
              <h3 className="font-subheader text-fm-white mb-3">🔌 Services Status</h3>
              <ul className="font-body-secondary text-fm-light-grey space-y-2">
                <li>• Backend API: Running</li>
                <li>• Neo4j Database: Connected</li>
                <li>• Redis: Active</li>
                <li>• Bright Data MCP: Collecting</li>
              </ul>
            </div>

            <div className="bg-custom-box/80 backdrop-blur-md border border-custom-border rounded-lg p-6">
              <h3 className="font-subheader text-fm-white mb-3">📊 Data Sources</h3>
              <ul className="font-body-secondary text-fm-light-grey space-y-2">
                <li>• LinkedIn Tenders</li>
                <li>• iSportConnect RFPs</li>
                <li>• Web Scraping</li>
                <li>• Knowledge Graph</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}