/**
 * Enhanced Club Dossier with Accordion Sections
 * Maintains exact same layout as current page but adds expandable sections
 */

"use client";

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { 
  Brain,
  DollarSign,
  BarChart3,
  Zap,
  Target,
  Users,
  Mail,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Clock,
  ExternalLink,
  ArrowRight,
  Lightbulb,
  Shield,
  Star,
  Activity,
  FileText,
  Globe,
  Building,
  Trophy,
  MapPin,
  Crown,
  Flag,
  Eye,
  ChevronDown,
  ChevronRight,
  Phone
} from "lucide-react"

import { Entity, formatValue, getEntityPriority } from './types'

interface EnhancedClubDossierProps {
  entity: Entity
  onEmailEntity: () => void
}

interface AccordionSectionProps {
  title: string
  children: React.ReactNode
  defaultOpen?: boolean
  icon?: React.ReactNode
  badge?: React.ReactNode
  className?: string
}

const AccordionSection: React.FC<AccordionSectionProps> = ({ 
  title, 
  children, 
  defaultOpen = false, 
  icon,
  badge,
  className = ""
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="w-full">
        <div className={`p-4 bg-purple-50 rounded-lg border border-purple-200 hover:bg-purple-100 transition-colors cursor-pointer ${className}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isOpen ? <ChevronDown className="h-4 w-4 text-purple-600" /> : <ChevronRight className="h-4 w-4 text-purple-600" />}
              {icon && <span className="text-purple-600">{icon}</span>}
              <h5 className="font-semibold text-purple-900">{title}</h5>
              {badge}
            </div>
          </div>
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-2 p-4 bg-white rounded-lg border border-purple-100">
          {children}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

export function EnhancedClubDossier({ entity, onEmailEntity }: EnhancedClubDossierProps) {
  const [activeTab, setActiveTab] = useState('overview')
  
  const props = entity.properties
  const priority = getEntityPriority(entity)

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="bg-gradient-to-r from-red-50 to-blue-50 border-2 shadow-lg">
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-3">
                <Building className="h-8 w-8 text-red-600" />
                <div>
                  <CardTitle className="text-3xl font-bold">{formatValue(props.name)}</CardTitle>
                  <div className="flex items-center space-x-2 mt-2">
                    <Badge variant="secondary">{formatValue(props.type)}</Badge>
                    <Badge variant="outline" className="flex items-center space-x-1">
                      <MapPin className="h-3 w-3" />
                      <span>{formatValue(props.headquarters) || 'London, England'}</span>
                    </Badge>
                    <Badge className="bg-red-500 text-white">WATCHLIST</Badge>
                    <Badge className="bg-blue-500 text-white">PRIORITY {priority.score}/100</Badge>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <Button variant="outline" size="sm">
                <ExternalLink className="h-4 w-4 mr-2" />
                Export Dossier
              </Button>
              <Button size="sm" onClick={onEmailEntity}>
                <Mail className="h-4 w-4 mr-2" />
                Contact
              </Button>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="pt-0">
          {/* Priority Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-600">Opportunity Score</p>
                  <p className="text-2xl font-bold text-blue-900">{priority.score}/100</p>
                </div>
                <Target className="h-8 w-8 text-blue-500" />
              </div>
            </div>
            
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-yellow-600">Digital Readiness</p>
                  <p className="text-2xl font-bold text-yellow-900">25/100</p>
                </div>
                <BarChart3 className="h-8 w-8 text-yellow-500" />
              </div>
            </div>
            
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-green-600">Partnership Fit</p>
                  <p className="text-2xl font-bold text-green-900">85/100</p>
                </div>
                <Users className="h-8 w-8 text-green-500" />
              </div>
            </div>
            
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-purple-600">Innovation Potential</p>
                  <p className="text-2xl font-bold text-purple-900">92/100</p>
                </div>
                <Lightbulb className="h-8 w-8 text-purple-500" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs Navigation */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-7">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="digital">Digital</TabsTrigger>
          <TabsTrigger value="ai">AI Insights</TabsTrigger>
          <TabsTrigger value="opportunities">Opportunities</TabsTrigger>
          <TabsTrigger value="leadership">Leadership</TabsTrigger>
          <TabsTrigger value="news">News</TabsTrigger>
          <TabsTrigger value="league">League</TabsTrigger>
          <TabsTrigger value="contact">Contact</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          {/* Core Information */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <h3 className="text-xl font-semibold text-white mb-4">Core Information</h3>
              
              <AccordionSection 
                title="Overall Assessment" 
                icon={<Brain className="h-5 w-5" />}
                defaultOpen={true}
                className="bg-purple-50"
              >
                <div className="space-y-4">
                  <p className="text-purple-700">
                    Arsenal's digital structure is mature but rigid. Their reliance on NTT DATA constrains innovation velocity while providing stability.
                  </p>
                  
                  <div className="space-y-3">
                    <h6 className="font-semibold text-purple-900">Detailed Analysis:</h6>
                    <ul className="space-y-2 text-sm text-purple-700">
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                        <span>Strong commercial performance with Emirates partnership renewal</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                        <span>Vendor lock-in limits rapid innovation cycles</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Lightbulb className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                        <span>Brand strength provides platform for experimental initiatives</span>
                      </li>
                    </ul>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <div className="bg-purple-50 p-3 rounded border border-purple-200">
                      <p className="text-xs text-purple-600 font-medium">Digital Maturity</p>
                      <p className="text-lg font-bold text-purple-900">25/100</p>
                    </div>
                    <div className="bg-purple-50 p-3 rounded border border-purple-200">
                      <p className="text-xs text-purple-600 font-medium">Transformation Score</p>
                      <p className="text-lg font-bold text-purple-900">80/100</p>
                    </div>
                  </div>
                </div>
              </AccordionSection>

              <AccordionSection 
                title="Transformation Strategy" 
                icon={<Target className="h-5 w-5" />}
                badge={<Badge className="bg-blue-100 text-blue-800">Strategic</Badge>}
              >
                <div className="space-y-4">
                  <h6 className="font-semibold text-purple-900">Yellow Panther Opportunity</h6>
                  <p className="text-purple-700">
                    Position Yellow Panther as a "lightweight experimental R&D wing" for pilot projects that NTT cannot deliver quickly.
                  </p>
                  
                  <h6 className="font-semibold text-purple-900">Recommended Approach</h6>
                  <p className="text-purple-700">
                    Start with small pilot projects, prove value quickly, then expand scope based on success metrics.
                  </p>
                  
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h6 className="font-semibold text-blue-900 mb-2">Quick Actions</h6>
                    <div className="space-y-2">
                      <Button variant="outline" size="sm" className="w-full justify-start">
                        <Eye className="h-4 w-4 mr-2" />
                        View Personnel
                      </Button>
                      <Button variant="outline" size="sm" className="w-full justify-start">
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Export Dossier
                      </Button>
                    </div>
                  </div>
                </div>
              </AccordionSection>

              <AccordionSection 
                title="Challenges & Opportunities" 
                icon={<Shield className="h-5 w-5" />}
              >
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h6 className="font-semibold text-red-900 mb-2">Key Weaknesses</h6>
                      <ul className="space-y-1 text-sm text-red-700">
                        <li>• Vendor lock-in via NTT DATA</li>
                        <li>• Legacy systems integration challenges</li>
                        <li>• Conservative organizational culture</li>
                        <li>• Limited rapid innovation capability</li>
                      </ul>
                    </div>
                    <div>
                      <h6 className="font-semibold text-green-900 mb-2">Strategic Opportunities</h6>
                      <ul className="space-y-1 text-sm text-green-700">
                        <li>• Expand women's football digital ecosystem</li>
                        <li>• Integrate fan wellness/mental health platform</li>
                        <li>• Create AR-enhanced supporter experiences</li>
                        <li>• Pilot modular fan data integration layer</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </AccordionSection>
            </div>

            {/* Right Sidebar */}
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Priority Metrics</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium">Priority Score</span>
                      <span className="text-lg font-bold text-purple-900">{priority.score}/100</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div className="bg-purple-600 h-2 rounded-full" style={{ width: `${priority.score}%` }}></div>
                    </div>
                  </div>
                  
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium">Digital Readiness</span>
                      <span className="text-sm font-bold text-yellow-600">25/100</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div className="bg-yellow-500 h-2 rounded-full" style={{ width: '25%' }}></div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Contact</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <Globe className="h-4 w-4 text-gray-500" />
                      <a href={formatValue(props.website)} target="_blank" className="text-blue-600 hover:underline">
                        {formatValue(props.website)}
                      </a>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-gray-500" />
                      <span>{formatValue(props.stadium) || 'Emirates Stadium'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-gray-500" />
                      <span>{formatValue(props.headquarters) || 'London, England'}</span>
                    </div>
                  </div>
                  
                  <Button className="w-full mt-4" onClick={onEmailEntity}>
                    <Mail className="h-4 w-4 mr-2" />
                    Contact Club
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Other tabs with similar accordion structure */}
        <TabsContent value="digital" className="space-y-4">
          <AccordionSection 
            title="Digital Maturity Assessment" 
            icon={<BarChart3 className="h-5 w-5" />}
            defaultOpen={true}
          >
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-900">25/100</div>
                  <p className="text-sm text-purple-600">Digital Maturity</p>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-900">80/100</div>
                  <p className="text-sm text-purple-600">Transformation Score</p>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-900">7/10</div>
                  <p className="text-sm text-purple-600">Website Modernness</p>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-purple-900">NTT DATA</div>
                  <p className="text-sm text-purple-600">Current Partner</p>
                </div>
              </div>
              
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <h6 className="font-semibold text-yellow-900 mb-2">Current Technology Stack</h6>
                <p className="text-yellow-700">
                  Arsenal relies on NTT DATA as primary digital services vendor, providing stability but limiting rapid innovation cycles.
                </p>
              </div>
            </div>
          </AccordionSection>
        </TabsContent>

        {/* AI Insights Tab */}
        <TabsContent value="ai" className="space-y-4">
          <AccordionSection 
            title="AI Reasoner Strategic Analysis" 
            icon={<Brain className="h-5 w-5" />}
            defaultOpen={true}
          >
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h6 className="font-semibold text-blue-900 mb-2">Overall Assessment</h6>
                <p className="text-blue-700">
                  Arsenal's digital structure is mature but rigid. Their reliance on NTT DATA constrains innovation velocity.
                </p>
              </div>
              
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h6 className="font-semibold text-green-900 mb-2">Yellow Panther Opportunity</h6>
                <p className="text-green-700">
                  Position Yellow Panther as a "lightweight experimental R&D wing" for pilot projects that NTT cannot deliver quickly.
                </p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h6 className="font-semibold text-red-900 mb-2">Risk Factors</h6>
                  <ul className="space-y-1 text-sm text-red-700">
                    <li>• Vendor lock-in</li>
                    <li>• Change resistance</li>
                    <li>• Budget constraints</li>
                  </ul>
                </div>
                <div>
                  <h6 className="font-semibold text-green-900 mb-2">Competitive Advantages</h6>
                  <ul className="space-y-1 text-sm text-green-700">
                    <li>• Brand strength</li>
                    <li>• Digital readiness</li>
                    <li>• Innovation culture</li>
                  </ul>
                </div>
              </div>
            </div>
          </AccordionSection>
        </TabsContent>

        {/* Opportunities Tab */}
        <TabsContent value="opportunities" className="space-y-4">
          <AccordionSection 
            title="Immediate Launch Opportunities" 
            icon={<Zap className="h-5 w-5" />}
            badge={<Badge className="bg-green-100 text-green-800">Quick Wins</Badge>}
            defaultOpen={true}
          >
            <div className="space-y-3">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h6 className="font-semibold text-green-900">Digital Twin of the Emirates</h6>
                  <span className="text-sm text-green-700">0/100</span>
                </div>
                <p className="text-green-700 text-sm">Interactive data portal for fan engagement</p>
              </div>
              
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h6 className="font-semibold text-green-900">AI-powered RFP Tracking Dashboard</h6>
                  <span className="text-sm text-green-700">0/100</span>
                </div>
                <p className="text-green-700 text-sm">White-label pilot program</p>
              </div>
            </div>
          </AccordionSection>

          <AccordionSection 
            title="Medium-Term Partnerships" 
            icon={<Users className="h-5 w-5" />}
          >
            <div className="space-y-3">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h6 className="font-semibold text-blue-900">Arsenal Women Bilingual Content</h6>
                  <span className="text-sm text-blue-700">0/100</span>
                </div>
                <p className="text-blue-700 text-sm">Testing platform for international fan base</p>
              </div>
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h6 className="font-semibold text-blue-900">Seasonal Intelligence Subscription</h6>
                  <span className="text-sm text-blue-700">0/100</span>
                </div>
                <p className="text-blue-700 text-sm">For commercial team</p>
              </div>
            </div>
          </AccordionSection>

          <AccordionSection 
            title="Long-Term Initiatives" 
            icon={<Crown className="h-5 w-5" />}
          >
            <div className="space-y-3">
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h6 className="font-semibold text-purple-900">Full-Stack Fan Engagement Platform</h6>
                  <span className="text-sm text-purple-700">0/100</span>
                </div>
                <p className="text-purple-700 text-sm">Comprehensive digital experience</p>
              </div>
            </div>
          </AccordionSection>
        </TabsContent>

        {/* Leadership Tab */}
        <TabsContent value="leadership" className="space-y-4">
          <AccordionSection 
            title="Key Decision Makers" 
            icon={<Crown className="h-5 w-5" />}
            defaultOpen={true}
          >
            <div className="space-y-4">
              <div className="border border-purple-200 rounded-lg p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h6 className="font-semibold text-purple-900">Juliet Slot</h6>
                    <p className="text-sm text-purple-600">Commercial Director</p>
                  </div>
                  <Badge className="bg-red-100 text-red-800">HIGH INFLUENCE</Badge>
                </div>
                
                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-medium text-purple-700">Decision Scope:</p>
                    <p className="text-sm text-purple-600">Global partnerships, Brand activations, Revenue diversification</p>
                  </div>
                  
                  <div>
                    <p className="text-sm font-medium text-purple-700">Communication Profile:</p>
                    <p className="text-sm text-purple-600">"Professional, outcome-driven, values storytelling"</p>
                  </div>
                  
                  <div>
                    <p className="text-sm font-medium text-purple-700">Risk Profile:</p>
                    <Badge className="bg-green-100 text-green-800">LOW</Badge>
                  </div>
                  
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <p className="text-sm font-medium text-blue-900 mb-1">Strategic Hooks:</p>
                    <ul className="text-sm text-blue-700 space-y-1">
                      <li>• Arsenal Mind → propose emotional analytics integration pilot</li>
                      <li>• Emirates partnership → sustainability data storytelling layer</li>
                    </ul>
                  </div>
                </div>
              </div>
              
              <Button variant="outline" className="w-full">
                <Eye className="h-4 w-4 mr-2" />
                View Full Profile
              </Button>
            </div>
          </AccordionSection>
        </TabsContent>

        {/* News, League, and Contact tabs can follow the same pattern */}
        <TabsContent value="news" className="space-y-4">
          <AccordionSection 
            title="Recent News & Developments" 
            icon={<Activity className="h-5 w-5" />}
            defaultOpen={true}
          >
            <div className="space-y-3">
              <div className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h6 className="font-semibold">Arsenal and Emirates renew sustainability partnership</h6>
                  <Badge variant="outline">85% relevant</Badge>
                </div>
                <p className="text-sm text-gray-600 mb-1">2025-09-28</p>
                <p className="text-sm text-gray-600">Source: Official Club Site</p>
              </div>
              
              <div className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h6 className="font-semibold">Arsenal Women reach record 17,000 season ticket sales</h6>
                  <Badge variant="outline">90% relevant</Badge>
                </div>
                <p className="text-sm text-gray-600 mb-1">2025-09-10</p>
                <p className="text-sm text-gray-600">Source: BBC Sport</p>
              </div>
            </div>
          </AccordionSection>
        </TabsContent>

        <TabsContent value="league" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Current Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span>Position</span>
                    <span className="font-bold">2nd</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Points</span>
                    <span className="font-bold">17</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Wins</span>
                    <span className="font-bold">5</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Goals For</span>
                    <span className="font-bold">12</span>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Recent Form</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <Badge className="bg-green-100 text-green-800">W</Badge>
                  <Badge className="bg-gray-100 text-gray-800">D</Badge>
                  <Badge className="bg-green-100 text-green-800">W</Badge>
                  <Badge className="bg-green-100 text-green-800">W</Badge>
                  <Badge className="bg-green-100 text-green-800">W</Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="contact" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Contact Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold mb-3">Key Contacts</h4>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Juliet Slot - Commercial Director</span>
                      <Badge variant="outline">Formal proposal preferred</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Mark Gonnella - Comms Director</span>
                      <Badge variant="outline">Creative pitch preferred</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Josh Kroenke - Vice Chairman</span>
                      <Badge variant="outline">Executive summary preferred</Badge>
                    </div>
                  </div>
                </div>
                
                <div>
                  <h4 className="font-semibold mb-3">Organization</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <Globe className="h-4 w-4 text-gray-500" />
                      <a href={formatValue(props.website)} target="_blank" rel="noopener noreferrer" 
                         className="text-blue-600 hover:underline">{formatValue(props.website)}</a>
                    </div>
                    <div className="flex items-center gap-2">
                      <Building className="h-4 w-4 text-gray-500" />
                      <span>{formatValue(props.stadium) || 'Emirates Stadium'}, {formatValue(props.headquarters) || 'London, England'}</span>
                    </div>
                  </div>
                  
                  <Button className="w-full mt-4" onClick={onEmailEntity}>
                    <Mail className="h-4 w-4 mr-2" />
                    Contact Club
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default EnhancedClubDossier