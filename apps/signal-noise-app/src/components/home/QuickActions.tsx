'use client'

import { Search, Bell, Network, Calendar, FileText } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export function QuickActions() {
  const router = useRouter()

  const actions = [
    {
      icon: Search,
      label: 'Search',
      description: 'Find anything',
      href: '/tenders',
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/20'
    },
    {
      icon: Bell,
      label: 'New Alerts',
      description: 'RFPs matching your criteria',
      href: '/tenders?filter=new',
      badge: 3,
      color: 'text-green-400',
      bgColor: 'bg-green-500/20'
    },
    {
      icon: Network,
      label: 'Explore Graph',
      description: 'View relationships',
      href: '/graph',
      color: 'text-purple-400',
      bgColor: 'bg-purple-500/20'
    },
    {
      icon: Calendar,
      label: 'Conventions',
      description: 'Upcoming events',
      href: '/conventions',
      color: 'text-orange-400',
      bgColor: 'bg-orange-500/20'
    }
  ]

  return (
    <Card className="bg-custom-box/80 backdrop-blur-md border border-custom-border">
      <CardHeader>
        <CardTitle className="text-white">Quick Actions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3">
          {actions.map((action, index) => (
            <Link key={index} href={action.href}>
              <Button
                variant="ghost"
                className="w-full h-auto p-4 flex flex-col items-center gap-2 hover:bg-custom-bg border border-custom-border hover:border-yellow-400 transition-all"
                onClick={(e) => {
                  e.preventDefault()
                  router.push(action.href)
                }}
              >
                <div className={`p-3 rounded-lg ${action.bgColor} relative`}>
                  <action.icon className={`w-5 h-5 ${action.color}`} />
                  {action.badge && (
                    <Badge 
                      variant="destructive" 
                      className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs"
                    >
                      {action.badge}
                    </Badge>
                  )}
                </div>
                <div className="text-center">
                  <div className="text-sm font-semibold text-white mb-1">{action.label}</div>
                  <div className="text-xs text-fm-medium-grey">{action.description}</div>
                </div>
              </Button>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}











