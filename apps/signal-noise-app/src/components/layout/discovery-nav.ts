import {
  Database,
  FileText,
  Home,
  BarChart3,
  Upload,
  Zap,
} from 'lucide-react'

export const primaryNavItems = [
  { icon: Database, label: 'Entities', href: '/entity-browser' },
  { icon: FileText, label: "RFP's/Tenders", href: '/tenders' },
  { icon: FileText, label: 'Opportunities', href: '/opportunities' },
] as const

export const advancedOpsNavItems = [
  { icon: Zap, label: 'Enrichment', href: '/entity-enrichment' },
  { icon: BarChart3, label: 'Pipeline', href: '/entity-pipeline' },
] as const

export const supportNavItems = [
  { icon: Upload, label: 'Import CSV', href: '/entity-import' },
] as const

export const overviewNavItems = [
  { icon: Home, label: 'Home', href: '/' },
] as const
