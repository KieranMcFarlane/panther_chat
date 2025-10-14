"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  ArrowLeft,
  RefreshCw,
  Download,
  Share2,
  ExternalLink,
  Mail,
  Phone,
  MapPin,
  Building,
  Users,
  TrendingUp,
  User,
  Link as LinkIcon,
  Shield,
  Calendar,
  Target,
  Activity,
  FileText,
  Brain,
  Briefcase,
  GraduationCap,
  Award,
  MessageSquare,
  Star,
  Zap
} from "lucide-react"

import { Entity, PersonIntelligence, detectEntityType, formatValue } from './types'
import { perplexityService } from './PerplexityService'
// import { ASCIIDossierRenderer } from './ascii-renderer' // ASCII functionality disabled

interface PersonDossierProps {
  entity: Entity
  onEmailEntity: () => void
}

export function PersonDossier({ entity, onEmailEntity }: PersonDossierProps) {
  // ASCII functionality disabled - enhanced view only
  const [perplexityData, setPerplexityData] = useState<PersonIntelligence | null>(null)
  const [isLoadingResearch, setIsLoadingResearch] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  
  const props = entity.properties
  
  // Load real Perplexity data for any person entity
  useEffect(() => {
    if (entity) {
      loadPerplexityData()
    }
  }, [entity])

  const loadPerplexityData = async () => {
    console.log(`👤 Loading Perplexity intelligence for person: ${props.name}`)
    setIsLoadingResearch(true)
    
    try {
      const result = await perplexityService.enrichEntityData(entity)
      
      if (result.personIntelligence) {
        console.log(`✅ Loaded Perplexity person intelligence for ${props.name}:`, result.personIntelligence)
        setPerplexityData(result.personIntelligence)
        setLastUpdated(new Date())
      } else {
        console.log(`⚠️ No Perplexity person intelligence available for ${props.name}`)
      }
    } catch (error) {
      console.error(`❌ Error loading Perplexity person data for ${props.name}:`, error)
    } finally {
      setIsLoadingResearch(false)
    }
  }
  
  const generateMockPerplexityData = () => {
    const mockData: PersonIntelligence = {
      careerBackground: {
        previousRoles: [
          'VP Commercial, Formula 1 (2016-2019)',
          'Commercial Director, Wembley Stadium (2013-2016)',
          'Head of Partnerships, Nike (2010-2013)'
        ],
        education: [
          'MBA, Imperial College London',
          'BA Economics, Cambridge University'
        ],
        recognition: [
          'Sports Business Journal "40 Under 40" (2021, 2023)',
          'UK Sports Tech Advisory Board Member',
          'Women in Sports Leadership Award (2022)'
        ]
      },
      decisionMakingPatterns: {
        partnershipPhilosophy: 'Prefers innovation-first partners with proven ROI',
        technologyFocus: [
          'Fan experience analytics',
          'Data-driven decision making',
          'AI-powered personalization',
          'Immersive digital experiences'
        ],
        recentInvestments: [
          'Led £200M Adidas sponsorship renewal (10-year deal)',
          'Launched digital innovation fund (£5M annually)',
          'Implemented AI-powered fan engagement platform'
        ]
      },
      strategicFocus: {
        currentPriorities: [
          'Digital revenue diversification',
          'Asian market expansion',
          'Women\'s sports digital transformation',
          'Technology scouting for next-gen fan experiences'
        ],
        technologyScouting: [
          'AI and machine learning applications',
          'Web3 and fan token integration',
          'Immersive and AR experiences',
          'Personalization engines'
        ],
        innovationCriteria: [
          'Scalable solutions',
          'Global deployment capability',
          'Fan-centric approach',
          'Proven ROI methodologies'
        ],
        budgetAuthority: 'Direct oversight of £50M+ commercial technology budget'
      },
      lastUpdated: new Date().toISOString(),
      sources: ['LinkedIn Profile', 'Company Filings', 'Industry Reports', 'Speaking Engagements']
    }
    
    setPerplexityData(mockData)
    setLastUpdated(new Date())
  }
  
  const handleRefreshResearch = async () => {
    console.log(`🔄 Refreshing Perplexity research for person: ${props.name}`)
    await loadPerplexityData()
  }
  
  const handleExportDossier = () => {
    // Export functionality disabled for now
    alert('Export functionality coming soon!')
  }
  
  const getInfluenceColor = (influence: string): string => {
    switch (influence?.toLowerCase()) {
      case 'high': return 'bg-red-100 text-red-800 border-red-200'
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'low': return 'bg-green-100 text-green-800 border-green-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }
  
  const influenceColor = getInfluenceColor(props.influenceLevel || 'medium')
  
  return (
    <div className="space-y-6">
      {/* Dossier Header */}
      <Card className="border-2 shadow-lg">
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-purple-700 rounded-xl flex items-center justify-center text-white font-bold text-xl">
                {props.name?.charAt(0) || 'P'}
              </div>
              <div>
                <CardTitle className="text-2xl font-bold flex items-center gap-3">
                  <User className="h-6 w-6 text-purple-600" />
                  {props.name || 'Person Entity'}
                </CardTitle>
                <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Briefcase className="h-4 w-4" />
                    {props.role || 'Professional'}
                  </span>
                  <span className="flex items-center gap-1">
                    <Building className="h-4 w-4" />
                    {props.organization || 'Organization'}
                  </span>
                  <span className="flex items-center gap-1">
                    <MapPin className="h-4 w-4" />
                    {props.location || 'Location'}
                  </span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <Badge className={`${influenceColor} font-medium`}>
                {props.influenceLevel?.toUpperCase() || 'MEDIUM'} INFLUENCE
              </Badge>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setActiveView(activeView === 'enhanced' ? 'ascii' : 'enhanced')}
                >
                  <FileText className="h-4 w-4 mr-2" />
                  {activeView === 'enhanced' ? 'ASCII' : 'Enhanced'}
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
      
      {activeView === 'enhanced' ? (
        /* Enhanced Modern View */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Professional Profile */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="h-5 w-5 text-purple-600" />
                  Professional Intelligence
                </CardTitle>
                {lastUpdated && (
                  <p className="text-sm text-muted-foreground">
                    Last updated: {lastUpdated.toLocaleString()}
                  </p>
                )}
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h4 className="font-semibold mb-2">Role & Responsibilities</h4>
                  <p className="text-muted-foreground leading-relaxed">
                    {formatValue(props.responsibilities) || 'Strategic leadership and commercial decision-making'}
                  </p>
                </div>
                
                {perplexityData && (
                  <div>
                    <h4 className="font-semibold mb-3 flex items-center gap-2">
                      <Activity className="h-4 w-4 text-blue-600" />
                      Perplexity Deep Research
                    </h4>
                    
                    {perplexityData.careerBackground && (
                      <div className="mb-4 p-4 bg-blue-50 rounded-lg">
                        <h5 className="font-medium text-blue-800 mb-2">Career Background</h5>
                        <div className="space-y-2 text-sm">
                          <div>
                            <strong>Previous Roles:</strong>
                            <ul className="list-disc list-inside ml-2 mt-1">
                              {perplexityData.careerBackground.previousRoles.map((role, index) => (
                                <li key={index}>{role}</li>
                              ))}
                            </ul>
                          </div>
                          <div>
                            <strong>Education:</strong>
                            <ul className="list-disc list-inside ml-2 mt-1">
                              {perplexityData.careerBackground.education.map((edu, index) => (
                                <li key={index}>{edu}</li>
                              ))}
                            </ul>
                          </div>
                          <div>
                            <strong>Recognition:</strong>
                            <ul className="list-disc list-inside ml-2 mt-1">
                              {perplexityData.careerBackground.recognition.map((rec, index) => (
                                <li key={index}>{rec}</li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {perplexityData.strategicFocus && (
                      <div className="mb-4 p-4 bg-green-50 rounded-lg">
                        <h5 className="font-medium text-green-800 mb-2">Strategic Focus & Budget Authority</h5>
                        <div className="space-y-2 text-sm">
                          <div>
                            <strong>Current Priorities:</strong>
                            <ul className="list-disc list-inside ml-2 mt-1">
                              {perplexityData.strategicFocus.currentPriorities.map((priority, index) => (
                                <li key={index}>{priority}</li>
                              ))}
                            </ul>
                          </div>
                          <div>
                            <strong>Budget Authority:</strong>
                            <p className="mt-1">{perplexityData.strategicFocus.budgetAuthority}</p>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={handleRefreshResearch}
                      disabled={isLoadingResearch}
                      className="mt-2"
                    >
                      <RefreshCw className={`h-4 w-4 mr-2 ${isLoadingResearch ? 'animate-spin' : ''}`} />
                      {isLoadingResearch ? 'Researching...' : 'Refresh Research'}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
            
            {/* Decision Making Patterns */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-orange-600" />
                  Decision Making & Communication Style
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h5 className="font-medium mb-3">Communication Preferences</h5>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2">
                        <MessageSquare className="h-4 w-4 text-blue-600" />
                        <span><strong>Tone:</strong> {props.communicationTone || 'Professional, outcome-driven'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4 text-green-600" />
                        <span><strong>Risk Profile:</strong> {props.riskProfile || 'Pragmatic, evidence-based'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-purple-600" />
                        <span><strong>Response Time:</strong> {props.responseTime || '2-3 weeks'}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <h5 className="font-medium mb-3">Strategic Approach</h5>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2">
                        <Zap className="h-4 w-4 text-yellow-600" />
                        <span><strong>Philosophy:</strong> {props.partnershipPhilosophy || 'Innovation-first with proven ROI'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-red-600" />
                        <span><strong>Focus Areas:</strong> {props.technologyFocus || 'Technology, digital transformation'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Star className="h-4 w-4 text-indigo-600" />
                        <span><strong>Outreach:</strong> {props.outreachStrategy || 'Insight-first approach'}</span>
                      </div>
                    </div>
                  </div>
                </div>
                
                {props.strategicHooks && (
                  <div className="mt-6 p-4 bg-orange-50 rounded-lg">
                    <h5 className="font-medium text-orange-800 mb-2 flex items-center gap-2">
                      <Target className="h-4 w-4" />
                      Strategic Engagement Hooks
                    </h5>
                    <div className="space-y-2">
                      {Array.isArray(props.strategicHooks) 
                        ? props.strategicHooks.map((hook: string, index: number) => (
                            <div key={index} className="flex items-start gap-2 text-sm">
                              <div className="w-1.5 h-1.5 bg-orange-600 rounded-full mt-2 flex-shrink-0" />
                              <span>{hook}</span>
                            </div>
                          ))
                        : <div className="flex items-start gap-2 text-sm">
                            <div className="w-1.5 h-1.5 bg-orange-600 rounded-full mt-2 flex-shrink-0" />
                            <span>{formatValue(props.strategicHooks)}</span>
                          </div>
                      }
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
            
            {/* Network & Relationships */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-blue-600" />
                  Network & Relationship Intelligence
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h5 className="font-medium mb-3">Internal Network</h5>
                    <div className="space-y-2 text-sm">
                      {props.internalNetwork?.map((connection: string, index: number) => (
                        <div key={index} className="flex items-center gap-2 p-2 border rounded">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span>{connection}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <h5 className="font-medium mb-3">External Network</h5>
                    <div className="space-y-2 text-sm">
                      {props.externalNetwork?.map((connection: string, index: number) => (
                        <div key={index} className="flex items-center gap-2 p-2 border rounded">
                          <Building className="h-4 w-4 text-muted-foreground" />
                          <span>{connection}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                
                {props.recentActivities && (
                  <div className="mt-6">
                    <h5 className="font-medium mb-3">Recent Activities & Signals</h5>
                    <div className="space-y-2">
                      {props.recentActivities.map((activity: string, index: number) => (
                        <div key={index} className="flex items-start gap-2 text-sm p-2 bg-muted/30 rounded">
                          <Calendar className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                          <span>{activity}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
          
          {/* Sidebar */}
          <div className="space-y-6">
            {/* Quick Stats */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Award className="h-5 w-5 text-green-600" />
                  Key Metrics
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <GraduationCap className="h-4 w-4 text-blue-600" />
                    <span className="font-medium">Experience</span>
                  </div>
                  <div className="text-lg font-semibold text-blue-700">
                    {props.experience || '10+ years'}
                  </div>
                </div>
                
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Building className="h-4 w-4 text-purple-600" />
                    <span className="font-medium">Organization Size</span>
                  </div>
                  <div className="text-lg font-semibold text-purple-700">
                    {props.organizationSize || 'Large Enterprise'}
                  </div>
                </div>
                
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Users className="h-4 w-4 text-orange-600" />
                    <span className="font-medium">Team Size</span>
                  </div>
                  <div className="text-lg font-semibold text-orange-700">
                    {props.teamSize || '50+ direct reports'}
                  </div>
                </div>
                
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <TrendingUp className="h-4 w-4 text-green-600" />
                    <span className="font-medium">Budget Authority</span>
                  </div>
                  <div className="text-lg font-semibold text-green-700">
                    {props.budgetAuthority || '£50M+'}
                  </div>
                </div>
              </CardContent>
            </Card>
            
            {/* Contact Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Phone className="h-5 w-5 text-purple-600" />
                  Contact Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {props.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <a href={`mailto:${props.email}`} className="text-sm hover:underline">
                      {formatValue(props.email)}
                    </a>
                  </div>
                )}
                
                {props.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <a href={`tel:${props.phone}`} className="text-sm hover:underline">
                      {formatValue(props.phone)}
                    </a>
                  </div>
                )}
                
                {props.linkedinUrl && (
                  <div className="flex items-center gap-2">
                    <LinkIcon className="h-4 w-4 text-muted-foreground" />
                    <a 
                      href={props.linkedinUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-sm hover:underline text-blue-600"
                    >
                      LinkedIn Profile
                    </a>
                  </div>
                )}
                
                {props.twitterUrl && (
                  <div className="flex items-center gap-2">
                    <LinkIcon className="h-4 w-4 text-muted-foreground" />
                    <a 
                      href={props.twitterUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-sm hover:underline text-blue-400"
                    >
                      Twitter Profile
                    </a>
                  </div>
                )}
              </CardContent>
            </Card>
            
            {/* Engagement Strategy */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-red-600" />
                  Engagement Strategy
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 text-sm">
                  <div className="p-3 bg-green-50 rounded-lg">
                    <h5 className="font-medium text-green-800 mb-1">Optimal Timing</h5>
                    <p className="text-green-700">{props.optimalTiming || 'Q1 2026'}</p>
                  </div>
                  
                  <div className="p-3 bg-blue-50 rounded-lg">
                    <h5 className="font-medium text-blue-800 mb-1">Best Approach</h5>
                    <p className="text-blue-700">{props.bestApproach || 'Warm introduction via mutual connections'}</p>
                  </div>
                  
                  <div className="p-3 bg-yellow-50 rounded-lg">
                    <h5 className="font-medium text-yellow-800 mb-1">Success Rate</h5>
                    <p className="text-yellow-700">{props.successRate || '75% with proper preparation'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      ) : (
        /* ASCII View */
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              ASCII Intelligence Dossier
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Classic dossier format suitable for reports and analysis
            </p>
          </CardHeader>
          <CardContent>
            <div className="bg-black text-green-400 p-6 rounded-lg overflow-x-auto">
              <pre className="font-mono text-xs whitespace-pre">
                {ASCIIDossierRenderer.renderPersonDossier(entity, perplexityData || undefined)}
              </pre>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}