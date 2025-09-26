"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Entity } from "@/lib/neo4j"

interface EntityCardProps {
  entity: Entity
  similarity?: number
  connections?: Array<{
    relationship: string
    target: string
    target_type: string
  }>
  rank?: number
}

export function EntityCard({ entity, similarity, connections = [], rank }: EntityCardProps) {
  const getEntityIcon = (labels: string[]) => {
    if (labels.includes('Person')) return '👤'
    if (labels.includes('Organization')) return '🏢'
    if (labels.includes('Club')) return '⚽'
    if (labels.includes('Contact')) return '📞'
    return '📍'
  }

  const getEntityTypeColor = (labels: string[]) => {
    if (labels.includes('Person')) return 'bg-blue-100 text-blue-800'
    if (labels.includes('Organization')) return 'bg-green-100 text-green-800'
    if (labels.includes('Club')) return 'bg-purple-100 text-purple-800'
    if (labels.includes('Contact')) return 'bg-orange-100 text-orange-800'
    return 'bg-gray-100 text-gray-800'
  }

  return (
    <Card className="h-full flex flex-col hover:shadow-lg transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{getEntityIcon(entity.labels)}</span>
            <div>
              <CardTitle className="text-lg leading-tight">
                {entity.properties.name || entity.properties.title || 'Unnamed Entity'}
              </CardTitle>
              {rank && (
                <Badge variant="secondary" className="text-xs mt-1">
                  #{rank}
                </Badge>
              )}
            </div>
          </div>
          {similarity && (
            <Badge variant="outline" className="text-xs">
              {Math.round(similarity * 100)}%
            </Badge>
          )}
        </div>
        <div className="flex flex-wrap gap-1 mt-2">
          {entity.labels.map((label, index) => (
            <Badge key={index} className={`text-xs ${getEntityTypeColor([label])}`}>
              {label}
            </Badge>
          ))}
        </div>
      </CardHeader>
      
      <CardContent className="flex-1 space-y-3">
        {/* Description */}
        {entity.properties.description && (
          <p className="text-sm text-muted-foreground line-clamp-3">
            {entity.properties.description}
          </p>
        )}

        {/* Contact Info */}
        {(entity.properties.email || entity.properties.phone) && (
          <div className="space-y-1">
            {entity.properties.email && (
              <p className="text-xs text-muted-foreground">
                📧 {entity.properties.email}
              </p>
            )}
            {entity.properties.phone && (
              <p className="text-xs text-muted-foreground">
                📱 {entity.properties.phone}
              </p>
            )}
          </div>
        )}

        {/* Connections */}
        {connections.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">
              Connections ({connections.length})
            </p>
            <div className="space-y-1">
              {connections.slice(0, 3).map((connection, index) => (
                <div key={index} className="text-xs text-muted-foreground">
                  <span className="font-medium">{connection.relationship}</span> → {connection.target}
                  {connection.target_type && (
                    <Badge variant="outline" className="text-xs ml-1">
                      {connection.target_type}
                    </Badge>
                  )}
                </div>
              ))}
              {connections.length > 3 && (
                <p className="text-xs text-muted-foreground">
                  +{connections.length - 3} more...
                </p>
              )}
            </div>
          </div>
        )}

        {/* Additional Properties */}
        {entity.properties.title && entity.properties.title !== entity.properties.name && (
          <p className="text-xs text-muted-foreground">
            <strong>Title:</strong> {entity.properties.title}
          </p>
        )}
        {entity.properties.organization && (
          <p className="text-xs text-muted-foreground">
            <strong>Organization:</strong> {entity.properties.organization}
          </p>
        )}
      </CardContent>
    </Card>
  )
}