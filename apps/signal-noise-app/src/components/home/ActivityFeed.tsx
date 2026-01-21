'use client'

import { useEffect, useState } from 'react'
import { Bell, FileText, Calendar, Database, ExternalLink } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'

interface Activity {
  type: 'rfp' | 'convention' | 'entity'
  message: string
  timestamp: string
  link?: string
}

export function ActivityFeed() {
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchActivity = async () => {
      try {
        const response = await fetch('/api/home/metrics')
        const data = await response.json()
        if (data.activity) {
          setActivities(data.activity)
        }
      } catch (error) {
        console.error('Error fetching activity:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchActivity()
    // Refresh every minute
    const interval = setInterval(fetchActivity, 60000)
    return () => clearInterval(interval)
  }, [])

  if (loading) {
    return (
      <Card className="bg-custom-box/80 backdrop-blur-md border border-custom-border">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Bell className="w-5 h-5 text-yellow-400" />
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="animate-pulse">
                <div className="h-4 w-full bg-white/10 rounded" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (activities.length === 0) {
    return (
      <Card className="bg-custom-box/80 backdrop-blur-md border border-custom-border">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Bell className="w-5 h-5 text-yellow-400" />
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-fm-medium-grey text-center py-4">
            No recent activity
          </div>
        </CardContent>
      </Card>
    )
  }

  const getIcon = (type: string) => {
    switch (type) {
      case 'rfp':
        return <FileText className="w-4 h-4 text-green-400" />
      case 'convention':
        return <Calendar className="w-4 h-4 text-purple-400" />
      case 'entity':
        return <Database className="w-4 h-4 text-blue-400" />
      default:
        return <Bell className="w-4 h-4 text-yellow-400" />
    }
  }

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  return (
    <Card className="bg-custom-box/80 backdrop-blur-md border border-custom-border">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <Bell className="w-5 h-5 text-yellow-400" />
          Recent Activity
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {activities.map((activity, index) => (
            <Link
              key={index}
              href={activity.link || '#'}
              className="flex items-start gap-3 p-3 rounded-lg bg-custom-bg border border-custom-border hover:border-yellow-400 transition-colors group"
            >
              <div className="mt-0.5">{getIcon(activity.type)}</div>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-white group-hover:text-yellow-400 transition-colors">
                  {activity.message}
                </div>
                <div className="text-xs text-fm-medium-grey mt-1">
                  {formatTime(activity.timestamp)}
                </div>
              </div>
              {activity.link && (
                <ExternalLink className="w-3 h-3 text-fm-medium-grey opacity-0 group-hover:opacity-100 transition-opacity" />
              )}
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}











