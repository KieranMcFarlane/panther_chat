"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { EntityBadge } from "@/components/badge/EntityBadge"
import { formatValue } from "@/lib/formatValue"
import { 
  // Overview Icons
  Building, Trophy, Users, MapPin, Calendar, Globe, Mail, ExternalLink,
  // Intelligence Icons
  Brain, BarChart3, TrendingUp, Target, Award, Star, Zap,
  // Digital Icons
  Smartphone, Monitor, Wifi, Code, Database, Cloud, Shield,
  // Opportunities Icons
  DollarSign, ShoppingBag, Handshake, Lightbulb, ArrowRight,
  // Contacts Icons
  User, Phone, Linkedin, MessageCircle, CheckCircle, AlertTriangle,
  // Analytics Icons
  Activity, PieChart, LineChart, Clock, RefreshCw
} from "lucide-react"

interface Entity {
  id: string
  neo4j_id: string | number
  labels: string[]
  properties: Record<string, any>
}

interface EntityDetailTabsProps {
  entity: Entity
  onEmailEntity: () => void
}

export function EntityDetailTabs({ entity, onEmailEntity }: EntityDetailTabsProps) {
  const [activeTab, setActiveTab] = useState("overview")
  
  const properties = entity.properties

  
  const getScoreColor = (score: any): string => {
    const numScore = parseInt(formatValue(score))
    if (isNaN(numScore)) return "text-gray-600"
    if (numScore >= 80) return "text-green-600"
    if (numScore >= 60) return "text-yellow-600"
    return "text-red-600"
  }

  const getPriorityColor = (priority: any): string => {
    const numPriority = parseInt(formatValue(priority))
    if (isNaN(numPriority)) return "bg-gray-100 text-gray-800 border-gray-200"
    if (numPriority >= 90) return "bg-red-100 text-red-800 border-red-200"
    if (numPriority >= 70) return "bg-yellow-100 text-yellow-800 border-yellow-200"
    return "bg-green-100 text-green-800 border-green-200"
  }

  const tabs = [
    {
      id: "overview",
      label: "Overview",
      icon: Building,
      description: "Basic entity information"
    },
    {
      id: "intelligence",
      label: "Intelligence",
      icon: Brain,
      description: "AI analysis and insights"
    },
    {
      id: "digital",
      label: "Digital Presence",
      icon: Smartphone,
      description: "Technology and digital assets"
    },
    {
      id: "opportunities",
      label: "Opportunities",
      icon: Target,
      description: "Business opportunities and RFPs"
    },
    {
      id: "contacts",
      label: "Contacts",
      icon: Users,
      description: "Key people and relationships"
    },
    {
      id: "analytics",
      label: "Analytics",
      icon: BarChart3,
      description: "Performance metrics and scoring"
    }
  ]

  const renderTabContent = () => {
    switch (activeTab) {
      case "overview":
        return (
          <div className="space-y-6">
            {/* Basic Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building className="h-5 w-5" />
                  Basic Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {properties.type && (
                    <div className="flex items-center gap-2">
                      <Building className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">Type:</span>
                      <span>{formatValue(properties.type)}</span>
                    </div>
                  )}
                  {properties.sport && (
                    <div className="flex items-center gap-2">
                      <Trophy className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">Sport:</span>
                      <span>{formatValue(properties.sport)}</span>
                    </div>
                  )}
                  {properties.league && (
                    <div className="flex items-center gap-2">
                      <Star className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">League:</span>
                      <span>{formatValue(properties.league)}</span>
                    </div>
                  )}
                  {properties.founded && (
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">Founded:</span>
                      <span>{formatValue(properties.founded)}</span>
                    </div>
                  )}
                  {properties.headquarters && (
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">Location:</span>
                      <span>{formatValue(properties.headquarters)}</span>
                    </div>
                  )}
                  {properties.companySize && (
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">Size:</span>
                      <span>{formatValue(properties.companySize)}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Description */}
            {properties.description && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Globe className="h-5 w-5" />
                    Description
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground leading-relaxed">
                    {formatValue(properties.description)}
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4">
                  {properties.website && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(properties.website, '_blank')}
                      className="flex items-center gap-2"
                    >
                      <Globe className="h-4 w-4" />
                      Website
                    </Button>
                  )}
                  <Button
                    variant="default"
                    size="sm"
                    onClick={onEmailEntity}
                    className="flex items-center gap-2"
                  >
                    <Mail className="h-4 w-4" />
                    Email Entity
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )

      case "intelligence":
        return (
          <div className="space-y-6">
            {/* AI Insights */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="h-5 w-5" />
                  AI Analysis & Insights
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {properties.opportunityLevel && (
                    <div className="flex items-center gap-2">
                      <Target className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">Opportunity Level:</span>
                      <Badge className={getPriorityColor(properties.opportunityLevel)}>
                        {formatValue(properties.opportunityLevel)}
                      </Badge>
                    </div>
                  )}
                  {properties.recommendedApproach && (
                    <div>
                      <h4 className="font-medium mb-2">Recommended Approach:</h4>
                      <p className="text-muted-foreground">{formatValue(properties.recommendedApproach)}</p>
                    </div>
                  )}
                  {properties.estimatedBudget && (
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">Estimated Budget:</span>
                      <span>{formatValue(properties.estimatedBudget)}</span>
                    </div>
                  )}
                  {properties.timeline && (
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">Timeline:</span>
                      <span>{formatValue(properties.timeline)}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Market Signals */}
            {properties.marketSignals && Array.isArray(properties.marketSignals) && properties.marketSignals.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Market Signals
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {properties.marketSignals.map((signal: any, index: number) => (
                      <div key={index} className="flex items-center gap-2 p-2 bg-muted/50 rounded">
                        <Zap className="h-4 w-4 text-yellow-600" />
                        <span className="text-sm">{formatValue(signal)}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Digital Transformation Signals */}
            {properties.digitalTransformationSignals && Array.isArray(properties.digitalTransformationSignals) && properties.digitalTransformationSignals.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Smartphone className="h-5 w-5" />
                    Digital Transformation Signals
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {properties.digitalTransformationSignals.map((signal: any, index: number) => (
                      <div key={index} className="flex items-center gap-2 p-2 bg-blue-50 rounded">
                        <Smartphone className="h-4 w-4 text-blue-600" />
                        <span className="text-sm">{formatValue(signal)}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )

      case "digital":
        return (
          <div className="space-y-6">
            {/* Digital Properties */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Monitor className="h-5 w-5" />
                  Digital Properties
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {properties.website && (
                    <div className="flex items-center gap-2">
                      <Globe className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">Website:</span>
                      <a 
                        href={properties.website} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline flex items-center gap-1"
                      >
                        {formatValue(properties.website)}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  )}
                  {properties.mobileApp && (
                    <div className="flex items-center gap-2">
                      <Smartphone className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">Mobile App:</span>
                      <Badge variant="secondary">Available</Badge>
                    </div>
                  )}
                  {properties.linkedinUrl && (
                    <div className="flex items-center gap-2">
                      <Linkedin className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">LinkedIn:</span>
                      <a 
                        href={properties.linkedinUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline flex items-center gap-1"
                      >
                        Profile
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Digital Maturity */}
            {(properties.digitalMaturity || properties.opportunityScore) && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Digital Maturity Assessment
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {properties.digitalMaturity && (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium">Digital Maturity Score:</span>
                          <span className={`font-bold ${getScoreColor(properties.digitalMaturity)}`}>
                            {formatValue(properties.digitalMaturity)}/100
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-blue-600 h-2 rounded-full" 
                            style={{ width: `${formatValue(properties.digitalMaturity)}%` }}
                          ></div>
                        </div>
                      </div>
                    )}
                    {properties.opportunityScore && (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium">Opportunity Score:</span>
                          <span className={`font-bold ${getScoreColor(properties.opportunityScore)}`}>
                            {formatValue(properties.opportunityScore)}/100
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-green-600 h-2 rounded-full" 
                            style={{ width: `${formatValue(properties.opportunityScore)}%` }}
                          ></div>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Technology Stack */}
            {properties.technologyStack && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Code className="h-5 w-5" />
                    Technology Stack
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {Array.isArray(properties.technologyStack) 
                      ? properties.technologyStack.map((tech: any, index: number) => (
                          <Badge key={index} variant="outline">
                            {formatValue(tech)}
                          </Badge>
                        ))
                      : formatValue(properties.technologyStack).split(',').map((tech: string, index: number) => (
                          <Badge key={index} variant="outline">
                            {tech.trim()}
                          </Badge>
                        ))
                    }
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )

      case "opportunities":
        return (
          <div className="space-y-6">
            {/* Current Opportunities */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Business Opportunities
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {properties.digitalOpportunities && Array.isArray(properties.digitalOpportunities) && properties.digitalOpportunities.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-3">Digital Opportunities:</h4>
                      <div className="space-y-2">
                        {properties.digitalOpportunities.map((opportunity: any, index: number) => (
                          <div key={index} className="flex items-start gap-3 p-3 bg-green-50 rounded-lg">
                            <Lightbulb className="h-5 w-5 text-green-600 mt-0.5" />
                            <div>
                              <p className="text-sm font-medium">{formatValue(opportunity)}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {properties.procurementNeeds && Array.isArray(properties.procurementNeeds) && properties.procurementNeeds.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-3">Procurement Needs:</h4>
                      <div className="space-y-2">
                        {properties.procurementNeeds.map((need: any, index: number) => (
                          <div key={index} className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg">
                            <ShoppingBag className="h-5 w-5 text-blue-600 mt-0.5" />
                            <div>
                              <p className="text-sm font-medium">{formatValue(need)}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {!properties.digitalOpportunities && !properties.procurementNeeds && (
                    <p className="text-muted-foreground">No specific opportunities identified yet.</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Partnership History */}
            {properties.partnerships && Array.isArray(properties.partnerships) && properties.partnerships.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Handshake className="h-5 w-5" />
                    Partnership History
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {properties.partnerships.map((partnership: any, index: number) => (
                      <div key={index} className="flex items-center gap-2 p-2 bg-muted/50 rounded">
                        <Award className="h-4 w-4 text-purple-600" />
                        <span className="text-sm">{formatValue(partnership)}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )

      case "contacts":
        return (
          <div className="space-y-6">
            {/* Key Contacts */}
            {properties.keyContacts && Array.isArray(properties.keyContacts) && properties.keyContacts.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Key Contacts
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {properties.keyContacts.map((contact: any, index: number) => (
                      <div key={index} className="border rounded-lg p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <User className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">{formatValue(contact.name)}</span>
                              {contact.priority && (
                                <Badge className={getPriorityColor(contact.priority)}>
                                  {formatValue(contact.priority)}
                                </Badge>
                              )}
                            </div>
                            
                            {contact.role && (
                              <p className="text-sm text-muted-foreground mb-2">
                                {formatValue(contact.role)}
                              </p>
                            )}
                            
                            <div className="flex flex-wrap gap-2 mt-3">
                              {contact.profileUrl && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => window.open(contact.profileUrl, '_blank')}
                                  className="flex items-center gap-1"
                                >
                                  <Linkedin className="h-3 w-3" />
                                  LinkedIn
                                </Button>
                              )}
                              {contact.email && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="flex items-center gap-1"
                                >
                                  <Mail className="h-3 w-3" />
                                  Email
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        {contact.connection && (
                          <div className="mt-3 pt-3 border-t">
                            <span className="text-xs text-muted-foreground">
                              Connection: {formatValue(contact.connection)}
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Contact Information */}
            {(!properties.keyContacts || properties.keyContacts.length === 0) && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Contact Information
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-8">
                    <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
                    <h3 className="text-lg font-medium mb-2">No Contacts Available</h3>
                    <p className="text-muted-foreground mb-4">
                      Key contact information hasn't been enriched for this entity yet.
                    </p>
                    <Button onClick={onEmailEntity} className="flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      Request Contact Enrichment
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )

      case "analytics":
        return (
          <div className="space-y-6">
            {/* Performance Scores */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Performance Analytics
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {properties.opportunityScore && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">Opportunity Score</span>
                        <span className={`font-bold ${getScoreColor(properties.opportunityScore)}`}>
                          {formatValue(properties.opportunityScore)}/100
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-3">
                        <div 
                          className="bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 h-3 rounded-full" 
                          style={{ width: `${formatValue(properties.opportunityScore)}%` }}
                        ></div>
                      </div>
                    </div>
                  )}

                  {properties.digitalMaturity && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">Digital Maturity</span>
                        <span className={`font-bold ${getScoreColor(properties.digitalMaturity)}`}>
                          {formatValue(properties.digitalMaturity)}/100
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-3">
                        <div 
                          className="bg-blue-600 h-3 rounded-full" 
                          style={{ width: `${formatValue(properties.digitalMaturity)}%` }}
                        ></div>
                      </div>
                    </div>
                  )}

                  {properties.engagementRate && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">Engagement Rate</span>
                        <span className="font-bold text-blue-600">
                          {formatValue(properties.engagementRate)}
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-3">
                        <div 
                          className="bg-blue-500 h-3 rounded-full" 
                          style={{ width: `${formatValue(properties.engagementRate)}%` }}
                        ></div>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Key Metrics */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Key Metrics
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {properties.totalMembers && (
                    <div className="text-center p-4 bg-muted/50 rounded-lg">
                      <Users className="h-8 w-8 mx-auto mb-2 text-blue-600" />
                      <div className="text-2xl font-bold">{formatValue(properties.totalMembers)}</div>
                      <div className="text-sm text-muted-foreground">Total Members</div>
                    </div>
                  )}
                  
                  {properties.employees && (
                    <div className="text-center p-4 bg-muted/50 rounded-lg">
                      <Users className="h-8 w-8 mx-auto mb-2 text-green-600" />
                      <div className="text-2xl font-bold">{formatValue(properties.employees)}</div>
                      <div className="text-sm text-muted-foreground">Employees</div>
                    </div>
                  )}
                  
                  {properties.revenue && (
                    <div className="text-center p-4 bg-muted/50 rounded-lg">
                      <DollarSign className="h-8 w-8 mx-auto mb-2 text-purple-600" />
                      <div className="text-2xl font-bold">{formatValue(properties.revenue)}</div>
                      <div className="text-sm text-muted-foreground">Revenue</div>
                    </div>
                  )}
                  
                  {properties.followers && (
                    <div className="text-center p-4 bg-muted/50 rounded-lg">
                      <Star className="h-8 w-8 mx-auto mb-2 text-yellow-600" />
                      <div className="text-2xl font-bold">{formatValue(properties.followers)}</div>
                      <div className="text-sm text-muted-foreground">Social Followers</div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Enrichment Status */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <RefreshCw className="h-5 w-5" />
                  Enrichment Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span>Basic Information: Complete</span>
                  </div>
                  
                  {properties.digitalMaturity && (
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span>Digital Analysis: Complete</span>
                    </div>
                  )}
                  
                  {properties.keyContacts && properties.keyContacts.length > 0 ? (
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span>Contact Enrichment: Complete</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-yellow-600" />
                      <span>Contact Enrichment: Pending</span>
                    </div>
                  )}
                  
                  {properties.lastEnrichmentDate && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      <span>Last Updated: {formatValue(properties.lastEnrichmentDate)}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div>
      {/* Tab Navigation */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="bg-custom-box border border-custom-border rounded-lg shadow p-1 mb-6">
          <div className="flex space-x-1">
            {tabs.map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-md font-body-medium transition-colors ${
                    activeTab === tab.id
                      ? "bg-fm-yellow text-custom-bg"
                      : "text-fm-medium-grey hover:text-fm-white"
                  }`}
                  title={tab.description}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Tab Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {renderTabContent()}
      </div>
    </div>
  )
}