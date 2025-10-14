"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  User,
  Brain,
  Target,
  Shield,
  Mail,
  Phone,
  Calendar,
  Building,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  ExternalLink,
  ArrowRight,
  Lightbulb,
  Star,
  Activity,
  FileText,
  Globe,
  Users,
  DollarSign,
  Clock,
  Award,
  BookOpen
} from "lucide-react"

import { Entity, formatValue, getEntityPriority } from './types'
import { EnhancedPersonDossier } from './types'

interface EnhancedPersonDossierProps {
  entity: Entity
  onEmailEntity: () => void
}

export function EnhancedPersonDossier({ entity, onEmailEntity }: EnhancedPersonDossierProps) {
  const [activeTab, setActiveTab] = useState('overview')
  const [enhancedData, setEnhancedData] = useState<EnhancedPersonDossier | null>(null)
  
  const props = entity.properties
  const priority = getEntityPriority(entity)

  useEffect(() => {
    if (entity) {
      generateEnhancedPersonDossier()
    }
  }, [entity])

  const generateEnhancedPersonDossier = () => {
    // Generate comprehensive person dossier data
    const dossierData: EnhancedPersonDossier = {
      coreInfo: {
        name: props.name || 'Executive',
        role: props.role || 'Commercial Director',
        organization: props.organization || 'Arsenal FC',
        since: props.since || '2019',
        location: props.location || 'London, UK',
        pastRoles: [
          'Wimbledon (Commercial Director)',
          'Ascot Racecourse (Head of Partnerships)',
          'Nike (Brand & Partnerships Manager)'
        ]
      },
      responsibilities: [
        'Global partnerships & brand activations',
        'Revenue diversification & digital sponsorship innovation',
        'Oversight of commercial growth strategy',
        'Fan engagement platform development',
        'Sustainability partnership management'
      ],
      influenceAnalysis: {
        influenceLevel: 'HIGH',
        decisionScope: ['Commercial Partnerships', 'Digital Sponsorship', 'Brand Activations', 'Revenue Strategy'],
        relationshipMapping: {
          reportsTo: 'Richard Garlick (Managing Director)',
          collaboratesWith: ['Mark Gonnella (Comms)', 'Edu Gaspar (Sporting)', 'Vinai Venkatesham (CEO)']
        }
      },
      aiCommunicationAnalysis: {
        tone: 'Professional, outcome-driven, values storytelling',
        riskProfile: 'LOW',
        outreachStrategy: 'Lead with insight → propose pilot → debrief with metrics'
      },
      strategicHooks: [
        'Arsenal Mind → propose emotional analytics integration pilot',
        'Emirates partnership → sustainability data storytelling layer',
        'Arsenal Women → test "global community engagement dashboard"',
        'Digital revenue diversification → AI-powered sponsorship optimization'
      ],
      currentProjects: [
        'Arsenal Innovation Lab oversight',
        'Emirates sustainability partnership renewal',
        'Digital fan engagement platform expansion',
        'Women\'s commercial growth strategy'
      ],
      budgetAuthority: 'Significant - Authority for partnerships up to £5M annually',
      status: {
        watchlist: true,
        activeDeal: false,
        noEntry: false,
        lastUpdated: new Date().toISOString()
      }
    }
    
    setEnhancedData(dossierData)
  }

  const getStatusBadge = () => {
    if (enhancedData?.status.activeDeal) return { text: 'ACTIVE DEAL', color: 'bg-green-100 text-green-800 border-green-200' }
    if (enhancedData?.status.watchlist) return { text: 'WATCHLIST', color: 'bg-yellow-100 text-yellow-800 border-yellow-200' }
    if (enhancedData?.status.noEntry) return { text: 'NO ENTRY', color: 'bg-red-100 text-red-800 border-red-200' }
    return { text: 'MONITOR', color: 'bg-blue-100 text-blue-800 border-blue-200' }
  }

  const getInfluenceColor = (level: string) => {
    switch (level) {
      case 'HIGH': return 'bg-red-100 text-red-800 border-red-200'
      case 'MEDIUM': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'LOW': return 'bg-green-100 text-green-800 border-green-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const statusBadge = getStatusBadge()

  if (!enhancedData) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div></div>
  }

  return (
    <div className="space-y-6">
      {/* Enhanced Header */}
      <Card className="border-2 shadow-lg">
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl flex items-center justify-center text-white font-bold text-xl">
                <User className="h-8 w-8" />
              </div>
              <div>
                <CardTitle className="text-2xl font-bold flex items-center gap-3">
                  <User className="h-6 w-6 text-blue-600" />
                  {enhancedData.coreInfo.name}
                </CardTitle>
                <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Building className="h-4 w-4" />
                    {enhancedData.coreInfo.role}
                  </span>
                  <span className="flex items-center gap-1">
                    <Shield className="h-4 w-4" />
                    {enhancedData.coreInfo.organization}
                  </span>
                  <span className="flex items-center gap-1">
                    <MapPin className="h-4 w-4" />
                    {enhancedData.coreInfo.location}
                  </span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <Badge className={`${getInfluenceColor(enhancedData.influenceAnalysis.influenceLevel)} font-medium`}>
                {enhancedData.influenceAnalysis.influenceLevel} INFLUENCE
              </Badge>
              <Badge className={`${statusBadge.color} font-medium`}>
                {statusBadge.text}
              </Badge>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Enhanced Tabbed Interface */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="influence" className="flex items-center gap-2">
            <Target className="h-4 w-4" />
            Influence
          </TabsTrigger>
          <TabsTrigger value="communication" className="flex items-center gap-2">
            <Brain className="h-4 w-4" />
            Communication
          </TabsTrigger>
          <TabsTrigger value="opportunities" className="flex items-center gap-2">
            <Lightbulb className="h-4 w-4" />
            Hooks
          </TabsTrigger>
          <TabsTrigger value="projects" className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Projects
          </TabsTrigger>
          <TabsTrigger value="contact" className="flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Contact
          </TabsTrigger>
        </TabsList>

        {/* Core Info Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5 text-blue-600" />
                    Professional Profile
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-600">Current Role</label>
                      <p className="text-lg font-semibold">{enhancedData.coreInfo.role}</p>
                      <p className="text-sm text-gray-600">{enhancedData.coreInfo.organization}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600">Since</label>
                      <p className="text-lg font-semibold">{enhancedData.coreInfo.since}</p>
                      <p className="text-sm text-gray-600">{enhancedData.coreInfo.location}</p>
                    </div>
                  </div>

                  <div>
                    <h5 className="font-semibold mb-3">Key Responsibilities</h5>
                    <div className="space-y-2">
                      {enhancedData.responsibilities.map((responsibility, index) => (
                        <div key={index} className="flex items-start gap-2">
                          <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                          <span className="text-sm">{responsibility}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h5 className="font-semibold mb-3">Career Background</h5>
                    <div className="space-y-3">
                      {enhancedData.coreInfo.pastRoles.map((role, index) => (
                        <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                          <Award className="h-5 w-5 text-blue-600" />
                          <span className="text-sm font-medium">{role}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Star className="h-5 w-5 text-yellow-600" />
                    Quick Actions
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button className="w-full" onClick={onEmailEntity}>
                    <Mail className="h-4 w-4 mr-2" />
                    Contact Executive
                  </Button>
                  <Button variant="outline" className="w-full">
                    <FileText className="h-4 w-4 mr-2" />
                    Export Profile
                  </Button>
                  <Button variant="outline" className="w-full">
                    <Building className="h-4 w-4 mr-2" />
                    View Organization
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5 text-purple-600" />
                    Influence Metrics
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-3 bg-purple-50 rounded-lg">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Influence Level</span>
                      <Badge className={getInfluenceColor(enhancedData.influenceAnalysis.influenceLevel)}>
                        {enhancedData.influenceAnalysis.influenceLevel}
                      </Badge>
                    </div>
                  </div>
                  
                  <div className="p-3 bg-green-50 rounded-lg">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Budget Authority</span>
                      <span className="text-xs font-bold text-green-700">Up to £5M</span>
                    </div>
                  </div>

                  <div className="p-3 bg-blue-50 rounded-lg">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Decision Scope</span>
                      <span className="text-xs font-bold text-blue-700">
                        {enhancedData.influenceAnalysis.decisionScope.length} areas
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Influence Analysis Tab */}
        <TabsContent value="influence" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-purple-600" />
                  Decision Scope
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-3">
                  {enhancedData.influenceAnalysis.decisionScope.map((scope, index) => (
                    <div key={index} className="flex items-center gap-3 p-3 bg-purple-50 rounded-lg border border-purple-200">
                      <Target className="h-5 w-5 text-purple-600" />
                      <span className="font-medium text-purple-900">{scope}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-blue-600" />
                  Relationship Mapping
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <h5 className="font-semibold text-blue-900 mb-2">Reports To</h5>
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-blue-600" />
                    <span className="text-blue-700">{enhancedData.influenceAnalysis.relationshipMapping.reportsTo}</span>
                  </div>
                </div>

                <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                  <h5 className="font-semibold text-green-900 mb-2">Collaborates With</h5>
                  <div className="space-y-2">
                    {enhancedData.influenceAnalysis.relationshipMapping.collaboratesWith.map((collaborator, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-green-600" />
                        <span className="text-green-700">{collaborator}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Communication Analysis Tab */}
        <TabsContent value="communication" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5 text-blue-600" />
                AI Communication Analysis
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="p-5 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg border border-blue-200">
                  <h5 className="font-semibold text-blue-900 mb-3">Communication Tone</h5>
                  <p className="text-blue-700 italic">"{enhancedData.aiCommunicationAnalysis.tone}"</p>
                  <div className="mt-3">
                    <Badge className="bg-blue-100 text-blue-800">
                      {enhancedData.aiCommunicationAnalysis.tone.includes('Professional') ? 'Formal' : 'Casual'}
                    </Badge>
                  </div>
                </div>

                <div className="p-5 bg-gradient-to-r from-yellow-50 to-orange-50 rounded-lg border border-yellow-200">
                  <h5 className="font-semibold text-yellow-900 mb-3">Risk Profile</h5>
                  <p className="text-yellow-700">{enhancedData.aiCommunicationAnalysis.riskProfile} risk tolerance</p>
                  <div className="mt-3">
                    <Badge className="bg-yellow-100 text-yellow-800">
                      {enhancedData.aiCommunicationAnalysis.riskProfile === 'LOW' ? 'Conservative' : 
                       enhancedData.aiCommunicationAnalysis.riskProfile === 'MEDIUM' ? 'Balanced' : 'Innovative'}
                    </Badge>
                  </div>
                </div>

                <div className="p-5 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-200">
                  <h5 className="font-semibold text-green-900 mb-3">Outreach Strategy</h5>
                  <p className="text-green-700 text-sm">{enhancedData.aiCommunicationAnalysis.outreachStrategy}</p>
                  <div className="mt-3">
                    <Badge className="bg-green-100 text-green-800">
                      Structured Approach
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="p-5 bg-gray-50 rounded-lg border border-gray-200">
                <h5 className="font-semibold text-gray-900 mb-3">Engagement Recommendations</h5>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-green-900">Lead with Data</p>
                      <p className="text-sm text-gray-600">Provide market insights and performance metrics upfront</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-green-900">Value Alignment</p>
                      <p className="text-sm text-gray-600">Emphasize sustainability and community impact</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-green-900">Pilot First</p>
                      <p className="text-sm text-gray-600">Propose small-scale trials before full implementation</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-green-900">ROI Focus</p>
                      <p className="text-sm text-gray-600">Include clear return on investment projections</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Strategic Hooks Tab */}
        <TabsContent value="opportunities" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-yellow-600" />
                Strategic Engagement Hooks
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {enhancedData.strategicHooks.map((hook, index) => (
                  <div key={index} className="p-5 bg-gradient-to-r from-yellow-50 to-orange-50 rounded-lg border border-yellow-200">
                    <div className="flex items-start gap-3">
                      <Lightbulb className="h-6 w-6 text-yellow-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <h5 className="font-semibold text-yellow-900 mb-2">Engagement Hook #{index + 1}</h5>
                        <p className="text-yellow-700">{hook}</p>
                        <div className="mt-3">
                          <Badge className="bg-yellow-100 text-yellow-800">
                            High Relevance
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 p-5 bg-blue-50 rounded-lg border border-blue-200">
                <h5 className="font-semibold text-blue-900 mb-3">Budget Authority</h5>
                <p className="text-blue-700 text-lg font-medium">{enhancedData.budgetAuthority}</p>
                <p className="text-sm text-blue-600 mt-2">This indicates significant decision-making power for partnerships and technology investments.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Current Projects Tab */}
        <TabsContent value="projects" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-orange-600" />
                Current Projects & Initiatives
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {enhancedData.currentProjects.map((project, index) => (
                  <div key={index} className="p-4 bg-orange-50 rounded-lg border border-orange-200">
                    <div className="flex items-start gap-3">
                      <Activity className="h-5 w-5 text-orange-600 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <h5 className="font-semibold text-orange-900">Active Project</h5>
                        <p className="text-orange-700">{project}</p>
                      </div>
                      <Badge className="bg-green-100 text-green-800">
                        Ongoing
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 p-5 bg-green-50 rounded-lg border border-green-200">
                <h5 className="font-semibold text-green-900 mb-3">Partnership Opportunities</h5>
                <p className="text-green-700">Based on current projects, there are strong alignment opportunities for AI-powered analytics, fan engagement platforms, and sustainability data tracking solutions.</p>
              </div>
            </CardContent>
          </Card>
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
                <div className="p-4 bg-gray-50 rounded-lg">
                  <h5 className="font-semibold mb-2">Organization</h5>
                  <p className="text-lg font-medium">{enhancedData.coreInfo.organization}</p>
                  <p className="text-sm text-gray-600">{enhancedData.coreInfo.location}</p>
                </div>

                <div className="p-4 bg-gray-50 rounded-lg">
                  <h5 className="font-semibold mb-2">Role & Department</h5>
                  <p className="text-lg font-medium">{enhancedData.coreInfo.role}</p>
                  <p className="text-sm text-gray-600">Commercial & Partnerships</p>
                </div>

                <Button className="w-full" onClick={onEmailEntity}>
                  <Mail className="h-4 w-4 mr-2" />
                  Contact Executive
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="h-5 w-5 text-purple-600" />
                  Engagement Strategy
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-purple-50 rounded-lg">
                  <h5 className="font-semibold text-purple-900 mb-2">Optimal Approach</h5>
                  <p className="text-sm text-purple-700">{enhancedData.aiCommunicationAnalysis.outreachStrategy}</p>
                </div>

                <div className="p-4 bg-blue-50 rounded-lg">
                  <h5 className="font-semibold text-blue-900 mb-2">Communication Style</h5>
                  <p className="text-sm text-blue-700">{enhancedData.aiCommunicationAnalysis.tone}</p>
                </div>

                <div className="p-4 bg-green-50 rounded-lg">
                  <h5 className="font-semibold text-green-900 mb-2">Best Contact Method</h5>
                  <p className="text-sm text-green-700">Formal proposal with case studies and ROI projections</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}