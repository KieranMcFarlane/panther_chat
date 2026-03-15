"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ExternalLink, Mail, Linkedin, ArrowRight, FileText, Target, Loader2 } from "lucide-react"
import { Entity, Connection } from "@/lib/neo4j"
import { EntityBadge } from "@/components/badge/EntityBadge"
import { useRouter } from "next/navigation"
import { useRef, useState } from "react"
import Link from "next/link"
import { rememberEntityBrowserUrl } from "@/lib/entity-browser-history"
import { pushWithViewTransition } from "@/lib/view-transition"

interface EntityCardProps {
  entity: Entity
  similarity?: number
  connections?: Connection[]
  rank?: number
  onEmailEntity?: (entity: Entity) => void
}

function getEntityCurrentPage(): string {
  const urlParams = new URLSearchParams(window.location.search)
  return urlParams.get('page') || '1'
}

function getEntityBrowserDossierHref(entity: Entity, currentPage: string): string {
  const stableEntityId = String(
    (entity as any)?.id ??
    (entity as any)?.graph_id ??
    ''
  ).trim()

  return `/entity-browser/${stableEntityId}/dossier?from=${currentPage}`
}

export function EntityCard({ entity, similarity, connections, rank, onEmailEntity }: EntityCardProps) {
  const router = useRouter()
  const [isProfileLoading, setIsProfileLoading] = useState(false)
  const hasPrefetchedDossierRouteRef = useRef(false)
  const stableEntityId = String(
    (entity as any)?.id ??
    (entity as any)?.graph_id ??
    ''
  ).trim()

  const prefetchDossierRoute = () => {
    if (!stableEntityId) return
    if (hasPrefetchedDossierRouteRef.current) return

    hasPrefetchedDossierRouteRef.current = true
    const currentPage = getEntityCurrentPage()
    const href = getEntityBrowserDossierHref(entity, currentPage)
    router.prefetch(href)
  }

  const getSimilarityColor = (score: number) => {
    if (score >= 0.9) return "bg-green-500"
    if (score >= 0.8) return "bg-blue-500"
    if (score >= 0.7) return "bg-yellow-500"
    return "bg-gray-500"
  }

  const formatValue = (value: any): string => {
    if (value === null || value === undefined) return ""
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
      
      // If object has email property, use that
      if ('email' in value && value.email !== undefined) {
        return formatValue(value.email)
      }
      
      // If object has address property, use that
      if ('address' in value && value.address !== undefined) {
        return formatValue(value.address)
      }
      
      // If object has title property, use that
      if ('title' in value && value.title !== undefined) {
        return formatValue(value.title)
      }
      
      // If empty object, return empty string
      if (Object.keys(value).length === 0) {
        return ""
      }
      
      // Last resort: return JSON stringified version
      try {
        const stringValue = JSON.stringify(value)
        return stringValue === '{}' ? '' : stringValue
      } catch {
        return String(value)
      }
    }
    
    return String(value)
  }

  const formatEmail = (email: any) => {
    const formatted = formatValue(email)
    return formatted || ""
  }

  const handleCardClick = () => {
    if (!stableEntityId) return
    if (isProfileLoading) return

    setIsProfileLoading(true)
    // Get current page from URL and pass it to the entity profile
    const currentPage = getEntityCurrentPage()
    rememberEntityBrowserUrl()
    pushWithViewTransition(router, `/entity/${stableEntityId}?from=${currentPage}`)
  }

  const latestPipelineRunUrl = typeof entity.properties.last_pipeline_run_detail_url === 'string'
    ? entity.properties.last_pipeline_run_detail_url
    : null


  return (
    <Card 
      className="relative hover:shadow-lg transition-shadow cursor-pointer hover:scale-[1.02] transition-transform duration-200"
      onClick={handleCardClick}
      onMouseEnter={prefetchDossierRoute}
      onFocus={prefetchDossierRoute}
      onTouchStart={prefetchDossierRoute}
    >
      {/* Similarity Score */}
      {similarity && (
        <div className="absolute top-2 right-2">
          <div
            className={`
            ${getSimilarityColor(similarity)} 
            text-white text-xs px-2 py-1 rounded-full
          `}
          >
            {Math.round(similarity * 100)}%
          </div>
        </div>
      )}

      {/* Rank Badge */}
      {rank && (
        <div className="absolute top-2 left-2">
          <Badge variant="secondary">#{rank}</Badge>
        </div>
      )}

      <CardHeader className="pb-3">
        <div className="flex items-start gap-4">
          {/* Entity Badge */}
          <EntityBadge entity={entity} size="lg" />
          
          {/* Entity Info */}
          <div className="flex-1 min-w-0">
            <CardTitle className="text-lg leading-tight">
              {entity.properties.name}
            </CardTitle>
            <div className="flex gap-2 flex-wrap mt-1">
              {entity.labels.map((label: string) => (
                <Badge key={label} variant="outline" className="text-xs">
                  {label}
                </Badge>
              ))}
            </div>
            {entity.properties.title && (
              <p className="text-sm text-muted-foreground mt-1">
                {formatValue(entity.properties.title)}
              </p>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Contact Information */}
        {(entity.properties.email || entity.properties.linkedinUrl) && (
          <div className="space-y-2">
            {entity.properties.email && (
              <div className="flex items-center justify-between gap-2 text-sm">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <Mail className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <span className="truncate">
                    {formatEmail(entity.properties.email)}
                  </span>
                </div>
                {onEmailEntity && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-shrink-0"
                    onClick={(e) => {
                      e.stopPropagation()
                      onEmailEntity(entity)
                    }}
                  >
                    <Mail className="h-3 w-3" />
                  </Button>
                )}
              </div>
            )}
            
            {entity.properties.linkedinUrl && (
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={(e) => {
                  e.stopPropagation()
                  window.open(entity.properties.linkedinUrl, '_blank')
                }}
              >
                <Linkedin className="h-4 w-4 mr-2" />
                View LinkedIn Profile
              </Button>
            )}
          </div>
        )}

        {/* Additional Properties */}
        {entity.properties.company && (
          <div className="text-sm">
            <span className="font-medium">Company:</span> {formatValue(entity.properties.company)}
          </div>
        )}

        {entity.properties.location && (
          <div className="text-sm">
            <span className="font-medium">Location:</span> {entity.properties.location}
          </div>
        )}

        {latestPipelineRunUrl && (
          <div className="pt-2">
            <Link
              href={latestPipelineRunUrl}
              className="inline-flex items-center gap-2 text-sm font-medium text-sky-700 underline underline-offset-2"
              onClick={(e) => {
                e.stopPropagation()
              }}
            >
              <FileText className="h-4 w-4" />
              Latest pipeline run
            </Link>
          </div>
        )}

        {/* Connections */}
        {connections && connections.length > 0 && (
          <div className="border-t pt-3">
            <p className="text-sm font-medium mb-2">Related Entities:</p>
            <div className="space-y-1">
              {connections.slice(0, 3).map((conn, idx) => (
                <div key={idx} className="text-xs text-muted-foreground">
                  <span className="font-medium">{conn.relationship}</span> → {conn.target}{" "}
                  <Badge variant="outline" className="text-xs ml-1">
                    {conn.target_type}
                  </Badge>
                </div>
              ))}
              {connections.length > 3 && (
                <div className="text-xs text-muted-foreground">
                  +{connections.length - 3} more connections
                </div>
              )}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="border-t pt-3 space-y-2">
          <Button 
            variant="outline" 
            size="sm" 
            className="w-full"
            disabled={isProfileLoading}
            data-testid="view-full-profile"
                onClick={(e) => {
                  e.stopPropagation()
                  if (!stableEntityId) return
                  if (isProfileLoading) return

                  setIsProfileLoading(true)
                  // Get current page from URL and pass it to the entity profile
                  const currentPage = getEntityCurrentPage()
                  rememberEntityBrowserUrl()
                  pushWithViewTransition(router, `/entity/${stableEntityId}?from=${currentPage}`)
                }}
          >
            {isProfileLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Loading Profile...
              </>
            ) : (
              <>
                View Full Profile
                <ArrowRight className="h-4 w-4 ml-2" />
              </>
            )}
          </Button>
        </div>

      </CardContent>
    </Card>
  )
}
