"use client"

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import Header from '@/components/header/Header'
import { useSportsEntities } from '@/lib/swr-config'

type Entity = {
  name?: string
  sport?: string
  country?: string
  level?: string
  website?: string
  linkedin?: string
  source?: string
}

export default function Home() {
  const { data: response, error, isLoading, mutate } = useSportsEntities()
  const entities = response?.entities || []
  
  const [query, setQuery] = useState<string>("")
  const [sportFilter, setSportFilter] = useState<string>("all")
  const [countryFilter, setCountryFilter] = useState<string>("all")
  const [levelFilter, setLevelFilter] = useState<string>("all")

  const uniqueOptions = useMemo(() => {
    const sports = new Set<string>()
    const countries = new Set<string>()
    const levels = new Set<string>()
    for (const e of entities) {
      const props = e.properties || {}
      if (props.sport) sports.add(props.sport)
      if (props.country) countries.add(props.country)
      if (props.level) levels.add(props.level)
    }
    return {
      sports: Array.from(sports).sort(),
      countries: Array.from(countries).sort(),
      levels: Array.from(levels).sort(),
    }
  }, [entities])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return entities.filter(e => {
      const props = e.properties || {}
      const matchesQuery = q
        ? (props.name ?? '').toLowerCase().includes(q) || (props.sport ?? '').toLowerCase().includes(q)
        : true
      const matchesSport = sportFilter === 'all' || (props.sport ?? '') === sportFilter
      const matchesCountry = countryFilter === 'all' || (props.country ?? '') === countryFilter
      const matchesLevel = levelFilter === 'all' || (props.level ?? '') === levelFilter
      return matchesQuery && matchesSport && matchesCountry && matchesLevel
    })
  }, [entities, query, sportFilter, countryFilter, levelFilter])

  return (
    <div className="min-h-screen bg-custom-bg">
      <Header />
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

        {/* Entities Overview with Search and Filters */}
        <div className="bg-custom-box border border-custom-border rounded-lg p-6 mb-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <h3 className="font-subheader text-fm-white">
              📚 Entities {isLoading ? <span className="text-fm-medium-grey">(loading...)</span> : <span className="text-fm-light-grey">({filtered.length}{filtered.length !== entities.length ? ` of ${entities.length}` : ''})</span>}
            </h3>
            <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto">
              <Input
                placeholder="Search by name or sport..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="bg-custom-bg border-custom-border text-fm-white placeholder:text-fm-medium-grey"
              />
              <Select value={sportFilter} onValueChange={setSportFilter}>
                <SelectTrigger className="w-full md:w-48 bg-custom-bg border-custom-border text-fm-white">
                  <SelectValue placeholder="Sport" />
                </SelectTrigger>
                <SelectContent className="bg-custom-box border-custom-border text-fm-white">
                  <SelectItem value="all">All sports</SelectItem>
                  {uniqueOptions.sports.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={countryFilter} onValueChange={setCountryFilter}>
                <SelectTrigger className="w-full md:w-48 bg-custom-bg border-custom-border text-fm-white">
                  <SelectValue placeholder="Country" />
                </SelectTrigger>
                <SelectContent className="bg-custom-box border-custom-border text-fm-white">
                  <SelectItem value="all">All countries</SelectItem>
                  {uniqueOptions.countries.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={levelFilter} onValueChange={setLevelFilter}>
                <SelectTrigger className="w-full md:w-48 bg-custom-bg border-custom-border text-fm-white">
                  <SelectValue placeholder="Level" />
                </SelectTrigger>
                <SelectContent className="bg-custom-box border-custom-border text-fm-white">
                  <SelectItem value="all">All levels</SelectItem>
                  {uniqueOptions.levels.map((l) => (
                    <SelectItem key={l} value={l}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {error && (
            <div className="mt-4 text-fm-orange font-body-secondary">Error loading entities: {error instanceof Error ? error.message : String(error)}</div>
          )}

          {/* Preview list */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-3">
            {filtered.slice(0, 10).map((e, idx) => {
              const props = e.properties || {}
              return (
                <div key={`${props.name || e.id}-${idx}`} className="border border-custom-border rounded-md p-4 bg-custom-bg">
                  <div className="font-body-primary text-fm-white">{props.name ?? 'Unnamed Entity'}</div>
                  <div className="font-body-secondary text-fm-medium-grey mt-1">
                    {(props.sport ?? 'Unknown sport')} • {(props.country ?? 'Unknown country')} {props.level ? `• ${props.level}` : ''}
                  </div>
                  {props.website && (
                    <a href={props.website} target="_blank" rel="noreferrer" className="font-body-secondary text-fm-green underline mt-2 inline-block">
                      Website
                    </a>
                  )}
                </div>
              )
            })}
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



