'use client'

import { useState, useEffect } from 'react'
import { Search, Filter, Calendar, MapPin, PoundSterling, Building, Clock, ExternalLink, TrendingUp, Trophy, Target, Zap, Star, Database, Network, Settings, Eye, Globe, Linkedin, Users } from 'lucide-react'

interface Tender {
  title: string
  type: string
  value: string
  deadline: string
  description: string
  status: string
  url: string
  source: string
  publishedDate: string
  organization: string
  location: string
  category: string
  estimatedValue: number
  contractType: string
  opportunityType: string
  suitableForSME: boolean
  cpvCode: string
}

interface TenderData {
  status: string
  tenders: Tender[]
  statistics: {
    total_tenders: number
    open_tenders: number
    linkedin_tenders: number
    isportconnect_tenders: number
  }
  data_source: string
  last_updated: string
}

export default function TendersPage() {
  const [data, setData] = useState<TenderData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterSource, setFilterSource] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')

  useEffect(() => {
    fetchTenders()
  }, [])

  const fetchTenders = async () => {
    try {
      setLoading(true)
      const response = await fetch('http://localhost:8000/api/tenders/enhanced?t=' + Date.now())
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      const result = await response.json()
      setData(result)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch tenders')
    } finally {
      setLoading(false)
    }
  }

  const filteredTenders = data?.tenders?.filter(tender => {
    const matchesSearch = tender.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         tender.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         tender.organization.toLowerCase().includes(searchQuery.toLowerCase())
    
    const matchesSource = filterSource === 'all' || tender.source === filterSource
    const matchesStatus = filterStatus === 'all' || tender.status === filterStatus
    
    return matchesSearch && matchesSource && matchesStatus
  }) || []

  if (loading) {
    return (
      <div className="min-h-screen bg-custom-bg flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-fm-yellow mx-auto mb-4"></div>
          <p className="font-body-primary text-fm-medium-grey">Loading tenders...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-custom-bg flex items-center justify-center">
        <div className="text-center">
          <div className="text-fm-red text-xl mb-4 font-subheader">⚠️ Error loading tenders</div>
          <p className="font-body-primary text-fm-medium-grey mb-4">{error}</p>
          <button 
            onClick={fetchTenders}
            className="px-4 py-2 bg-fm-yellow text-custom-bg font-body-medium rounded hover:bg-yellow-400 transition-colors"
          >
            Retry
          </button>
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
              <h1 className="font-header-large text-fm-white mb-2">🏆 Live Tender Opportunities</h1>
              <p className="font-body-primary text-fm-medium-grey">Real-time RFP and tender data from LinkedIn and iSportConnect</p>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={fetchTenders}
                className="px-4 py-2 bg-fm-yellow text-custom-bg font-body-medium rounded-lg hover:bg-yellow-400 transition-colors flex items-center space-x-2"
              >
                <Database className="w-4 h-4" />
                <span>Refresh Data</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Statistics */}
      {data?.statistics && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-custom-box border border-custom-border rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Trophy className="w-6 h-6 text-blue-600" />
                </div>
                <div className="ml-4">
                  <p className="font-body-secondary text-fm-meta">Total Tenders</p>
                  <p className="font-highlight text-fm-white">{data.statistics.total_tenders}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-custom-box border border-custom-border rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="p-2 bg-green-100 rounded-lg">
                  <Eye className="w-6 h-6 text-green-600" />
                </div>
                <div className="ml-4">
                  <p className="font-body-secondary text-fm-meta">Open Tenders</p>
                  <p className="font-highlight text-fm-green">{data.statistics.open_tenders}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-custom-box border border-custom-border rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Linkedin className="w-6 h-6 text-purple-600" />
                </div>
                <div className="ml-4">
                  <p className="font-body-secondary text-fm-meta">LinkedIn</p>
                  <p className="font-highlight text-fm-white">{data.statistics.linkedin_tenders}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-custom-box border border-custom-border rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <Globe className="w-6 h-6 text-orange-600" />
                </div>
                <div className="ml-4">
                  <p className="font-body-secondary text-fm-meta">iSportConnect</p>
                  <p className="font-highlight text-fm-white">{data.statistics.isportconnect_tenders}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters and Search */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="bg-custom-box border border-custom-border rounded-lg shadow p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block font-body-medium text-fm-light-grey mb-2">Search Tenders</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-fm-meta w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search by title, description, or organization..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-custom-border rounded-lg focus:ring-2 focus:ring-fm-yellow focus:border-transparent bg-custom-bg text-fm-white placeholder-fm-meta font-body-primary"
                />
              </div>
            </div>
            
            <div>
              <label className="block font-body-medium text-fm-light-grey mb-2">Source</label>
              <select
                value={filterSource}
                onChange={(e) => setFilterSource(e.target.value)}
                className="w-full px-3 py-2 border border-custom-border rounded-lg focus:ring-2 focus:ring-fm-yellow focus:border-transparent bg-custom-bg text-fm-white font-body-primary"
              >
                <option value="all">All Sources</option>
                <option value="LinkedIn">LinkedIn</option>
                <option value="iSportConnect">iSportConnect</option>
              </select>
            </div>
            
            <div>
              <label className="block font-body-medium text-fm-light-grey mb-2">Status</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full px-3 py-2 border border-custom-border rounded-lg focus:ring-2 focus:ring-fm-yellow focus:border-transparent bg-custom-bg text-fm-white font-body-primary"
              >
                <option value="all">All Statuses</option>
                <option value="Open">Open</option>
                <option value="Closed">Closed</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Tenders List */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="bg-custom-box border border-custom-border rounded-lg shadow">
          <div className="px-6 py-4 border-b border-custom-border">
            <h2 className="font-subheader text-fm-white">
              {filteredTenders.length} Tenders Found
            </h2>
            <p className="font-meta text-fm-meta mt-1">
              Last updated: {data?.last_updated || 'Unknown'}
            </p>
          </div>
          
          <div className="divide-y divide-custom-border">
            {filteredTenders.map((tender, index) => (
              <div key={index} className="p-6 hover:bg-custom-bg transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h3 className="font-subheader text-fm-white">{tender.title}</h3>
                      <span className={`px-2 py-1 text-xs font-body-medium rounded-full ${
                        tender.status === 'Open' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {tender.status}
                      </span>
                      <span className="px-2 py-1 text-xs font-body-medium bg-blue-100 text-blue-800 rounded-full">
                        {tender.type}
                      </span>
                    </div>
                    
                    <p className="font-body-primary text-fm-medium-grey mb-3">{tender.description}</p>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div className="flex items-center space-x-2">
                        <Building className="w-4 h-4 text-fm-meta" />
                        <span className="font-body-secondary text-fm-medium-grey">{tender.organization || 'N/A'}</span>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <MapPin className="w-4 h-4 text-fm-meta" />
                        <span className="font-body-secondary text-fm-medium-grey">{tender.location || 'N/A'}</span>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <PoundSterling className="w-4 h-4 text-fm-meta" />
                        <span className="font-body-secondary text-fm-medium-grey">{tender.value || 'TBD'}</span>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <Calendar className="w-4 h-4 text-fm-meta" />
                        <span className="font-body-secondary text-fm-medium-grey">{tender.deadline || 'N/A'}</span>
                      </div>
                    </div>
                    
                    <div className="mt-3 flex items-center space-x-4 text-sm text-fm-meta font-meta">
                      <span>Source: {tender.source}</span>
                      <span>Published: {tender.publishedDate}</span>
                      {tender.category && <span>Category: {tender.category}</span>}
                    </div>
                  </div>
                  
                  <div className="ml-4 flex flex-col space-y-2">
                    <a
                      href={tender.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center px-3 py-2 border border-custom-border shadow-sm text-sm leading-4 font-body-medium rounded-md text-fm-light-grey bg-custom-box hover:bg-custom-bg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-fm-yellow"
                    >
                      <ExternalLink className="w-4 h-4 mr-2" />
                      View
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          {filteredTenders.length === 0 && (
            <div className="p-12 text-center">
              <div className="text-fm-meta mb-4">
                <Search className="w-12 h-12 mx-auto" />
              </div>
              <h3 className="font-subheader text-fm-white mb-2">No tenders found</h3>
              <p className="font-body-primary text-fm-medium-grey">Try adjusting your search criteria or filters.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
