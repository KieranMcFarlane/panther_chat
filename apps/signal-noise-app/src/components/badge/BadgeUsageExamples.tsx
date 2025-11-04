"use client"

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { EntityBadge, CompactEntityBadge } from '@/components/badge/EntityBadge'
import { Entity } from '@/lib/neo4j'
import { ExternalLink, Copy, Check } from 'lucide-react'

interface BadgeExampleProps {
  title: string
  description: string
  entity: Entity
  component: React.ReactNode
  code?: string
}

function BadgeExample({ title, description, entity, component, code }: BadgeExampleProps) {
  const [copied, setCopied] = useState(false)

  const handleCopyCode = async () => {
    if (code) {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-center p-6 bg-muted/30 rounded-lg">
          {component}
        </div>
        {code && (
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Usage:</span>
              <Button variant="outline" size="sm" onClick={handleCopyCode}>
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copied!' : 'Copy'}
              </Button>
            </div>
            <pre className="text-xs bg-muted p-3 rounded overflow-x-auto">
              <code>{code}</code>
            </pre>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function BadgeUsageExamples() {
  const [entities, setEntities] = useState<Entity[]>([])

  useEffect(() => {
    // Mock entities for demonstration
    setEntities([
      {
        id: '133602',
        labels: ['Club'],
        properties: {
          name: 'Manchester United',
          sport: 'Football',
          country: 'England'
        }
      },
      {
        id: '4328',
        labels: ['League'],
        properties: {
          name: 'Premier League',
          sport: 'Football',
          country: 'England'
        }
      },
      {
        id: 'sao-paulo',
        labels: ['Club'],
        properties: {
          name: 'São Paulo FC',
          sport: 'Football',
          country: 'Brazil'
        }
      }
    ])
  }, [])

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold mb-2">Badge Component Usage</h2>
        <p className="text-muted-foreground">
          Examples of how to use the badge components in your application
        </p>
      </div>

      {/* Basic Usage */}
      <div className="space-y-6">
        <h3 className="text-lg font-semibold">Basic Badge Display</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <BadgeExample
            title="Standard Entity Badge"
            description="Default badge display with automatic image loading and fallback"
            entity={entities[0]}
            component={<EntityBadge entity={entities[0]} />}
            code={`import { EntityBadge } from '@/components/badge'

<EntityBadge entity={entity} />`}
          />

          <BadgeExample
            title="Compact Badge"
            description="Smaller badge variant ideal for lists and compact layouts"
            entity={entities[1]}
            component={<CompactEntityBadge entity={entities[1]} />}
            code={`import { CompactEntityBadge } from '@/components/badge'

<CompactEntityBadge entity={entity} size="sm" />`}
          />
        </div>
      </div>

      {/* Size Variants */}
      <div className="space-y-6">
        <h3 className="text-lg font-semibold">Size Variants</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <BadgeExample
            title="Small Badge"
            description="Compact size for dense layouts"
            entity={entities[0]}
            component={<EntityBadge entity={entities[0]} size="sm" />}
            code={`<EntityBadge entity={entity} size="sm" />`}
          />

          <BadgeExample
            title="Medium Badge"
            description="Default size for most use cases"
            entity={entities[0]}
            component={<EntityBadge entity={entities[0]} size="md" />}
            code={`<EntityBadge entity={entity} size="md" />`}
          />

          <BadgeExample
            title="Large Badge"
            description="Larger size for featured content"
            entity={entities[0]}
            component={<EntityBadge entity={entities[0]} size="lg" />}
            code={`<EntityBadge entity={entity} size="lg" />`}
          />
        </div>
      </div>

      {/* Integration Examples */}
      <div className="space-y-6">
        <h3 className="text-lg font-semibold">Integration Examples</h3>
        
        <Card>
          <CardHeader>
            <CardTitle>EntityCard Integration</CardTitle>
            <p className="text-sm text-muted-foreground">
              Enhanced EntityCard with badge integration
            </p>
          </CardHeader>
          <CardContent>
            <div className="bg-muted/30 p-6 rounded-lg">
              <div className="flex items-start gap-4">
                <EntityBadge entity={entities[0]} size="lg" />
                <div className="flex-1 space-y-2">
                  <div>
                    <h4 className="font-semibold">{entities[0]?.properties.name}</h4>
                    <div className="flex gap-2 mt-1">
                      {entities[0]?.labels.map((label: string) => (
                        <Badge key={label} variant="outline" className="text-xs">
                          {label}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground space-y-1">
                    <div><span className="font-medium">Sport:</span> {entities[0]?.properties.sport}</div>
                    <div><span className="font-medium">Country:</span> {entities[0]?.properties.country}</div>
                  </div>
                  <Button variant="outline" size="sm">
                    <ExternalLink className="w-4 h-4 mr-2" />
                    View Details
                  </Button>
                </div>
              </div>
            </div>
            <div className="mt-4 space-y-2">
              <div className="text-sm font-medium">Integration Code:</div>
              <pre className="text-xs bg-muted p-3 rounded overflow-x-auto">
                <code>{`// Enhanced EntityCard with badge
import { EntityBadge } from '@/components/badge'

function EnhancedEntityCard({ entity }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start gap-4">
          <EntityBadge entity={entity} size="lg" />
          <div className="flex-1">
            <CardTitle>{entity.properties.name}</CardTitle>
            <div className="flex gap-2 mt-1">
              {entity.labels.map(label => (
                <Badge key={label} variant="outline" className="text-xs">
                  {label}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      </CardHeader>
      {/* ... rest of card content ... */}
    </Card>
  )
}`}</code>
              </pre>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Badge Grid</CardTitle>
            <p className="text-sm text-muted-foreground">
              Display multiple entities in a grid layout
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
                {entities.map((entity) => (
                  <div key={entity.id} className="flex flex-col items-center space-y-2">
                    <EntityBadge entity={entity} size="md" />
                    <div className="text-xs text-center text-gray-600 font-medium line-clamp-2">
                      {entity.properties.name}
                    </div>
                  </div>
                ))}
              </div>
              <div className="space-y-2">
                <div className="text-sm font-medium">Grid Code:</div>
                <pre className="text-xs bg-muted p-3 rounded overflow-x-auto">
                  <code>{`import { EntityBadgeGrid } from '@/components/badge'

<EntityBadgeGrid 
  entities={entities} 
  size="md"
  maxItems={12}
/>`}</code>
                </pre>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Fallback Examples */}
      <div className="space-y-6">
        <h3 className="text-lg font-semibold">Fallback States</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <BadgeExample
            title="Badge Loading"
            description="Loading state while badge image is being fetched"
            entity={entities[0]}
            component={
              <div className="w-12 h-12 flex items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-400"></div>
              </div>
            }
          />

          <BadgeExample
            title="Badge Fallback"
            description="Fallback when no badge image is available"
            entity={{ id: 'unknown', labels: ['Organization'], properties: { name: 'Unknown Entity' } }}
            component={<EntityBadge entity={{ id: 'unknown', labels: ['Organization'], properties: { name: 'Unknown Entity' } }} />}
          />
        </div>
      </div>
    </div>
  )
}