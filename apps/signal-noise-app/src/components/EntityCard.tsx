"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ExternalLink, Mail, Linkedin, ArrowRight } from "lucide-react"
import { Entity, Connection } from "@/lib/neo4j"
import { EntityBadge } from "@/components/badge/EntityBadge"
import { useRouter } from "next/navigation"

interface EntityCardProps {
  entity: Entity
  similarity?: number
  connections?: Connection[]
  rank?: number
}

export function EntityCard({ entity, similarity, connections, rank }: EntityCardProps) {
  const router = useRouter()
  
  const getSimilarityColor = (score: number) => {
    if (score >= 0.9) return "bg-green-500"
    if (score >= 0.8) return "bg-blue-500"
    if (score >= 0.7) return "bg-yellow-500"
    return "bg-gray-500"
  }

  const formatEmail = (email: any) => {
    if (Array.isArray(email)) {
      return email.filter(e => e && typeof e === 'string').join(", ")
    }
    return email
  }

  const handleCardClick = () => {
    // Get current page from URL and pass it to the entity profile
    const urlParams = new URLSearchParams(window.location.search)
    const currentPage = urlParams.get('page') || '1'
    router.push(`/entity/${entity.neo4j_id}?from=${currentPage}`)
  }

  return (
    <Card 
      className="relative hover:shadow-lg transition-shadow cursor-pointer hover:scale-[1.02] transition-transform duration-200"
      onClick={handleCardClick}
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
                {entity.properties.title}
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
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="truncate">
                  {formatEmail(entity.properties.email)}
                </span>
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
            <span className="font-medium">Company:</span> {entity.properties.company}
          </div>
        )}

        {entity.properties.location && (
          <div className="text-sm">
            <span className="font-medium">Location:</span> {entity.properties.location}
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

        {/* View Profile Button */}
        <div className="border-t pt-3">
          <Button 
            variant="outline" 
            size="sm" 
            className="w-full"
            onClick={(e) => {
              e.stopPropagation()
              // Get current page from URL and pass it to the entity profile
              const urlParams = new URLSearchParams(window.location.search)
              const currentPage = urlParams.get('page') || '1'
              router.push(`/entity/${entity.neo4j_id}?from=${currentPage}`)
            }}
          >
            View Full Profile
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>

        {/* Source Information */}
        {entity.properties.source && (
          <div className="text-xs text-muted-foreground border-t pt-2">
            Source: {entity.properties.source}
          </div>
        )}
      </CardContent>
    </Card>
  )
}