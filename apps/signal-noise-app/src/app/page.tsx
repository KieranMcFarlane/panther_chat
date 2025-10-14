"use client"

import Link from 'next/link'

export default function Home() {

  return (
    <div className="min-h-screen" style={{background: '#242834'}}>
      <main className="flex min-h-screen flex-col items-center justify-center p-24">
        <div className="z-10 max-w-5xl w-full items-center justify-between">
        <h1 className="font-header-large text-fm-white text-center mb-8">
          Signal Noise App
        </h1>
        <p className="font-body-primary-large text-fm-light-grey text-center mb-8">
          AI-powered dossier enrichment system with Neo4j integration
        </p>
        
        <div className="text-center mb-12">
          <p className="font-body-primary text-fm-medium-grey mb-4">
            Use the sidebar navigation to explore different sections of the application
          </p>
        </div>

        {/* System Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <div className="bg-custom-box border border-custom-border rounded-lg p-6">
            <h3 className="font-subheader text-fm-white mb-3">🏗️ System Architecture</h3>
            <ul className="font-body-secondary text-fm-light-grey space-y-2">
              <li>• FastAPI Backend</li>
              <li>• Neo4j Knowledge Graph</li>
              <li>• Celery Background Workers</li>
              <li>• Redis Message Broker</li>
            </ul>
          </div>

          <div className="bg-custom-box border border-custom-border rounded-lg p-6">
            <h3 className="font-subheader text-fm-white mb-3">🔌 Services Status</h3>
            <ul className="font-body-secondary text-fm-light-grey space-y-2">
              <li>• Backend API: Running</li>
              <li>• Neo4j Database: Connected</li>
              <li>• Redis: Active</li>
              <li>• Bright Data MCP: Collecting Real Tenders</li>
            </ul>
          </div>

          <div className="bg-custom-box border border-custom-border rounded-lg p-6">
            <h3 className="font-subheader text-fm-white mb-3">📊 Data Sources</h3>
            <ul className="font-body-secondary text-fm-light-grey space-y-2">
              <li>• LinkedIn Tenders</li>
              <li>• iSportConnect RFPs</li>
              <li>• Web Scraping</li>
              <li>• Knowledge Graph</li>
            </ul>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="text-center">
          <div className="bg-custom-box border border-custom-border rounded-lg p-6">
            <h3 className="font-subheader text-fm-white mb-4">Quick Access</h3>
            <div className="flex flex-wrap justify-center gap-4">
              <Link 
                href="/tenders"
                className="inline-flex items-center px-4 py-2 bg-fm-yellow text-custom-bg font-body-medium rounded-md hover:bg-yellow-400 transition-colors"
              >
                🏆 View Tenders
              </Link>
              <Link 
                href="/sports-dashboard"
                className="inline-flex items-center px-4 py-2 bg-fm-green text-custom-bg font-body-medium rounded-md hover:bg-green-400 transition-colors"
              >
                🏈 Sports Dashboard
              </Link>
              <Link 
                href="/api/health"
                className="inline-flex items-center px-4 py-2 bg-fm-orange text-custom-bg font-body-medium rounded-md hover:bg-orange-400 transition-colors"
              >
                🔌 API Health
              </Link>
            </div>
          </div>
        </div>
      </div>
    </main>
    </div>
  )
}



