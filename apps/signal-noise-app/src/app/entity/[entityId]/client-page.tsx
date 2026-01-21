"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import Header from "@/components/header/Header"
import { useEntity } from "@/lib/swr-config"
import EmailComposeModal from "@/components/email/EmailComposeModal"
import EntityDossierRouter from "@/components/entity-dossier"
// import { useClubNavigation } from "@/contexts/ClubNavigationContext"
// import { EntityProfileSkeleton, BadgeSkeleton } from "@/components/ui/skeleton"
import { 
  ArrowLeft,
  Globe,
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

  // const { currentClub } = useClubNavigation()
  // const [isTransitioning, setIsTransitioning] = useState(false)
  // const [displayEntityId, setDisplayEntityId] = useState(actualEntityId)

  // Add loading timeout state
  const [isLoadingTimeout, setIsLoadingTimeout] = useState(false)

  // Smooth transition state
  const [showSkeleton, setShowSkeleton] = useState(true)

  // Email modal state
  const [showEmailModal, setShowEmailModal] = useState(false)

  // Use the actual entity ID for data fetching
  const { entity, error, isLoading } = useEntity(actualEntityId)
  
  // Note: In simplified SWR, we only get the entity. For connections and dossier, make direct API calls if needed
  const connections = []  // Simplified - not loading connections for now
  const dataSource = entity ? 'cache' : null
  const dossier = null  // Simplified - not loading dossier for now
  
  // Set loading timeout if loading for too long
  useEffect(() => {
    if (isLoading) {
      const timeout = setTimeout(() => {
        setIsLoadingTimeout(true)
      }, 10000) // 10 seconds

      return () => clearTimeout(timeout)
    } else {
      setIsLoadingTimeout(false)
    }
  }, [isLoading])

  // Smooth skeleton transition - keep skeleton visible briefly when data loads
  useEffect(() => {
    if (!isLoading && entity) {
      // Small delay to fade out skeleton smoothly
      const timeout = setTimeout(() => {
        setShowSkeleton(false)
      }, 100) // 100ms delay for smooth transition

      return () => clearTimeout(timeout)
    } else if (isLoading) {
      setShowSkeleton(true)
    }
  }, [isLoading, entity])
  
  // Show error state if timeout occurs
  if (isLoadingTimeout && isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-8 bg-[#1c1e2d]">
          <div className="rounded-lg bg-card text-card-foreground mb-8 border-2 shadow-lg p-6">
            <div className="text-center py-8">
              <AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">Loading Entity Information</h2>
              <p className="text-gray-400 mb-4">The entity data is taking longer than expected to load. This might be due to network issues or the entity may not exist in the database.</p>
              <div className="flex gap-4 justify-center">
                <Button onClick={() => window.location.reload()} variant="default">
                  Refresh Page
                </Button>
                <Button onClick={() => router.push('/entity-browser')} variant="outline">
                  Back to Entity Browser
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Club navigation features temporarily disabled
  // useEffect(() => {
  //   if (currentClub && currentClub.id !== displayEntityId) {
  //     setIsTransitioning(true)
      
  //     // Update URL without full page reload
  //     router.replace(`/entity/${currentClub.id}`, { scroll: false })
      
  //     // Update the displayed entity after a short delay for smooth transition
  //     setTimeout(() => {
  //       setDisplayEntityId(currentClub.id)
  //       setIsTransitioning(false)
  //     }, 150)
  //   }
  // }, [currentClub, displayEntityId, router])

  // Show loading state - use skeleton structure with smooth transition
  if (showSkeleton && isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-8 bg-[#1c1e2d]">
          {/* Header skeleton */}
          <div className="rounded-lg bg-card text-card-foreground mb-8 border-2 shadow-lg">
            <div className="flex flex-col space-y-1.5 p-6 pb-6">
              <div className="flex items-start gap-6">
                <div className="flex-shrink-0">
                  <div className="w-20 h-20 bg-gray-600 rounded-lg animate-pulse"></div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="tracking-tight text-3xl font-bold mb-2 flex items-center gap-3 header-title">
                    <div className="h-8 w-8 bg-gray-600 rounded animate-pulse"></div>
                    <div className="h-8 w-48 bg-gray-600 rounded animate-pulse"></div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <div className="h-4 w-4 bg-gray-600 rounded animate-pulse"></div>
                      <div className="h-4 w-16 bg-gray-600 rounded animate-pulse"></div>
                      <div className="h-4 w-24 bg-gray-600/60 rounded animate-pulse"></div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-4 w-4 bg-gray-600 rounded animate-pulse"></div>
                      <div className="h-4 w-16 bg-gray-600 rounded animate-pulse"></div>
                      <div className="h-4 w-20 bg-gray-600/60 rounded animate-pulse"></div>
                    </div>
                  </div>
                  <div className="flex gap-4 mt-4">
                    <div className="h-9 w-24 bg-gray-600 rounded animate-pulse"></div>
                    <div className="h-9 w-24 bg-gray-600 rounded animate-pulse"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Content skeleton */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <div className="rounded-lg border p-6 space-y-4">
                <div className="h-6 w-32 bg-gray-600 rounded animate-pulse"></div>
                <div className="space-y-2">
                  <div className="h-4 w-full bg-gray-600 rounded animate-pulse"></div>
                  <div className="h-4 w-full bg-gray-600 rounded animate-pulse"></div>
                  <div className="h-4 w-3/4 bg-gray-600 rounded animate-pulse"></div>
                </div>
              </div>
            </div>
            <div className="space-y-6">
              <div className="rounded-lg border p-6 space-y-4">
                <div className="h-6 w-32 bg-gray-600 rounded animate-pulse"></div>
                <div className="space-y-3">
                  <div className="h-4 w-24 bg-gray-600 rounded animate-pulse"></div>
                  <div className="h-8 w-32 bg-gray-600/60 rounded animate-pulse"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Handle error state
  if (error || !entity) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold">Entity Not Found</h1>
          <p className="text-muted-foreground">
            {error ? 'Error loading entity data.' : 'The requested entity could not be found.'}
          </p>
          <Button onClick={() => router.back()}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Go Back
          </Button>
        </div>
      </div>
    )
  }

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

  
  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Error Loading Entity</h2>
            <p className="text-muted-foreground mb-4">{error instanceof Error ? error.message : String(error)}</p>
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

  // Email handler
  const handleEmailEntity = () => {
    setShowEmailModal(true)
  }

  // Convert entity to contact format for EmailComposeModal
  const getContactFromEntity = () => {
    if (!entity) return null
    
    return {
      id: entity.id,
      name: properties.name || `Entity ${entity.id}`,
      email: properties.email || 'contact@' + (properties.name?.toLowerCase().replace(/\s+/g, '-') || 'unknown') + '.com',
      role: properties.type || 'Professional',
      affiliation: properties.sport ? `${properties.sport} Organization` : 'Sports Organization',
      tags: [
        properties.type || 'Organization',
        properties.sport || 'Sports',
        properties.league || 'Professional',
        ...(Array.isArray(properties.digitalOpportunities) ? properties.digitalOpportunities.slice(0, 2) : [])
      ].filter(Boolean)
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Fixed Header at Top */}
      <Header />

      {/* Main Content Area with smooth fade-in */}
      <div className={`flex-1 bg-[#1c1e2d] transition-opacity duration-150 ${showSkeleton ? 'opacity-0' : 'opacity-100'}`}>
        <div className="container mx-auto px-4 py-8">

          {/* Entity Dossier Content */}
          <div className="space-y-6">
            <EntityDossierRouter 
              entity={entity} 
              onEmailEntity={handleEmailEntity}
              dossier={dossier}
            />
          </div>
        </div>
      </div>

      {/* Email Modal */}
      {showEmailModal && (
        <EmailComposeModal
          contact={getContactFromEntity()}
          entity={entity}
          isOpen={showEmailModal}
          onClose={() => setShowEmailModal(false)}
        />
      )}
    </div>
  )
}