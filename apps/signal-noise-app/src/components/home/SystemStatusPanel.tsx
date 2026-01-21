'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, AlertCircle, XCircle, RefreshCw } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface SystemStatus {
  status: 'healthy' | 'degraded' | 'down'
  components: {
    backend?: string
    neo4j?: string
    redis?: string
    supabase?: string
    brightdata?: string
  }
  last_updated?: string
}

export function SystemStatusPanel() {
  const [status, setStatus] = useState<SystemStatus | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        // Try to get detailed health status
        const response = await fetch('/api/health')
        const data = await response.json()
        
        // Parse health status
        const components: any = {}
        let overallStatus: 'healthy' | 'degraded' | 'down' = 'healthy'
        
        // Check if we have component statuses
        if (data.components) {
          Object.assign(components, data.components)
        } else {
          // Fallback: assume healthy if API responds
          components.backend = 'healthy'
          components.neo4j = 'healthy'
          components.supabase = 'healthy'
        }

        // Determine overall status
        const statuses = Object.values(components)
        if (statuses.some((s: any) => s === 'down')) {
          overallStatus = 'down'
        } else if (statuses.some((s: any) => s === 'degraded')) {
          overallStatus = 'degraded'
        }

        setStatus({
          status: overallStatus,
          components,
          last_updated: new Date().toISOString()
        })
      } catch (error) {
        console.error('Error fetching system status:', error)
        // Fallback status
        setStatus({
          status: 'degraded',
          components: {
            backend: 'unknown',
            neo4j: 'unknown',
            supabase: 'unknown'
          }
        })
      } finally {
        setLoading(false)
      }
    }

    fetchStatus()
    // Refresh every 30 seconds
    const interval = setInterval(fetchStatus, 30000)
    return () => clearInterval(interval)
  }, [])

  const getStatusIcon = (componentStatus?: string) => {
    switch (componentStatus) {
      case 'healthy':
        return <CheckCircle2 className="w-4 h-4 text-green-400" />
      case 'degraded':
        return <AlertCircle className="w-4 h-4 text-yellow-400" />
      case 'down':
        return <XCircle className="w-4 h-4 text-red-400" />
      default:
        return <AlertCircle className="w-4 h-4 text-gray-400" />
    }
  }

  const getStatusText = (componentStatus?: string) => {
    switch (componentStatus) {
      case 'healthy':
        return 'Healthy'
      case 'degraded':
        return 'Degraded'
      case 'down':
        return 'Down'
      default:
        return 'Unknown'
    }
  }

  const components = [
    { name: 'Backend API', key: 'backend' },
    { name: 'Neo4j Database', key: 'neo4j' },
    { name: 'Supabase', key: 'supabase' },
    { name: 'Redis Cache', key: 'redis' },
    { name: 'BrightData MCP', key: 'brightdata' }
  ]

  return (
    <Card className="bg-custom-box/80 backdrop-blur-md border border-custom-border">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-white flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-blue-400" />
            System Status
          </CardTitle>
          {status?.last_updated && (
            <div className="text-xs text-fm-medium-grey">
              Updated {new Date(status.last_updated).toLocaleTimeString()}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            {components.map((comp) => (
              <div key={comp.key} className="animate-pulse flex items-center gap-3">
                <div className="w-4 h-4 bg-white/10 rounded" />
                <div className="h-4 w-32 bg-white/10 rounded" />
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {components.map((comp) => {
              const componentStatus = status?.components[comp.key as keyof typeof status.components]
              return (
                <div key={comp.key} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(componentStatus)}
                    <span className="text-sm text-fm-light-grey">{comp.name}</span>
                  </div>
                  <span className={`text-xs ${
                    componentStatus === 'healthy' ? 'text-green-400' :
                    componentStatus === 'degraded' ? 'text-yellow-400' :
                    componentStatus === 'down' ? 'text-red-400' :
                    'text-gray-400'
                  }`}>
                    {getStatusText(componentStatus)}
                  </span>
                </div>
              )
            })}
          </div>
        )}
        {status && (
          <div className="mt-4 pt-4 border-t border-custom-border">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${
                status.status === 'healthy' ? 'bg-green-400' :
                status.status === 'degraded' ? 'bg-yellow-400' :
                'bg-red-400'
              }`} />
              <span className="text-xs text-fm-medium-grey capitalize">
                Overall Status: {status.status}
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}











