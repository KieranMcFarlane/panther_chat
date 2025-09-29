"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { EntityBadge } from "@/components/badge/EntityBadge"
import { 
  ArrowLeft,
  Globe,
  Linkedin,
  MapPin,
  Calendar,
  Building,
  Users,
  TrendingUp,
  DollarSign,
  Target,
  Award,
  User,
  Link as LinkIcon,
  Shield,
  Database,
  ExternalLink,
  Phone,
  Mail,
  Clock,
  Star,
  CheckCircle,
  AlertTriangle,
  Info,
  Building2,
  Trophy,
  Flag,
  Heart,
  Smartphone,
  Lightbulb,
  BarChart3,
  Users2,
  Crown,
  Zap,
  ChevronRight,
  Home
} from "lucide-react"

interface Entity {
  id: string
  neo4j_id: string | number
  labels: string[]
  properties: Record<string, any>
}

interface Connection {
  relationship: string
  target: string
  target_type: string
}

export default function EntityProfileClient({ entityId }: { entityId: string }) {
  const params = useParams()
  const router = useRouter()
  const actualEntityId = params.entityId as string || entityId
  
  const [entity, setEntity] = useState<Entity | null>(null)
  const [connections, setConnections] = useState<Connection[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dataSource, setDataSource] = useState<'cache' | 'neo4j' | null>(null)

  useEffect(() => {
    const fetchEntityDetails = async () => {
      setLoading(true)
      setError(null)
      
      try {
        // Fetch entity details
        const entityResponse = await fetch(`/api/entities/${actualEntityId}`)
        if (!entityResponse.ok) {
          throw new Error(`Failed to fetch entity: ${entityResponse.status}`)
        }
        
        const entityData = await entityResponse.json()
        setEntity(entityData.entity)
        setConnections(entityData.connections || [])
        setDataSource(entityData.source || null)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch entity details")
      } finally {
        setLoading(false)
      }
    }

    if (actualEntityId) {
      fetchEntityDetails()
    }
  }, [actualEntityId])

  const formatValue = (value: any): string => {
    if (value === null || value === undefined) return "N/A"
    if (typeof value === 'string') return value
    if (typeof value === 'number') return value.toString()
    if (typeof value === 'boolean') return value ? "Yes" : "No"
    if (Array.isArray(value)) return value.map(item => formatValue(item)).join(", ")
    
    // Handle objects
    if (typeof value === 'object') {
      // If object has low and high properties (Neo4j number type), extract the low value
      if ('low' in value && 'high' in value && value.low !== undefined) {
        return formatValue(value.low)
      }
      
      // If object has a value property, use that
      if ('value' in value && value.value !== undefined) {
        return formatValue(value.value)
      }
      
      // If object has name property, use that
      if ('name' in value && value.name !== undefined) {
        return formatValue(value.name)
      }
      
      // If object has score property, use that
      if ('score' in value && value.score !== undefined) {
        return formatValue(value.score)
      }
      
      // If object has text property, use that
      if ('text' in value && value.text !== undefined) {
        return formatValue(value.text)
      }
      
      // If object has amount property, use that
      if ('amount' in value && value.amount !== undefined) {
        return formatValue(value.amount)
      }
      
      // If object has currency properties
      if ('value' in value && 'currency' in value) {
        return `${value.currency}${formatValue(value.value)}`
      }
      
      // If empty object, return N/A
      if (Object.keys(value).length === 0) {
        return "N/A"
      }
      
      // Last resort: return JSON stringified version (but nicely formatted)
      try {
        const stringValue = JSON.stringify(value)
        return stringValue === '{}' ? 'N/A' : stringValue
      } catch {
        return String(value)
      }
    }
    
    return String(value)
  }

  const formatCurrency = (value: any): string => {
    if (!value || value === "N/A") return "N/A"
    
    // First, format the value to handle objects
    const formattedValue = formatValue(value)
    if (formattedValue === "N/A") return "N/A"
    
    const num = parseFloat(formattedValue.toString().replace(/[£,$,M,K]/g, ''))
    if (isNaN(num)) return formattedValue
    
    if (formattedValue.toString().includes('M')) return `£${num}M`
    if (formattedValue.toString().includes('K')) return `£${num}K`
    return `£${num.toLocaleString()}`
  }

  const formatPercentage = (value: any): string => {
    if (!value || value === "N/A") return "N/A"
    
    // First, format the value to handle objects
    const formattedValue = formatValue(value)
    if (formattedValue === "N/A") return "N/A"
    
    const num = parseFloat(formattedValue.toString())
    if (isNaN(num)) return formattedValue
    return `${num}%`
  }

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

  const getEntityIcon = (labels: string[]) => {
    if (labels.includes('Club')) return Building2
    if (labels.includes('League')) return Trophy
    if (labels.includes('Person')) return User
    if (labels.includes('Organization')) return Building
    return Building2
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Database className="h-12 w-12 animate-spin mx-auto mb-4 text-primary" />
          <h2 className="text-xl font-semibold mb-2">Loading Entity Profile</h2>
          <p className="text-muted-foreground">Fetching entity details...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Error Loading Entity</h2>
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button onClick={() => router.back()} variant="outline">
              Go Back
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!entity) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <Info className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Entity Not Found</h2>
            <p className="text-muted-foreground mb-4">The requested entity could not be found.</p>
            <Button onClick={() => router.back()} variant="outline">
              Go Back
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const EntityIcon = getEntityIcon(entity.labels)
  const properties = entity.properties

  return (
    <div className="min-h-screen bg-background">
      {/* Header with Breadcrumbs */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-6">
          {/* Breadcrumbs */}
          <nav className="flex items-center space-x-1 text-sm text-muted-foreground mb-4">
            <Link href="/" className="flex items-center hover:text-foreground transition-colors">
              <Home className="h-4 w-4" />
            </Link>
            <ChevronRight className="h-4 w-4" />
            <Link href="/entity-browser" className="hover:text-foreground transition-colors">
              Entity Browser
            </Link>
            <ChevronRight className="h-4 w-4" />
            <span className="text-foreground font-medium truncate max-w-xs">
              {entity?.properties.name || 'Entity Profile'}
            </span>
          </nav>
          
          <div className="flex items-center gap-4 mb-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                // Try to go back to entity browser, if available
                const referrer = document.referrer
                if (referrer && referrer.includes('/entity-browser')) {
                  router.back()
                } else {
                  // Fallback to entity browser with preserved page if possible
                  const urlParams = new URLSearchParams(window.location.search)
                  const pageParam = urlParams.get('from')
                  const targetUrl = pageParam ? `/entity-browser?page=${pageParam}` : '/entity-browser'
                  router.push(targetUrl)
                }
              }}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Browser
            </Button>
            
            {dataSource && (
              <Badge 
                variant={dataSource === 'cache' ? 'default' : 'secondary'}
                className="flex items-center gap-1"
              >
                <Database className="h-3 w-3" />
                {dataSource === 'cache' ? 'Cached' : 'Live'}
              </Badge>
            )}
            
            <div className="flex items-center gap-2 ml-auto">
              {entity?.labels.map((label) => (
                <Badge key={label} variant="outline">
                  {label}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Main Entity Header */}
        <Card className="mb-8 border-2 shadow-lg">
          <CardHeader className="pb-6">
            <div className="flex items-start gap-6">
              <div className="flex-shrink-0">
                <EntityBadge entity={entity} size="xl" />
              </div>
              
              <div className="flex-1 min-w-0">
                <CardTitle className="text-3xl font-bold mb-2 flex items-center gap-3">
                  <EntityIcon className="h-8 w-8 text-primary" />
                  {properties.name || `Entity ${entity.id}`}
                </CardTitle>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
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
                      <Flag className="h-4 w-4 text-muted-foreground" />
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
                
                <div className="flex gap-4 mt-4">
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
                  
                  {properties.linkedin && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(properties.linkedin, '_blank')}
                      className="flex items-center gap-2"
                    >
                      <Linkedin className="h-4 w-4" />
                      LinkedIn
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Overview and Digital */}
          <div className="lg:col-span-2 space-y-6">
            {/* Overview Section */}
            {properties.description && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Info className="h-5 w-5" />
                    Overview
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground leading-relaxed">
                    {formatValue(properties.description)}
                  </p>
                  
                  {/* Key Achievements */}
                  {(properties.achievements || properties.emiratesStadium || properties.womensSeasonTickets) && (
                    <div className="mt-6">
                      <h4 className="font-semibold mb-3 flex items-center gap-2">
                        <Award className="h-4 w-4" />
                        Key Achievements
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {properties.emiratesStadium && (
                          <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                            <CheckCircle className="h-4 w-4 text-green-600" />
                            <span className="text-sm">Emirates Stadium</span>
                          </div>
                        )}
                        {properties.womensSeasonTickets && (
                          <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                            <Users2 className="h-4 w-4 text-blue-600" />
                            <span className="text-sm">{formatValue(properties.womensSeasonTickets)} Women's Season Tickets</span>
                          </div>
                        )}
                        {properties.communityYears && (
                          <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                            <Heart className="h-4 w-4 text-red-600" />
                            <span className="text-sm">{formatValue(properties.communityYears)} Years Community Work</span>
                          </div>
                        )}
                        {properties.mobileApp && (
                          <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                            <Smartphone className="h-4 w-4 text-purple-600" />
                            <span className="text-sm">Official Mobile App</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Digital & Transformation Section */}
            {(properties.digitalMaturity || properties.digitalScore || properties.websiteModernness) && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="h-5 w-5" />
                    Digital & Transformation
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                    {properties.digitalMaturity && (
                      <div className="text-center p-4 border rounded-lg">
                        <div className={`text-2xl font-bold ${getScoreColor(properties.digitalMaturity)}`}>
                          {formatValue(properties.digitalMaturity)}
                        </div>
                        <div className="text-sm text-muted-foreground">Digital Maturity</div>
                      </div>
                    )}
                    
                    {properties.digitalScore && (
                      <div className="text-center p-4 border rounded-lg">
                        <div className={`text-2xl font-bold ${getScoreColor(properties.digitalScore)}`}>
                          {formatValue(properties.digitalScore)}
                        </div>
                        <div className="text-sm text-muted-foreground">Transformation Score</div>
                      </div>
                    )}
                    
                    {properties.websiteModernness && (
                      <div className="text-center p-4 border rounded-lg">
                        <div className={`text-2xl font-bold ${getScoreColor(properties.websiteModernness)}`}>
                          {formatValue(properties.websiteModernness)}
                        </div>
                        <div className="text-sm text-muted-foreground">Website Modernness</div>
                      </div>
                    )}
                  </div>
                  
                  {properties.digitalWeakness && (
                    <div className="mb-4">
                      <h4 className="font-medium mb-2 text-red-700">Digital Weakness</h4>
                      <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">
                        {formatValue(properties.digitalWeakness)}
                      </p>
                    </div>
                  )}
                  
                  {properties.digitalOpportunities && (
                    <div>
                      <h4 className="font-medium mb-2 flex items-center gap-2">
                        <Lightbulb className="h-4 w-4" />
                        Digital Opportunities
                      </h4>
                      <div className="space-y-2">
                        {Array.isArray(properties.digitalOpportunities) 
                          ? properties.digitalOpportunities.map((opportunity: string, index: number) => (
                              <div key={index} className="flex items-start gap-2 text-sm">
                                <div className="w-1.5 h-1.5 bg-blue-600 rounded-full mt-2 flex-shrink-0" />
                                <span>{opportunity}</span>
                              </div>
                            ))
                          : <div className="flex items-start gap-2 text-sm">
                              <div className="w-1.5 h-1.5 bg-blue-600 rounded-full mt-2 flex-shrink-0" />
                              <span>{formatValue(properties.digitalOpportunities)}</span>
                            </div>
                        }
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Key Personnel Section */}
            {properties.keyPersonnel && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Key Personnel
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {Array.isArray(properties.keyPersonnel) 
                      ? properties.keyPersonnel.map((person: string, index: number) => (
                          <div key={index} className="flex items-center gap-3 p-3 border rounded-lg">
                            <User className="h-5 w-5 text-muted-foreground" />
                            <span className="font-medium">{person}</span>
                          </div>
                        ))
                      : <div className="flex items-center gap-3 p-3 border rounded-lg">
                          <User className="h-5 w-5 text-muted-foreground" />
                          <span className="font-medium">{formatValue(properties.keyPersonnel)}</span>
                        </div>
                    }
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right Column - Finance and Strategy */}
          <div className="space-y-6">
            {/* Finance & Strategy Section */}
            {(properties.estimatedValue || properties.budgetRange || properties.yellowPantherFit) && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Finance & Strategy
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {properties.estimatedValue && (
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <DollarSign className="h-4 w-4 text-green-600" />
                        <span className="font-medium">Estimated Value</span>
                      </div>
                      <div className="text-lg font-semibold text-green-700">
                        {formatCurrency(properties.estimatedValue)}
                      </div>
                    </div>
                  )}
                  
                  {properties.budgetRange && (
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <TrendingUp className="h-4 w-4 text-blue-600" />
                        <span className="font-medium">Budget Range</span>
                      </div>
                      <div className="text-lg font-semibold text-blue-700">
                        {formatCurrency(properties.budgetRange)}
                      </div>
                    </div>
                  )}
                  
                  {properties.yellowPantherFit && (
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Target className="h-4 w-4 text-purple-600" />
                        <span className="font-medium">Yellow Panther Fit</span>
                      </div>
                      <Badge className={`${getPriorityColor(0)} text-sm font-medium`}>
                        {formatValue(properties.yellowPantherFit)}
                      </Badge>
                    </div>
                  )}
                  
                  {properties.yellowPantherStrategy && (
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Crown className="h-4 w-4 text-yellow-600" />
                        <span className="font-medium">Strategy</span>
                      </div>
                      <Badge variant="outline" className="text-sm">
                        {formatValue(properties.yellowPantherStrategy)}
                      </Badge>
                    </div>
                  )}
                  
                  {properties.yellowPantherPriority && (
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Star className="h-4 w-4 text-red-600" />
                        <span className="font-medium">Priority Score</span>
                      </div>
                      <div className={`text-lg font-bold ${getScoreColor(properties.yellowPantherPriority)}`}>
                        {formatValue(properties.yellowPantherPriority)}/100
                      </div>
                    </div>
                  )}
                  
                  {properties.opportunityScore && (
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Target className="h-4 w-4 text-green-600" />
                        <span className="font-medium">Opportunity Score</span>
                      </div>
                      <div className={`text-lg font-bold ${getScoreColor(properties.opportunityScore)}`}>
                        {formatValue(properties.opportunityScore)}/100
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* RFP Information */}
            {(properties.rfpType || properties.rfpValue || properties.rfpDeadline) && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    RFP Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {properties.rfpType && (
                    <div>
                      <span className="text-sm font-medium text-muted-foreground">Type:</span>
                      <div className="text-sm">{formatValue(properties.rfpType)}</div>
                    </div>
                  )}
                  
                  {properties.rfpValue && (
                    <div>
                      <span className="text-sm font-medium text-muted-foreground">Value:</span>
                      <div className="text-sm">{formatValue(properties.rfpValue)}</div>
                    </div>
                  )}
                  
                  {properties.rfpDeadline && (
                    <div>
                      <span className="text-sm font-medium text-muted-foreground">Deadline:</span>
                      <div className="text-sm">{formatValue(properties.rfpDeadline)}</div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Partnerships */}
            {properties.partnerships && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <LinkIcon className="h-5 w-5" />
                    Partnerships
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {Array.isArray(properties.partnerships) 
                      ? properties.partnerships.map((partner: string, index: number) => (
                          <div key={index} className="flex items-center gap-2 text-sm">
                            <div className="w-2 h-2 bg-blue-600 rounded-full" />
                            <span>{partner}</span>
                          </div>
                        ))
                      : <div className="flex items-center gap-2 text-sm">
                          <div className="w-2 h-2 bg-blue-600 rounded-full" />
                          <span>{formatValue(properties.partnerships)}</span>
                        </div>
                    }
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Connections */}
            {connections.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ExternalLink className="h-5 w-5" />
                    Connections ({connections.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {connections.map((connection, index) => (
                      <div key={index} className="flex items-center justify-between p-2 border rounded">
                        <div>
                          <div className="font-medium text-sm">{connection.target}</div>
                          <div className="text-xs text-muted-foreground">{connection.target_type}</div>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {connection.relationship}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Contact Information */}
            {(properties.email || properties.phone) && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Phone className="h-5 w-5" />
                    Contact Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {properties.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <a href={`mailto:${properties.email}`} className="text-sm hover:underline">
                        {formatValue(properties.email)}
                      </a>
                    </div>
                  )}
                  
                  {properties.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <a href={`tel:${properties.phone}`} className="text-sm hover:underline">
                        {formatValue(properties.phone)}
                      </a>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}