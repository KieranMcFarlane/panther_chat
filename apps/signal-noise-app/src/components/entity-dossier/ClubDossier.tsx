"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  ArrowLeft,
  RefreshCw,
  Download,
  Share2,
  ExternalLink,
  Globe,
  Mail,
  Phone,
  Calendar,
  MapPin,
  Building,
  Users,
  TrendingUp,
  DollarSign,
  Target,
  Award,
  Trophy,
  User,
  Link as LinkIcon,
  Shield,
  Database,
  Clock,
  Star,
  Zap,
  BarChart3,
  Crown,
  Lightbulb,
  AlertTriangle,
  CheckCircle,
  Activity,
  FileText,
  Brain,
  Settings,
  History,
  TrendingDown,
  Medal,
  Flag
} from "lucide-react"

import { Entity, detectEntityType, PerplexityIntelligence, formatValue, getEntityPriority } from './types'
import { perplexityService } from './PerplexityService'
// import { ASCIIDossierRenderer } from './ascii-renderer' // ASCII functionality disabled

interface ClubDossierProps {
  entity: Entity
  onEmailEntity: () => void
}

export function ClubDossier({ entity, onEmailEntity }: ClubDossierProps) {
  const router = useRouter()
  // const [activeView, setActiveView] = useState<'enhanced' | 'ascii'>('enhanced') // ASCII disabled
  const [perplexityData, setPerplexityData] = useState<PerplexityIntelligence | null>(null)
  const [isLoadingResearch, setIsLoadingResearch] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [activeTab, setActiveTab] = useState('overview')
  
  const props = entity.properties
  const priority = getEntityPriority(entity)
  
  // Load real Perplexity data for any club entity
  useEffect(() => {
    if (entity) {
      loadPerplexityData()
      
      // Auto-generate comprehensive mock data for Arsenal to showcase full schema
      if (props.name === 'Arsenal') {
        console.log(`🏆 Generating comprehensive dossier schema for Arsenal`)
        generateComprehensiveArsenalDossier()
      }
    }
  }, [entity])

  const loadPerplexityData = async () => {
    console.log(`🔍 Loading Perplexity intelligence for: ${props.name}`)
    setIsLoadingResearch(true)
    
    try {
      const result = await perplexityService.enrichEntityData(entity)
      
      if (result.perplexityIntelligence) {
        console.log(`✅ Loaded Perplexity intelligence for ${props.name}:`, result.perplexityIntelligence)
        setPerplexityData(result.perplexityIntelligence)
        setLastUpdated(new Date())
      } else {
        console.log(`⚠️ No Perplexity intelligence available for ${props.name}`)
      }
    } catch (error) {
      console.error(`❌ Error loading Perplexity data for ${props.name}:`, error)
    } finally {
      setIsLoadingResearch(false)
    }
  }
  
  const generateComprehensiveArsenalDossier = () => {
    const comprehensiveData: PerplexityIntelligence = {
      financialPerformance: {
        revenue: '£520M+ (2023/24) - 5th highest in Premier League',
        growth: '23% YoY driven by sponsorship and digital revenue',
        marketCap: '£2.6B+ - Consistently top 10 most valuable football clubs globally',
        partnerships: ['NTT DATA (Extended 2027)', 'Adidas (10-year, £200M)', 'Emirates', 'L\'Oréal Paris', 'Coca-Cola', 'Bitpanda', 'Konami']
      },
      competitiveAnalysis: {
        position: '2nd (as of Oct 2025) - Title contenders with 78 points',
        strategy: 'Youth development + commercial expansion in Asia + Technical innovation',
        focus: 'Technical innovation under Mikel Arteta (contracted through 2027) + Digital transformation leadership'
      },
      technologyInitiatives: {
        partnerships: ['NTT DATA (AI & fan analytics)', 'Adobe (content creation)', 'SAP (operations)', 'AWS (cloud infrastructure)', 'Oracle (database)'],
        digitalStrategy: '"Arsenal 3.0" - Web3, fan tokens, immersive experiences, AI-powered engagement',
        innovations: ['£15M digital infrastructure upgrade (2024)', 'Arsenal Innovation Lab (2024)', 'AI-powered fan engagement platform', 'Stadium WiFi 6.0 deployment', 'Metaverse stadium experiences', 'Blockchain ticketing system']
      },
      businessOpportunities: {
        sponsorshipPipeline: ['Fintech (2025-26)', 'Web3 (2025-26)', 'Health tech (2025-26)', 'Sustainable technology partners', 'Gaming and esports'],
        expansion: ['US market digital platforms', 'Asian market commercial expansion', 'Stadium capacity increase (60,000→63,000)', 'Women\'s sports commercial growth'],
        priorities: ['Digital revenue diversification', 'Women\'s sports transformation', 'International growth', 'Sustainability initiatives', 'Fan experience modernization']
      },
      lastUpdated: new Date().toISOString(),
      sources: ['Financial Reports', 'Premier League', 'Company Filings', 'Press Releases', 'Industry Analysis', 'Partnership Announcements']
    }
    
    setPerplexityData(comprehensiveData)
    setLastUpdated(new Date())
  }

  const generateMockPerplexityData = () => {
    const mockData: PerplexityIntelligence = {
      financialPerformance: {
        revenue: '£520M+ (2023/24) - 5th highest in Premier League',
        growth: '23% YoY driven by sponsorship and digital revenue',
        marketCap: '£2.6B+ - Consistently top 10 most valuable football clubs globally',
        partnerships: ['NTT DATA (Extended 2027)', 'Adidas (10-year, £200M)', 'Emirates']
      },
      competitiveAnalysis: {
        position: '2nd (as of Oct 2025) - Title contenders with 78 points',
        strategy: 'Youth development + commercial expansion in Asia',
        focus: 'Technical innovation under Mikel Arteta (contracted through 2027)'
      },
      technologyInitiatives: {
        partnerships: ['NTT DATA (AI & fan analytics)', 'Adobe (content creation)', 'SAP (operations)'],
        digitalStrategy: '"Arsenal 3.0" - Web3, fan tokens, immersive experiences',
        innovations: ['£15M digital infrastructure upgrade (2024)', 'Arsenal Innovation Lab (2024)', 'AI-powered fan engagement platform']
      },
      businessOpportunities: {
        sponsorshipPipeline: ['Fintech (2025-26)', 'Web3 (2025-26)', 'Health tech (2025-26)'],
        expansion: ['US market digital platforms', 'Asian market commercial expansion', 'Stadium capacity increase (60,000→63,000)'],
        priorities: ['Digital revenue diversification', 'Women\'s sports transformation', 'International growth']
      },
      lastUpdated: new Date().toISOString(),
      sources: ['Financial Reports', 'Premier League', 'Company Filings', 'Press Releases']
    }
    
    setPerplexityData(mockData)
    setLastUpdated(new Date())
  }
  
  const handleRefreshResearch = async () => {
    console.log(`🔄 Refreshing Perplexity research for: ${props.name}`)
    await loadPerplexityData()
  }

  const navigateToPerson = (personName: string) => {
    // For demo purposes, create a mock person ID based on name
    // In production, this would use actual person IDs from the knowledge graph
    const personId = personName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
    console.log(`👤 Navigating to person: ${personName} (ID: ${personId})`)
    router.push(`/person/${personId}`)
  }

  const createPersonLink = (personName: string, role?: string) => {
    return (
      <button
        onClick={() => navigateToPerson(personName)}
        className="font-medium text-blue-600 hover:text-blue-800 hover:underline transition-colors"
        title={role ? `View profile for ${personName}, ${role}` : `View profile for ${personName}`}
      >
        {personName}
      </button>
    )
  }
  
  const handleExportDossier = () => {
    // Export functionality disabled for now
    alert('Export functionality coming soon!')
  }
  
  const getScoreColor = (score: any): string => {
    const numScore = parseInt(formatValue(score))
    if (isNaN(numScore)) return "text-gray-600"
    if (numScore >= 80) return "text-green-600"
    if (numScore >= 60) return "text-yellow-600"
    return "text-red-600"
  }
  
  const getStatusBadge = (priority: number) => {
    if (priority >= 90) return { text: 'CRITICAL', color: 'bg-red-100 text-red-800 border-red-200' }
    if (priority >= 70) return { text: 'HIGH', color: 'bg-yellow-100 text-yellow-800 border-yellow-200' }
    if (priority >= 50) return { text: 'MEDIUM', color: 'bg-blue-100 text-blue-800 border-blue-200' }
    return { text: 'MONITOR', color: 'bg-green-100 text-green-800 border-green-200' }
  }
  
  const statusBadge = getStatusBadge(priority)
  
  return (
    <div className="space-y-6">
      {/* Dossier Header */}
      <Card className="border-2 shadow-lg">
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-gradient-to-br from-red-500 to-red-700 rounded-xl flex items-center justify-center text-white font-bold text-xl">
                {props.name?.charAt(0) || 'C'}
              </div>
              <div>
                <CardTitle className="text-2xl font-bold flex items-center gap-3">
                  <Target className="h-6 w-6 text-red-600" />
                  {props.name || 'Club Entity'}
                </CardTitle>
                <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Building className="h-4 w-4" />
                    {props.type || 'Club'}
                  </span>
                  <span className="flex items-center gap-1">
                    <Trophy className="h-4 w-4" />
                    {props.league || 'Premier League'}
                  </span>
                  <span className="flex items-center gap-1">
                    <MapPin className="h-4 w-4" />
                    {props.headquarters || 'London'}
                  </span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <Badge className={`${statusBadge.color} font-medium`}>
                {statusBadge.text} PRIORITY ({priority}/100)
              </Badge>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setActiveTab('leadership')}>
                  <Users className="h-4 w-4 mr-2" />
                  Personnel
                </Button>
                <Button variant="outline" size="sm" onClick={handleExportDossier}>
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
                <Button variant="outline" size="sm" onClick={onEmailEntity}>
                  <Mail className="h-4 w-4 mr-2" />
                  Contact
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Tabbed Interface */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-7 bg-[#1c1e2d] p-1 text-white/80">
          <TabsTrigger value="overview" className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:text-gray-900 data-[state=active]:shadow-sm hover:text-white hover:bg-white/10">
            <Brain className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="financial" className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:text-gray-900 data-[state=active]:shadow-sm hover:text-white hover:bg-white/10">
            <DollarSign className="h-4 w-4" />
            Financial
          </TabsTrigger>
          <TabsTrigger value="performance" className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:text-gray-900 data-[state=active]:shadow-sm hover:text-white hover:bg-white/10">
            <BarChart3 className="h-4 w-4" />
            Performance
          </TabsTrigger>
          <TabsTrigger value="technology" className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:text-gray-900 data-[state=active]:shadow-sm hover:text-white hover:bg-white/10">
            <Zap className="h-4 w-4" />
            Technology
          </TabsTrigger>
          <TabsTrigger value="opportunities" className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:text-gray-900 data-[state=active]:shadow-sm hover:text-white hover:bg-white/10">
            <Target className="h-4 w-4" />
            Opportunities
          </TabsTrigger>
          <TabsTrigger value="leadership" className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:text-gray-900 data-[state=active]:shadow-sm hover:text-white hover:bg-white/10">
            <Users className="h-4 w-4" />
            Leadership
          </TabsTrigger>
          <TabsTrigger value="contact" className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:text-gray-900 data-[state=active]:shadow-sm hover:text-white hover:bg-white/10">
            <Mail className="h-4 w-4" />
            Contact
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Brain className="h-5 w-5 text-purple-600" />
                    Intelligence Overview
                  </CardTitle>
                  {lastUpdated && (
                    <p className="text-sm text-muted-foreground">
                      Last updated: {lastUpdated.toLocaleString()}
                    </p>
                  )}
                </CardHeader>
                <CardContent className="space-y-6">
                  {props.description && (
                    <div>
                      <h4 className="font-semibold mb-2">Overview</h4>
                      <p className="text-muted-foreground leading-relaxed">
                        {formatValue(props.description)}
                      </p>
                    </div>
                  )}
                  
                  {perplexityData && (
                    <div className="space-y-6">
                      {props.name === 'Arsenal' && (
                        <Badge className="bg-red-100 text-red-800 border-red-200">
                          COMPREHENSIVE DOSSIER
                        </Badge>
                      )}
                      
                      {/* Financial Performance Summary */}
                      {perplexityData.financialPerformance && (
                        <div className="p-4 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg border border-blue-200">
                          <h5 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
                            <DollarSign className="h-4 w-4" />
                            Financial Summary
                          </h5>
                          <div className="text-sm space-y-1">
                            <p><strong>Revenue:</strong> {perplexityData.financialPerformance.revenue}</p>
                            <p><strong>Growth:</strong> <span className="text-green-700 font-medium">{perplexityData.financialPerformance.growth}</span></p>
                            <p><strong>Market Valuation:</strong> {perplexityData.financialPerformance.marketCap}</p>
                          </div>
                        </div>
                      )}

                      {/* Competitive Position Summary */}
                      {perplexityData.competitiveAnalysis && (
                        <div className="p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg border border-purple-200">
                          <h5 className="font-semibold text-purple-900 mb-2 flex items-center gap-2">
                            <BarChart3 className="h-4 w-4" />
                            Competitive Position
                          </h5>
                          <div className="text-sm space-y-1">
                            <p><strong>Position:</strong> {perplexityData.competitiveAnalysis.position}</p>
                            <p><strong>Strategy:</strong> {perplexityData.competitiveAnalysis.strategy}</p>
                            <p><strong>Focus:</strong> {perplexityData.competitiveAnalysis.focus}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Technology & Digital Presence */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="h-5 w-5 text-blue-600" />
                    Technology & Digital
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {props.digitalMaturity && (
                    <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Zap className="h-5 w-5 text-blue-600" />
                        <span className="font-medium">Digital Maturity</span>
                      </div>
                      <div className="text-lg font-semibold text-blue-700">
                        {formatValue(props.digitalMaturity)}
                      </div>
                    </div>
                  )}
                  
                  {props.websiteModernness && (
                    <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Globe className="h-5 w-5 text-green-600" />
                        <span className="font-medium">Website Modernness</span>
                      </div>
                      <div className="text-lg font-semibold text-green-700">
                        {formatValue(props.websiteModernness)}
                      </div>
                    </div>
                  )}

                  {perplexityData?.technologyInitiatives && (
                    <div className="p-4 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg border border-indigo-200">
                      <h5 className="font-semibold text-indigo-900 mb-2 flex items-center gap-2">
                        <Lightbulb className="h-4 w-4" />
                        Technology Initiatives
                      </h5>
                      <div className="text-sm">
                        <p><strong>Digital Strategy:</strong> {perplexityData.technologyInitiatives.digitalStrategy}</p>
                        {perplexityData.technologyInitiatives.innovations && (
                          <div className="mt-2">
                            <strong>Key Innovations:</strong>
                            <ul className="list-disc list-inside mt-1 space-y-1">
                              {perplexityData.technologyInitiatives.innovations.map((innovation, index) => (
                                <li key={index} className="text-gray-700">{innovation}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Sidebar - Scores & Metrics */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-green-600" />
                    Performance Metrics
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {props.budgetRange && (
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <DollarSign className="h-4 w-4 text-green-600" />
                        <span className="font-medium">Budget Range</span>
                      </div>
                      <div className="text-lg font-semibold text-green-700">
                        {formatValue(props.budgetRange)}
                      </div>
                    </div>
                  )}
                  
                  {props.opportunityScore && (
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Target className="h-4 w-4 text-purple-600" />
                        <span className="font-medium">Opportunity Score</span>
                      </div>
                      <div className={`text-lg font-bold ${getScoreColor(props.opportunityScore)}`}>
                        {formatValue(props.opportunityScore)}/100
                      </div>
                    </div>
                  )}
                  
                  {props.yellowPantherPriority && (
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Star className="h-4 w-4 text-red-600" />
                        <span className="font-medium">Priority Score</span>
                      </div>
                      <div className={`text-lg font-bold ${getScoreColor(props.yellowPantherPriority)}`}>
                        {formatValue(props.yellowPantherPriority)}/100
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Quick Actions */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="h-5 w-5 text-gray-600" />
                    Quick Actions
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button variant="outline" size="sm" className="w-full" onClick={loadPerplexityData} disabled={isLoadingResearch}>
                    <RefreshCw className={`h-4 w-4 mr-2 ${isLoadingResearch ? 'animate-spin' : ''}`} />
                    {isLoadingResearch ? 'Researching...' : 'Refresh Intelligence'}
                  </Button>
                  <Button variant="outline" size="sm" className="w-full" onClick={handleExportDossier}>
                    <Download className="h-4 w-4 mr-2" />
                    Export Dossier
                  </Button>
                  <Button variant="outline" size="sm" className="w-full" onClick={onEmailEntity}>
                    <Mail className="h-4 w-4 mr-2" />
                    Contact Club
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Financial Tab */}
        <TabsContent value="financial" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {perplexityData?.financialPerformance && (
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-green-600" />
                    Financial Performance
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-200">
                      <h5 className="font-semibold text-green-900 mb-2">Revenue</h5>
                      <p className="text-2xl font-bold text-green-700">{perplexityData.financialPerformance.revenue}</p>
                    </div>
                    <div className="p-4 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg border border-blue-200">
                      <h5 className="font-semibold text-blue-900 mb-2">Growth Rate</h5>
                      <p className="text-2xl font-bold text-blue-700">{perplexityData.financialPerformance.growth}</p>
                    </div>
                    <div className="p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg border border-purple-200">
                      <h5 className="font-semibold text-purple-900 mb-2">Market Cap</h5>
                      <p className="text-lg font-bold text-purple-700">{perplexityData.financialPerformance.marketCap}</p>
                    </div>
                  </div>
                  
                  {perplexityData.financialPerformance.partnerships && (
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <h5 className="font-semibold text-gray-900 mb-3">Key Partnerships</h5>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {perplexityData.financialPerformance.partnerships.map((partner, index) => (
                          <div key={index} className="flex items-center gap-2 p-2 bg-white rounded border">
                            <Award className="h-4 w-4 text-blue-600" />
                            <span className="text-sm">{partner}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* Performance Tab */}
        <TabsContent value="performance" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {perplexityData?.competitiveAnalysis && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-purple-600" />
                    Competitive Analysis
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg border border-purple-200">
                    <h5 className="font-semibold text-purple-900 mb-2">Market Position</h5>
                    <p className="text-lg font-medium text-purple-700">{perplexityData.competitiveAnalysis.position}</p>
                  </div>
                  <div className="p-4 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg border border-blue-200">
                    <h5 className="font-semibold text-blue-900 mb-2">Strategy</h5>
                    <p className="text-sm text-blue-700">{perplexityData.competitiveAnalysis.strategy}</p>
                  </div>
                  <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-200">
                    <h5 className="font-semibold text-green-900 mb-2">Focus Areas</h5>
                    <p className="text-sm text-green-700">{perplexityData.competitiveAnalysis.focus}</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Matches & Standings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-orange-600" />
                  Season Performance
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-orange-50 rounded-lg text-center">
                    <div className="text-2xl font-bold text-orange-700">4th</div>
                    <div className="text-xs text-orange-600">Current Position</div>
                  </div>
                  <div className="p-3 bg-green-50 rounded-lg text-center">
                    <div className="text-2xl font-bold text-green-700">68</div>
                    <div className="text-xs text-green-600">Points</div>
                  </div>
                  <div className="p-3 bg-blue-50 rounded-lg text-center">
                    <div className="text-2xl font-bold text-blue-700">W21</div>
                    <div className="text-xs text-blue-600">Wins</div>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg text-center">
                    <div className="text-2xl font-bold text-gray-700">D5</div>
                    <div className="text-xs text-gray-600">Draws</div>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <h5 className="font-medium">Recent Form</h5>
                  <div className="flex gap-1">
                    <div className="w-8 h-8 bg-green-500 rounded flex items-center justify-center text-white text-xs font-bold">W</div>
                    <div className="w-8 h-8 bg-green-500 rounded flex items-center justify-center text-white text-xs font-bold">W</div>
                    <div className="w-8 h-8 bg-gray-400 rounded flex items-center justify-center text-white text-xs font-bold">D</div>
                    <div className="w-8 h-8 bg-green-500 rounded flex items-center justify-center text-white text-xs font-bold">W</div>
                    <div className="w-8 h-8 bg-red-500 rounded flex items-center justify-center text-white text-xs font-bold">L</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Technology Tab */}
        <TabsContent value="technology" className="space-y-6">
          {perplexityData?.technologyInitiatives && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-blue-600" />
                  Technology Initiatives
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="p-5 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg border border-indigo-200">
                  <h5 className="font-semibold text-indigo-900 mb-3">Digital Strategy</h5>
                  <p className="text-indigo-700">{perplexityData.technologyInitiatives.digitalStrategy}</p>
                </div>
                
                {perplexityData.technologyInitiatives.partnerships && (
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <h5 className="font-semibold text-gray-900 mb-3">Technology Partnerships</h5>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {perplexityData.technologyInitiatives.partnerships.map((partner, index) => (
                        <div key={index} className="flex items-center gap-2 p-3 bg-white rounded border">
                          <Database className="h-4 w-4 text-blue-600" />
                          <span className="text-sm font-medium">{partner}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {perplexityData.technologyInitiatives.innovations && (
                  <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-200">
                    <h5 className="font-semibold text-green-900 mb-3">Key Innovations</h5>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {perplexityData.technologyInitiatives.innovations.map((innovation, index) => (
                        <div key={index} className="flex items-start gap-2 p-3 bg-white rounded border">
                          <Lightbulb className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                          <span className="text-sm">{innovation}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Opportunities Tab */}
        <TabsContent value="opportunities" className="space-y-6">
          {perplexityData?.businessOpportunities && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-green-600" />
                  Business Opportunities
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {perplexityData.businessOpportunities.sponsorshipPipeline && (
                  <div className="p-5 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-200">
                    <h5 className="font-semibold text-green-900 mb-3">Sponsorship Pipeline</h5>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {perplexityData.businessOpportunities.sponsorshipPipeline.map((opportunity, index) => (
                        <div key={index} className="flex items-start gap-2 p-3 bg-white rounded border">
                          <Crown className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                          <span className="text-sm">{opportunity}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {perplexityData.businessOpportunities.expansion && (
                  <div className="p-4 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg border border-blue-200">
                    <h5 className="font-semibold text-blue-900 mb-3">Expansion Opportunities</h5>
                    <div className="space-y-2">
                      {perplexityData.businessOpportunities.expansion.map((item, index) => (
                        <div key={index} className="flex items-start gap-2">
                          <TrendingUp className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                          <span className="text-sm">{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {perplexityData.businessOpportunities.priorities && (
                  <div className="p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg border border-purple-200">
                    <h5 className="font-semibold text-purple-900 mb-3">Strategic Priorities</h5>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {perplexityData.businessOpportunities.priorities.map((priority, index) => (
                        <div key={index} className="flex items-start gap-2 p-3 bg-white rounded border">
                          <Star className="h-4 w-4 text-purple-600 mt-0.5 flex-shrink-0" />
                          <span className="text-sm font-medium">{priority}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Leadership Tab */}
        <TabsContent value="leadership" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Key Personnel */}
            {props.keyPersonnel && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-blue-600" />
                    Key Decision Makers
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {Array.isArray(props.keyPersonnel) 
                      ? props.keyPersonnel.map((person: string, index: number) => (
                          <div key={index} className="p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                            <div className="font-medium text-sm">{createPersonLink(person, 'Key Personnel')}</div>
                          </div>
                        ))
                      : <div className="p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                          <div className="font-medium text-sm">{createPersonLink(formatValue(props.keyPersonnel), 'Key Personnel')}</div>
                        </div>
                    }
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Management Structure */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-green-600" />
                  Management Structure
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg hover:bg-green-100 transition-colors cursor-pointer" onClick={() => navigateToPerson('Eduardo Gaspar')}>
                    <User className="h-8 w-8 text-green-600" />
                    <div className="flex-1">
                      <div className="font-medium">Technical Director</div>
                      <div className="text-sm text-blue-600 hover:text-blue-800">{createPersonLink('Eduardo Gaspar', 'Technical Director')}</div>
                    </div>
                    <ExternalLink className="h-4 w-4 text-gray-400" />
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors cursor-pointer" onClick={() => navigateToPerson('Mikel Arteta')}>
                    <User className="h-8 w-8 text-blue-600" />
                    <div className="flex-1">
                      <div className="font-medium">Manager</div>
                      <div className="text-sm text-blue-600 hover:text-blue-800">{createPersonLink('Mikel Arteta', 'Manager')}</div>
                    </div>
                    <ExternalLink className="h-4 w-4 text-gray-400" />
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors cursor-pointer" onClick={() => navigateToPerson('Vinai Venkatesham')}>
                    <User className="h-8 w-8 text-purple-600" />
                    <div className="flex-1">
                      <div className="font-medium">CEO</div>
                      <div className="text-sm text-blue-600 hover:text-blue-800">{createPersonLink('Vinai Venkatesham', 'CEO')}</div>
                    </div>
                    <ExternalLink className="h-4 w-4 text-gray-400" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Notable Players */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Star className="h-5 w-5 text-yellow-600" />
                  Notable Players
                  <Badge className="ml-2 bg-green-100 text-green-800 border-green-200">
                    Clickable Profiles
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-3 bg-yellow-50 rounded-lg hover:bg-yellow-100 transition-colors cursor-pointer" onClick={() => navigateToPerson('Martin Ødegaard')}>
                    <User className="h-8 w-8 text-yellow-600" />
                    <div className="flex-1">
                      <div className="font-medium">Team Captain</div>
                      <div className="text-sm text-blue-600 hover:text-blue-800">{createPersonLink('Martin Ødegaard', 'Team Captain')}</div>
                    </div>
                    <ExternalLink className="h-4 w-4 text-gray-400" />
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-red-50 rounded-lg hover:bg-red-100 transition-colors cursor-pointer" onClick={() => navigateToPerson('Bukayo Saka')}>
                    <User className="h-8 w-8 text-red-600" />
                    <div className="flex-1">
                      <div className="font-medium">Key Player</div>
                      <div className="text-sm text-blue-600 hover:text-blue-800">{createPersonLink('Bukayo Saka', 'Winger/Forward')}</div>
                    </div>
                    <ExternalLink className="h-4 w-4 text-gray-400" />
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors cursor-pointer" onClick={() => navigateToPerson('William Saliba')}>
                    <User className="h-8 w-8 text-blue-600" />
                    <div className="flex-1">
                      <div className="font-medium">Defensive Leader</div>
                      <div className="text-sm text-blue-600 hover:text-blue-800">{createPersonLink('William Saliba', 'Center Back')}</div>
                    </div>
                    <ExternalLink className="h-4 w-4 text-gray-400" />
                  </div>
                </div>
                <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-sm text-blue-700">
                    💡 <strong>Tip:</strong> Click on any person's name to view their detailed profile page with career information and intelligence data.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Contact Tab */}
        <TabsContent value="contact" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5 text-blue-600" />
                  Contact Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {props.website && (
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <Globe className="h-5 w-5 text-blue-600" />
                    <div>
                      <div className="font-medium text-sm">Website</div>
                      <a 
                        href={props.website} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        {props.website}
                      </a>
                    </div>
                  </div>
                )}
                
                {props.email && (
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <Mail className="h-5 w-5 text-green-600" />
                    <div>
                      <div className="font-medium text-sm">Email</div>
                      <a href={`mailto:${props.email}`} className="text-green-600 hover:underline">
                        {formatValue(props.email)}
                      </a>
                    </div>
                  </div>
                )}
                
                {props.phone && (
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <Phone className="h-5 w-5 text-purple-600" />
                    <div>
                      <div className="font-medium text-sm">Phone</div>
                      <a href={`tel:${props.phone}`} className="text-purple-600 hover:underline">
                        {formatValue(props.phone)}
                      </a>
                    </div>
                  </div>
                )}
                
                {props.linkedinUrl && (
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <LinkIcon className="h-5 w-5 text-blue-600" />
                    <div>
                      <div className="font-medium text-sm">LinkedIn</div>
                      <a 
                        href={props.linkedinUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        LinkedIn Profile
                      </a>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Location */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-red-600" />
                  Location & Address
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-red-50 rounded-lg">
                  <h5 className="font-semibold text-red-900 mb-2">Stadium</h5>
                  <p className="text-sm text-red-700">Emirates Stadium</p>
                  <p className="text-sm text-red-600">Holloway, London</p>
                  <p className="text-sm text-red-600">N5 1BU, United Kingdom</p>
                </div>
                
                <div className="p-4 bg-gray-50 rounded-lg">
                  <h5 className="font-semibold text-gray-900 mb-2">Training Ground</h5>
                  <p className="text-sm text-gray-700">London Colney</p>
                  <p className="text-sm text-gray-600">Hertfordshire, England</p>
                </div>
                
                <Button className="w-full" onClick={onEmailEntity}>
                  <Mail className="h-4 w-4 mr-2" />
                  Contact Club
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
