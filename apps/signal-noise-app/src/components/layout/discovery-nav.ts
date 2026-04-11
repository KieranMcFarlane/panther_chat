import {
  Briefcase,
  Database,
  FileSearch,
  Home,
  Search,
  Upload,
} from 'lucide-react'

export interface DiscoveryNavItem {
  icon: typeof Home
  label: string
  href: string
  hasSubmenu?: boolean
  badge?: {
    text: string
    variant?: 'default' | 'secondary' | 'destructive' | 'outline'
  }
}

export const primaryNavItems: DiscoveryNavItem[] = [
  { icon: Home, label: 'Home', href: '/' },
  { icon: Database, label: 'Entities', href: '/entity-browser' },
  { icon: FileSearch, label: 'RFPs', href: '/rfps' },
  { icon: Briefcase, label: 'Opportunities', href: '/opportunities' },
  { icon: Upload, label: 'CSV Import', href: '/entity-import' },
  { icon: Search, label: 'Search', href: '/search' },
] as const

export const overviewNavItems = [] as const
export const advancedOpsNavItems = [] as const
export const supportNavItems = [] as const
