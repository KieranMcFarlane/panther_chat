import {
  Radar,
  Target,
  Zap,
  Target as OpportunityIcon,
  BarChart3,
  Network,
} from 'lucide-react';

export const discoveryNavItems = [
  { icon: Radar, label: 'Control Center', href: '/control-center' },
  { icon: Target, label: 'Scout', href: '/scout' },
  { icon: Zap, label: 'Enrichment', href: '/enrichment' },
  { icon: OpportunityIcon, label: 'Opportunities', href: '/opportunities' },
  { icon: BarChart3, label: 'Pipeline', href: '/pipeline' },
  { icon: Network, label: 'Graph', href: '/graph' },
] as const;
