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
    // Load mock data instead of fetching from external API
    loadMockTenders()
  }, [])

  const loadMockTenders = () => {
    setLoading(true)
    
    // Mock tender data
    const mockData: TenderData = {
      status: "success",
      data_source: "Mock Data",
      last_updated: new Date().toISOString(),
      statistics: {
        total_tenders: 12,
        open_tenders: 8,
        linkedin_tenders: 7,
        isportconnect_tenders: 5
      },
      tenders: [
        {
          title: "Digital Transformation Partnership - Premier League Club",
          type: "RFP",
          value: "£2.5M",
          deadline: "2024-03-15",
          description: "Seeking innovative technology partner for comprehensive digital transformation including CRM implementation, fan engagement platform, and data analytics solutions.",
          status: "Open",
          url: "https://example.com/tender/1",
          source: "LinkedIn",
          publishedDate: "2024-01-15",
          organization: "Arsenal FC",
          location: "London, UK",
          category: "Technology",
          estimatedValue: 2500000,
          contractType: "Partnership",
          opportunityType: "Digital Transformation",
          suitableForSME: true,
          cpvCode: "72000000"
        },
        {
          title: "Stadium Wi-Fi Upgrade Project",
          type: "Tender",
          value: "£850K",
          deadline: "2024-02-28",
          description: "Complete overhaul of stadium wireless infrastructure to support 60,000+ concurrent users with premium fan experience features.",
          status: "Open",
          url: "https://example.com/tender/2",
          source: "iSportConnect",
          publishedDate: "2024-01-20",
          organization: "Manchester United",
          location: "Manchester, UK",
          category: "Infrastructure",
          estimatedValue: 850000,
          contractType: "Fixed Price",
          opportunityType: "Network Infrastructure",
          suitableForSME: false,
          cpvCode: "32400000"
        },
        {
          title: "Sports Analytics Platform Development",
          type: "RFP",
          value: "£1.2M",
          deadline: "2024-03-30",
          description: "Development of advanced sports performance analytics platform with AI-powered insights and real-time data visualization capabilities.",
          status: "Open",
          url: "https://example.com/tender/3",
          source: "LinkedIn",
          publishedDate: "2024-01-18",
          organization: "Chelsea FC",
          location: "London, UK",
          category: "Analytics",
          estimatedValue: 1200000,
          contractType: "Development Contract",
          opportunityType: "Software Development",
          suitableForSME: true,
          cpvCode: "48000000"
        },
        {
          title: "Fan Engagement Mobile App",
          type: "Contract",
          value: "£750K",
          deadline: "2024-04-15",
          description: "Design and development of cutting-edge mobile application for fan engagement including AR features, loyalty programs, and ticketing integration.",
          status: "Open",
          url: "https://example.com/tender/4",
          source: "iSportConnect",
          publishedDate: "2024-01-22",
          organization: "Liverpool FC",
          location: "Liverpool, UK",
          category: "Mobile Development",
          estimatedValue: 750000,
          contractType: "Software License",
          opportunityType: "Mobile Application",
          suitableForSME: true,
          cpvCode: "48000000"
        },
        {
          title: "Cybersecurity Assessment & Implementation",
          type: "RFT",
          value: "£500K",
          deadline: "2024-02-15",
          description: "Comprehensive cybersecurity assessment and implementation of advanced threat protection systems for club infrastructure and fan data.",
          status: "Open",
          url: "https://example.com/tender/5",
          source: "LinkedIn",
          publishedDate: "2024-01-25",
          organization: "Tottenham Hotspur",
          location: "London, UK",
          category: "Security",
          estimatedValue: 500000,
          contractType: "Service Contract",
          opportunityType: "Cybersecurity",
          suitableForSME: false,
          cpvCode: "72200000"
        },
        {
          title: "E-commerce Platform Integration",
          type: "Tender",
          value: "£950K",
          deadline: "2024-03-20",
          description: "Integration of comprehensive e-commerce solution with existing ticketing and merchandise systems, including personalized shopping experiences.",
          status: "Open",
          url: "https://example.com/tender/6",
          source: "iSportConnect",
          publishedDate: "2024-01-28",
          organization: "Manchester City",
          location: "Manchester, UK",
          category: "E-commerce",
          estimatedValue: 950000,
          contractType: "Integration Contract",
          opportunityType: "E-commerce",
          suitableForSME: true,
          cpvCode: "48000000"
        },
        {
          title: "Broadcast Technology Upgrade",
          type: "RFP",
          value: "£3.2M",
          deadline: "2024-05-01",
          description: "Complete upgrade of broadcast technology including 4K/8K capabilities, virtual production studio, and streaming infrastructure for global content distribution.",
          status: "Open",
          url: "https://example.com/tender/7",
          source: "LinkedIn",
          publishedDate: "2024-01-30",
          organization: "Sky Sports",
          location: "London, UK",
          category: "Broadcast",
          estimatedValue: 3200000,
          contractType: "Supply Contract",
          opportunityType: "Broadcast Technology",
          suitableForSME: false,
          cpvCode: "32200000"
        },
        {
          title: "Sustainability Consulting Services",
          type: "Contract",
          value: "£400K",
          deadline: "2024-04-30",
          description: "Consulting services for developing comprehensive sustainability strategy including carbon footprint reduction and green stadium initiatives.",
          status: "Open",
          url: "https://example.com/tender/8",
          source: "iSportConnect",
          publishedDate: "2024-02-01",
          organization: "Premier League",
          location: "London, UK",
          category: "Consulting",
          estimatedValue: 400000,
          contractType: "Service Agreement",
          opportunityType: "Sustainability",
          suitableForSME: true,
          cpvCode: "79400000"
        },
        {
          title: "AI-Powered Player Performance Analysis",
          type: "RFT",
          value: "£1.8M",
          deadline: "2024-03-10",
          description: "Implementation of AI and machine learning systems for advanced player performance analysis, injury prediction, and tactical optimization.",
          status: "Closed",
          url: "https://example.com/tender/9",
          source: "LinkedIn",
          publishedDate: "2024-01-10",
          organization: "Bayern Munich",
          location: "Munich, Germany",
          category: "AI/ML",
          estimatedValue: 1800000,
          contractType: "Research Contract",
          opportunityType: "Artificial Intelligence",
          suitableForSME: false,
          cpvCode: "73000000"
        },
        {
          title: "Virtual Reality Training Facility",
          type: "RFP",
          value: "£2.1M",
          deadline: "2024-06-15",
          description: "Design and implementation of state-of-the-art VR training facility for player development, tactical training, and fan entertainment experiences.",
          status: "Open",
          url: "https://example.com/tender/10",
          source: "LinkedIn",
          publishedDate: "2024-02-05",
          organization: "Real Madrid",
          location: "Madrid, Spain",
          category: "VR/AR",
          estimatedValue: 2100000,
          contractType: "Project Contract",
          opportunityType: "Virtual Reality",
          suitableForSME: false,
          cpvCode: "32200000"
        },
        {
          title: "Data Center Modernization",
          type: "Tender",
          value: "£1.5M",
          deadline: "2024-04-10",
          description: "Complete modernization of data center infrastructure including cloud migration, high-performance computing, and disaster recovery systems.",
          status: "Open",
          url: "https://example.com/tender/11",
          source: "iSportConnect",
          publishedDate: "2024-02-08",
          organization: "UEFA",
          location: "Nyon, Switzerland",
          category: "Infrastructure",
          estimatedValue: 1500000,
          contractType: "Turnkey Project",
          opportunityType: "Data Center",
          suitableForSME: false,
          cpvCode: "45300000"
        },
        {
          title: "Smart Stadium IoT Integration",
          type: "Contract",
          value: "£680K",
          deadline: "2024-05-20",
          description: "Integration of IoT sensors and systems for smart stadium management including crowd monitoring, energy optimization, and enhanced fan experiences.",
          status: "Open",
          url: "https://example.com/tender/12",
          source: "LinkedIn",
          publishedDate: "2024-02-12",
          organization: "Juventus FC",
          location: "Turin, Italy",
          category: "IoT",
          estimatedValue: 680000,
          contractType: "Integration Services",
          opportunityType: "Internet of Things",
          suitableForSME: true,
          cpvCode: "32000000"
        }
      ]
    }
    
    setTimeout(() => {
      setData(mockData)
      setLoading(false)
      setError(null)
    }, 1000) // Simulate loading time
  }

  const fetchTenders = async () => {
    // Keep original fetch function for future use
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
          <p className="font-body-primary text-fm-medium-grey mb-4">{error instanceof Error ? error.message : String(error)}</p>
          <button 
            onClick={loadMockTenders}
            className="px-4 py-2 bg-fm-yellow text-custom-bg font-body-medium rounded hover:bg-yellow-400 transition-colors"
          >
            Load Demo Data
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
                onClick={loadMockTenders}
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
