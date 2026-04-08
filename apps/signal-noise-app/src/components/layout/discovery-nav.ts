import {
  Briefcase,
  Database,
  Home,
} from 'lucide-react'

export const primaryNavItems = [
  { icon: Home, label: 'Home', href: '/' },
  { icon: Database, label: 'Entities', href: '/entity-browser' },
  { icon: Briefcase, label: 'Opportunities', href: '/opportunities' },
] as const

export const overviewNavItems = [] as const
export const advancedOpsNavItems = [] as const
export const supportNavItems = [] as const
