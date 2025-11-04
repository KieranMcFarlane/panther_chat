'use client'

import { useState, useEffect } from 'react'
import { ChevronDownIcon, ChevronUpIcon, GlobeIcon, TrophyIcon, MapPinIcon } from 'lucide-react'

interface CompanyInfo {
  industry?: string
  company_size?: string
  founded?: string
  headquarters?: string
}

interface TenderRFP {
  title: string
  type: string
  value: string
  deadline: string
  description?: string
  status: string
}

interface KeyContact {
  name: string
  role: string
  linkedin?: string
}

interface SportsEntity {
  name: string
  sport: string
  sportCategory?: string
  country: string
  level: string
  website?: string
  linkedin?: string
  type: string
  tier: string
  priorityScore: number
  estimatedValue: string
  mobileApp: string
  digitalWeakness: string
  opportunityType: string
  description: string
  source: string
  enriched: boolean
  company_info?: CompanyInfo
  tenders_rfps?: TenderRFP[]
  key_contacts?: KeyContact[]
}

interface DashboardData {
  status: string
  database_overview: {
    total_entities: number
    sports_entities_count: number
    enriched_count: number
    success_rate: string
  }
  sports_entities: SportsEntity[]
}

export default function SportsDashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [originalData, setOriginalData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedEntities, setExpandedEntities] = useState<Set<string>>(new Set())
  const [showcaseTarget, setShowcaseTarget] = useState('')
  
  // Combined filter state (UX-friendly)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedSport, setSelectedSport] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')
  const [selectedCountry, setSelectedCountry] = useState('')
  const [selectedTier, setSelectedTier] = useState('')
  const [selectedType, setSelectedType] = useState('')
  const [selectedEnriched, setSelectedEnriched] = useState('') // '' | 'enriched' | 'pending'

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      console.log('Fetching data from sports-entities endpoint...')
      const response = await fetch('http://localhost:3000/sports-entities')
      console.log('Response status:', response.status)
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      const result = await response.json()
      console.log('Fetched data:', result)
      setData(result)
      setOriginalData(result)
      setError(null)
    } catch (err) {
      console.error('Error fetching data:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch data')
    } finally {
      setLoading(false)
    }
  }

  const toggleEntity = (entityName: string) => {
    const newExpanded = new Set(expandedEntities)
    if (newExpanded.has(entityName)) {
      newExpanded.delete(entityName)
    } else {
      newExpanded.add(entityName)
    }
    setExpandedEntities(newExpanded)
  }

  // Apply combined filters whenever selections change
  useEffect(() => {
    if (!originalData) return
    const filtered = originalData.sports_entities.filter((e) => {
      const matchesSearch =
        searchTerm === '' ||
        e.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        e.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        e.sport?.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesSport = selectedSport === '' || e.sport === selectedSport
      const matchesCategory = selectedCategory === '' || (e.sportCategory || '') === selectedCategory
      const matchesCountry = selectedCountry === '' || e.country === selectedCountry
      const matchesTier = selectedTier === '' || e.tier === selectedTier
      const matchesType = selectedType === '' || e.type === selectedType
      const matchesEnriched =
        selectedEnriched === '' || (selectedEnriched === 'enriched' ? e.enriched : !e.enriched)
      return (
        matchesSearch &&
        matchesSport &&
        matchesCategory &&
        matchesCountry &&
        matchesTier &&
        matchesType &&
        matchesEnriched
      )
    })
    setData({ ...originalData, sports_entities: filtered })
  }, [searchTerm, selectedSport, selectedCategory, selectedCountry, selectedTier, selectedType, selectedEnriched, originalData])

  if (loading) {
    return (
      <div className="min-h-screen bg-custom-bg flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-fm-yellow mx-auto mb-4"></div>
          <p className="font-body-primary text-fm-medium-grey">Loading sports dashboard...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-custom-bg flex items-center justify-center">
        <div className="text-center">
          <div className="text-fm-red text-xl mb-4 font-subheader">⚠️ Error loading data</div>
          <p className="font-body-primary text-fm-medium-grey mb-4">{error instanceof Error ? error.message : String(error)}</p>
          <button 
            onClick={fetchData}
            className="px-4 py-2 bg-fm-yellow text-custom-bg font-body-medium rounded hover:bg-yellow-400 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-custom-bg flex items-center justify-center">
        <div className="text-center">
          <p className="font-body-primary text-fm-medium-grey">No data available</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-custom-bg">
      {/* Header */}
      <div className="bg-custom-box shadow-sm border-b border-custom-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-header-large text-fm-white">⚽ Sports Entities Dashboard</h1>
              <p className="font-body-primary text-fm-medium-grey mt-2">MCP-Powered Entity Seeding with Real-time Enrichment</p>
            </div>
            <button
              onClick={fetchData}
              className="bg-fm-yellow text-custom-bg px-4 py-2 rounded-lg hover:bg-yellow-400 transition-colors flex items-center gap-2 font-body-medium"
            >
              🔄 Refresh Data
            </button>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-custom-box border border-custom-border rounded-lg shadow p-6">
            <div className="text-2xl font-highlight text-fm-yellow">{data.database_overview.sports_entities_count}</div>
            <div className="font-body-secondary text-fm-medium-grey">Teams Seeded</div>
          </div>
          <div className="bg-custom-box border border-custom-border rounded-lg shadow p-6">
            <div className="text-2xl font-highlight text-fm-green">{data.database_overview.success_rate}</div>
            <div className="font-body-secondary text-fm-medium-grey">Enrichment Rate</div>
          </div>
          <div className="bg-custom-box border border-custom-border rounded-lg shadow p-6">
            <div className="text-2xl font-highlight text-fm-white">{data.database_overview.enriched_count}</div>
            <div className="font-body-secondary text-fm-medium-grey">MCP Enrichments</div>
          </div>
          <div className="bg-custom-box border border-custom-border rounded-lg shadow p-6">
            <div className="text-2xl font-highlight text-fm-orange">{data.database_overview.total_entities}</div>
            <div className="font-body-secondary text-fm-medium-grey">Total Entities</div>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="bg-custom-box border border-custom-border rounded-lg shadow mb-8">
          <div className="px-6 py-4 border-b border-custom-border">
            <h2 className="font-subheader text-fm-white">🔍 Search & Filter Entities</h2>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 mb-4">
              <input
                type="text"
                placeholder="Search entities..."
                className="col-span-1 md:col-span-2 lg:col-span-2 bg-custom-bg border border-custom-border rounded-md px-3 py-2 text-fm-light-grey placeholder-fm-medium-grey focus:outline-none focus:ring-2 focus:ring-fm-yellow focus:border-transparent"
                onChange={(e) => {
                  setSearchTerm(e.target.value)
                }}
              />
              <select 
                className="bg-custom-bg border border-custom-border rounded-md px-3 py-2 text-fm-light-grey focus:outline-none focus:ring-2 focus:ring-fm-yellow focus:border-transparent"
                onChange={(e) => {
                  setSelectedSport(e.target.value)
                }}
              >
                <option value="">All Sports</option>
                {originalData && [...new Set(originalData.sports_entities.map(e => e.sport).filter(Boolean))].map(sport => (
                  <option key={sport} value={sport}>{sport}</option>
                ))}
              </select>
              <select 
                className="bg-custom-bg border border-custom-border rounded-md px-3 py-2 text-fm-light-grey focus:outline-none focus:ring-2 focus:ring-fm-yellow focus:border-transparent"
                onChange={(e) => {
                  setSelectedCategory(e.target.value)
                }}
              >
                <option value="">All Categories</option>
                {originalData && [...new Set(originalData.sports_entities.map(e => e.sportCategory).filter(Boolean))].map(cat => (
                  <option key={cat as string} value={cat as string}>{cat as string}</option>
                ))}
              </select>
              <select 
                className="bg-custom-bg border border-custom-border rounded-md px-3 py-2 text-fm-light-grey focus:outline-none focus:ring-2 focus:ring-fm-yellow focus:border-transparent"
                onChange={(e) => {
                  setSelectedCountry(e.target.value)
                }}
              >
                <option value="">All Countries</option>
                {originalData && [...new Set(originalData.sports_entities.map(e => e.country).filter(Boolean))].map(country => (
                  <option key={country} value={country}>{country}</option>
                ))}
              </select>
              <select 
                className="bg-custom-bg border border-custom-border rounded-md px-3 py-2 text-fm-light-grey focus:outline-none focus:ring-2 focus:ring-fm-yellow focus:border-transparent"
                onChange={(e) => {
                  setSelectedTier(e.target.value)
                }}
              >
                <option value="">All Tiers</option>
                {originalData && [...new Set(originalData.sports_entities.map(e => e.tier).filter(Boolean))].map(tier => (
                  <option key={tier} value={tier}>{tier.replace('_', ' ').toUpperCase()}</option>
                ))}
              </select>
              <select 
                className="bg-custom-bg border border-custom-border rounded-md px-3 py-2 text-fm-light-grey focus:outline-none focus:ring-2 focus:ring-fm-yellow focus:border-transparent"
                onChange={(e) => {
                  setSelectedType(e.target.value)
                }}
              >
                <option value="">All Types</option>
                {originalData && [...new Set(originalData.sports_entities.map(e => e.type).filter(Boolean))].map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
              <select 
                className="bg-custom-bg border border-custom-border rounded-md px-3 py-2 text-fm-light-grey focus:outline-none focus:ring-2 focus:ring-fm-yellow focus:border-transparent"
                onChange={(e) => {
                  setSelectedEnriched(e.target.value)
                }}
              >
                <option value="">All Status</option>
                <option value="enriched">Enriched</option>
                <option value="pending">Pending</option>
              </select>
            </div>
            <div className="flex items-center justify-between">
              <p className="font-body-secondary text-fm-light-grey">
                Showing {data.sports_entities.length} of {data.database_overview.total_entities} entities
              </p>
              <button
                onClick={() => {
                  if (originalData) {
                    setData(originalData);
                  }
                }}
                className="px-3 py-1 bg-fm-yellow text-custom-bg text-sm rounded hover:bg-yellow-400 transition-colors font-body-medium"
              >
                Reset Filters
              </button>
            </div>
          </div>
        </div>

        {/* Showcase Enriched Target */}
        <div className="bg-custom-box border border-custom-border rounded-lg shadow mb-8">
          <div className="px-6 py-4 border-b border-custom-border flex items-center justify-between gap-4">
            <h2 className="font-subheader text-fm-white">🌟 Showcase Enriched Target</h2>
            <div className="flex items-center gap-3 w-full md:w-1/2">
              <select
                className="bg-custom-bg border border-custom-border rounded-md px-3 py-2 text-fm-light-grey focus:outline-none focus:ring-2 focus:ring-fm-yellow focus:border-transparent w-full"
                value={showcaseTarget}
                onChange={(e) => setShowcaseTarget(e.target.value)}
              >
                <option value="">Select enriched entity…</option>
                {originalData && originalData.sports_entities
                  .filter(e => e.enriched)
                  .map(e => (
                    <option key={e.name} value={e.name}>{e.name}</option>
                  ))}
              </select>
            </div>
          </div>
          {showcaseTarget && originalData && (
            (() => {
              const entity = originalData.sports_entities.find(e => e.name === showcaseTarget)
              if (!entity) return null
              return (
                <div className="p-6">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Basic Information */}
                    <div className="space-y-4">
                      <h4 className="font-subheader text-fm-white">Basic Information</h4>
                      <div className="bg-custom-box border border-custom-border rounded-lg p-4 space-y-3">
                        <div className="flex justify-between items-center py-2 border-b border-custom-border">
                          <span className="font-body-secondary text-fm-medium-grey">Sport:</span>
                          <span className="font-body-medium text-fm-white">{entity.sport || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-custom-border">
                          <span className="font-body-secondary text-fm-medium-grey">Country:</span>
                          <span className="font-body-medium text-fm-white">{entity.country || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-custom-border">
                          <span className="font-body-secondary text-fm-medium-grey">Tier:</span>
                          <span className="font-body-medium text-fm-white">{entity.tier ? entity.tier.replace('_', ' ').toUpperCase() : 'N/A'}</span>
                        </div>
                        <div className="flex justify-between items-center py-2">
                          <span className="font-body-secondary text-fm-medium-grey">Type:</span>
                          <span className="font-body-medium text-fm-white">{entity.type || 'N/A'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Company Information */}
                    <div className="space-y-4">
                      <h4 className="font-subheader text-fm-white">🏢 Company Information</h4>
                      <div className="bg-custom-box border border-custom-border rounded-lg p-4 space-y-2">
                        {entity.company_info ? (
                          <>
                            {entity.company_info.industry && (
                              <div className="flex justify-between py-2 border-b border-custom-border">
                                <span className="font-body-secondary text-fm-medium-grey">Industry:</span>
                                <span className="font-body-medium text-fm-white">{entity.company_info.industry}</span>
                              </div>
                            )}
                            {entity.company_info.company_size && (
                              <div className="flex justify-between py-2 border-b border-custom-border">
                                <span className="font-body-secondary text-fm-medium-grey">Company Size:</span>
                                <span className="font-body-medium text-fm-white">{entity.company_info.company_size}</span>
                              </div>
                            )}
                            {entity.company_info.headquarters && (
                              <div className="flex justify-between py-2">
                                <span className="font-body-secondary text-fm-medium-grey">Headquarters:</span>
                                <span className="font-body-medium text-fm-white">{entity.company_info.headquarters}</span>
                              </div>
                            )}
                          </>
                        ) : (
                          <p className="font-body-secondary text-fm-medium-grey">No company info available</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Key Contacts */}
                  {entity.key_contacts && entity.key_contacts.length > 0 && (
                    <div className="mt-6 bg-green-50 border border-green-200 rounded-lg p-4">
                      <h4 className="text-green-900 font-semibold mb-3">👥 Persons of Interest</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {entity.key_contacts.slice(0, 3).map((c, i) => (
                          <div key={i} className="bg-white border border-green-200 rounded-md p-3">
                            <div className="font-medium text-green-900 mb-1">{c.name}</div>
                            <div className="text-sm text-green-700 mb-2">{c.role}</div>
                            {c.linkedin && (
                              <a
                                href={`https://${c.linkedin}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 hover:underline"
                              >
                                🔗 LinkedIn
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Tenders */}
                  {entity.tenders_rfps && entity.tenders_rfps.length > 0 && (
                    <div className="mt-6 bg-orange-50 border border-orange-200 rounded-lg p-4">
                      <h4 className="text-orange-900 font-semibold mb-3">📄 Recent Tenders</h4>
                      <div className="space-y-3">
                        {entity.tenders_rfps.slice(0, 3).map((t, i) => (
                          <div key={i} className="bg-white border border-orange-200 rounded-md p-3">
                            <div className="font-medium text-orange-900 mb-1">{t.title}</div>
                            <div className="text-sm text-orange-700">{t.description}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )
            })()
          )}
        </div>

        {/* MCP Integration Status */}
        <div className="bg-custom-box border border-custom-border rounded-lg shadow mb-8">
          <div className="px-6 py-4 border-b border-custom-border">
            <h2 className="font-subheader text-fm-white">🔌 MCP Integration Status</h2>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h4 className="font-subheader text-green-900 mb-2">✅ Perplexity API</h4>
                <p className="font-body-secondary text-green-700">Status: Active</p>
                <p className="font-body-secondary text-green-700">Model: sonar-pro</p>
                <p className="font-body-secondary text-green-700">Function: AI-powered business analysis</p>
              </div>
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h4 className="font-subheader text-green-900 mb-2">✅ Bright Data MCP</h4>
                <p className="font-body-secondary text-green-700">Status: Active</p>
                <p className="font-body-secondary text-green-700">Protocol: MCP JSON-RPC</p>
                <p className="font-body-secondary text-green-700">Enrichments: {data.database_overview.enriched_count}/{data.database_overview.sports_entities_count} teams</p>
              </div>
              <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                <h4 className="font-subheader text-green-900 mb-2">✅ Neo4j Integration</h4>
                <p className="font-body-secondary text-green-700">Status: Active</p>
                <p className="font-body-secondary text-green-700">Connection: Direct driver</p>
                <p className="font-body-secondary text-green-700">Database: neo4j</p>
              </div>
            </div>
          </div>
        </div>

        {/* Sports Entities */}
        <div className="bg-custom-box border border-custom-border rounded-lg shadow">
          <div className="px-6 py-4 border-b border-custom-border">
            <h2 className="font-subheader text-fm-white">🎯 Seeding Results</h2>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {data.sports_entities.map((entity) => (
                <div key={entity.name} className="border border-custom-border rounded-lg">
                  {/* Entity Header */}
                  <div className="p-4 bg-custom-bg border-b border-custom-border">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h3 className="font-subheader text-fm-white mb-2">{entity.name}</h3>
                        <div className="flex items-center gap-6 text-sm text-fm-medium-grey font-body-secondary">
                          <span className="flex items-center gap-1">
                            <TrophyIcon className="h-4 w-4" />
                            {entity.sport || 'N/A'}
                          </span>
                          <span className="flex items-center gap-1">
                            <MapPinIcon className="h-4 w-4" />
                            {entity.country || 'N/A'}
                          </span>
                          <span className="flex items-center gap-1">
                            <GlobeIcon className="h-4 w-4" />
                            {entity.tier ? entity.tier.replace('_', ' ').toUpperCase() : 'N/A'}
                          </span>
                          <span className="flex items-center gap-1">
                            <span className="text-fm-yellow">★</span>
                            {entity.type || 'N/A'}
                          </span>
                          {entity.priorityScore && (
                            <span className="flex items-center gap-1">
                              <span className="text-fm-orange">🎯</span>
                              {entity.priorityScore}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`px-3 py-1 rounded-full text-sm font-body-medium ${
                          entity.enriched 
                            ? 'bg-green-100 text-green-800 border border-green-200' 
                            : 'bg-blue-100 text-blue-800 border border-blue-200'
                        }`}>
                          {entity.enriched ? '✅ Enriched' : '⏳ Pending'}
                        </span>
                        {entity.enriched && (
                          <button
                            onClick={() => toggleEntity(entity.name)}
                            className="px-4 py-2 bg-custom-box text-fm-light-grey rounded-md hover:bg-custom-bg transition-colors flex items-center gap-2 font-body-medium border border-custom-border"
                          >
                            {expandedEntities.has(entity.name) ? (
                              <>
                                <ChevronUpIcon className="h-4 w-4" />
                                Hide Details
                              </>
                            ) : (
                              <>
                                <ChevronDownIcon className="h-4 w-4" />
                                View Details
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Entity Details */}
                  {expandedEntities.has(entity.name) && entity.enriched && (
                    <div className="p-6 bg-custom-bg">
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Basic Information */}
                        <div className="space-y-4">
                          <h4 className="font-subheader text-fm-white">Basic Information</h4>
                          <div className="bg-custom-box border border-custom-border rounded-lg p-4 space-y-3">
                            <div className="flex justify-between items-center py-2 border-b border-custom-border">
                              <span className="font-body-secondary text-fm-medium-grey">Type:</span>
                              <span className="font-body-medium text-fm-white">Sports Club</span>
                            </div>
                            <div className="flex justify-between items-center py-2 border-b border-custom-border">
                              <span className="font-body-secondary text-fm-medium-grey">Sport:</span>
                              <span className="font-body-medium text-fm-white">{entity.sport}</span>
                            </div>
                            <div className="flex justify-between items-center py-2 border-b border-custom-border">
                              <span className="font-body-secondary text-fm-medium-grey">Country:</span>
                              <span className="font-body-medium text-fm-white">{entity.country}</span>
                            </div>
                            <div className="flex justify-between items-center py-2 border-b border-custom-border">
                              <span className="font-body-secondary text-fm-medium-grey">Level:</span>
                              <span className="font-body-medium text-fm-white">{entity.level || 'N/A'}</span>
                            </div>
                            {entity.description && (
                              <div className="flex justify-between items-center py-2 border-b border-custom-border">
                                <span className="font-body-secondary text-fm-medium-grey">Description:</span>
                                <span className="font-body-medium text-fm-white">{entity.description}</span>
                              </div>
                            )}
                            <div className="flex justify-between items-center py-2 border-b border-custom-border">
                              <span className="font-body-secondary text-fm-medium-grey">Tier:</span>
                              <span className="font-body-medium text-fm-white">{entity.tier ? entity.tier.replace('_', ' ').toUpperCase() : 'N/A'}</span>
                            </div>
                            <div className="flex justify-between items-center py-2 border-b border-custom-border">
                              <span className="font-body-secondary text-fm-medium-grey">Type:</span>
                              <span className="font-body-medium text-fm-white">{entity.type || 'N/A'}</span>
                            </div>
                            {entity.priorityScore && (
                              <div className="flex justify-between items-center py-2 border-b border-custom-border">
                                <span className="font-body-secondary text-fm-medium-grey">Priority Score:</span>
                                <span className="font-body-medium text-fm-white">{entity.priorityScore}</span>
                              </div>
                            )}
                            {entity.estimatedValue && (
                              <div className="flex justify-between items-center py-2 border-b border-custom-border">
                                <span className="font-body-secondary text-fm-medium-grey">Estimated Value:</span>
                                <span className="font-body-medium text-fm-white">{entity.estimatedValue}</span>
                              </div>
                            )}
                            {entity.website && (
                              <div className="flex justify-between items-center py-2 border-b border-custom-border">
                                <span className="font-body-secondary text-fm-medium-grey">Website:</span>
                                <a href={entity.website} target="_blank" rel="noopener noreferrer" className="font-body-medium text-fm-yellow hover:underline">
                                  {entity.website}
                                </a>
                              </div>
                            )}
                            {entity.linkedin && (
                              <div className="flex justify-between items-center py-2">
                                <span className="font-body-secondary text-fm-medium-grey">LinkedIn:</span>
                                <a href={`https://${entity.linkedin}`} target="_blank" rel="noopener noreferrer" className="font-body-medium text-fm-yellow hover:underline">
                                  {entity.linkedin}
                                </a>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Enrichment Status */}
                        <div className="space-y-4">
                          <h4 className="font-subheader text-fm-white">Enrichment Status</h4>
                          <div className="bg-custom-box border border-custom-border rounded-lg p-4 space-y-3">
                            <div className="flex justify-between items-center py-2 border-b border-custom-border">
                              <span className="font-body-secondary text-fm-medium-grey">Status:</span>
                              <span className="font-body-medium text-fm-green">✅ Enriched</span>
                            </div>
                            <div className="flex justify-between items-center py-2 border-b border-custom-border">
                              <span className="font-body-secondary text-fm-medium-grey">Data Sources:</span>
                              <span className="font-body-medium text-fm-white">Perplexity + Bright Data MCP</span>
                            </div>
                            <div className="flex justify-between items-center py-2">
                              <span className="font-body-secondary text-fm-medium-grey">Last Updated:</span>
                              <span className="font-body-medium text-fm-white">Recent</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* AI Analysis Summary */}
                      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <h4 className="text-blue-900 font-semibold mb-2">🤖 AI Analysis Summary</h4>
                        <p className="text-blue-800 text-sm leading-relaxed">
                          This team has been enriched with comprehensive data from Bright Data MCP, 
                          including LinkedIn profiles, company information, recent news, and active tender/RFP opportunities.
                        </p>
                      </div>

                      {/* Company Information */}
                      {entity.company_info && (
                        <div className="mt-6 bg-indigo-50 border border-indigo-200 rounded-lg p-4">
                          <h4 className="text-indigo-900 font-semibold mb-3">🏢 Company Information</h4>
                          <div className="grid grid-cols-2 gap-4">
                            {entity.company_info.industry && (
                              <div className="flex justify-between items-center py-2 border-b border-indigo-100">
                                <span className="text-indigo-700 text-sm">Industry:</span>
                                <span className="font-medium text-indigo-900">{entity.company_info.industry}</span>
                              </div>
                            )}
                            {entity.company_info.company_size && (
                              <div className="flex justify-between items-center py-2 border-b border-indigo-100">
                                <span className="text-indigo-700 text-sm">Company Size:</span>
                                <span className="font-medium text-indigo-900">{entity.company_info.company_size}</span>
                              </div>
                            )}
                            {entity.company_info.founded && (
                              <div className="flex justify-between items-center py-2 border-b border-indigo-100">
                                <span className="text-indigo-700 text-sm">Founded:</span>
                                <span className="font-medium text-indigo-900">{entity.company_info.founded}</span>
                              </div>
                            )}
                            {entity.company_info.headquarters && (
                              <div className="flex justify-between items-center py-2 border-b border-indigo-100">
                                <span className="text-indigo-700 text-sm">Headquarters:</span>
                                <span className="font-medium text-indigo-900">{entity.company_info.headquarters}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Tenders & RFPs */}
                      {entity.tenders_rfps && entity.tenders_rfps.length > 0 && (
                        <div className="mt-6 bg-orange-50 border border-orange-200 rounded-lg p-4">
                          <h4 className="text-orange-900 font-semibold mb-3">🎯 Active Tenders & RFPs</h4>
                          <div className="space-y-3">
                            {entity.tenders_rfps.map((tender, index) => (
                              <div key={index} className="bg-white border border-orange-200 rounded-md p-3">
                                <div className="font-medium text-orange-900 mb-2">{tender.title}</div>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                                  <div className="flex justify-between">
                                    <span className="text-orange-700">Type:</span>
                                    <span className="font-medium text-orange-900">{tender.type}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-orange-700">Value:</span>
                                    <span className="font-medium text-orange-900">{tender.value}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-orange-700">Deadline:</span>
                                    <span className="font-medium text-orange-900">{tender.deadline}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-orange-700">Status:</span>
                                    <span className="font-medium text-orange-900">{tender.status}</span>
                                  </div>
                                </div>
                                {tender.description && (
                                  <div className="text-sm text-orange-700 mt-2 pt-2 border-t border-orange-200">
                                    {tender.description}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Key Contacts */}
                      {entity.key_contacts && entity.key_contacts.length > 0 && (
                        <div className="mt-6 bg-green-50 border border-green-200 rounded-lg p-4">
                          <h4 className="text-green-900 font-semibold mb-3">👥 Key Contacts</h4>
                          <div className="space-y-3">
                            {entity.key_contacts.map((contact, index) => (
                              <div key={index} className="bg-white border border-green-200 rounded-md p-3">
                                <div className="font-medium text-green-900 mb-1">{contact.name}</div>
                                <div className="text-sm text-green-700 mb-2">{contact.role}</div>
                                {contact.linkedin && (
                                  <a 
                                    href={`https://${contact.linkedin}`} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 hover:underline"
                                  >
                                    🔗 LinkedIn Profile
                                  </a>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}



