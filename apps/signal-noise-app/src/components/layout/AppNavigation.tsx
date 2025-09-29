'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  Menu,
  Home,
  Users,
  BarChart3,
  FileText,
  Briefcase,
  Award,
  Activity,
  Users as Team,
  BarChart3 as Analytics,
  FileText as Document,
  Briefcase as Work,
  Award as Medal,
  Activity as Pulse,
  Zap,
  MessageSquare,
  Database,
  Search,
  LayoutDashboard,
  LogIn,
  Shield
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import PageTransition from './PageTransition';
import VectorSearch from '@/components/ui/VectorSearch';
import { authClient } from '@/lib/auth-client';

// Navigation items
const navItems = [
  { icon: Home, label: 'Home', href: '/' },
  { icon: Team, label: 'Sports', href: '/sports' },
  { icon: Document, label: 'Tenders', href: '/tenders' },
  { icon: Work, label: 'Opportunities', href: '/opportunities' },
  { icon: Users, label: 'Contacts', href: '/contacts' },
  { icon: BarChart3, label: 'Graph', href: '/graph' },
  { icon: Search, label: 'Knowledge Graph', href: '/knowledge-graph' },
  { icon: Zap, label: 'Terminal', href: '/terminal' },
  { icon: MessageSquare, label: 'Knowledge Graph Chat', href: '/knowledge-graph-chat' },
  { icon: LayoutDashboard, label: 'Dashboard', href: '/dashboard' },
  { icon: Shield, label: 'Admin', href: '/admin' },
  { icon: LogIn, label: 'Login', href: '/login' },
];

interface AppNavigationProps {
  children: React.ReactNode;
}

export default function AppNavigation({ children }: AppNavigationProps) {
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const pathname = usePathname();

  const renderNavItem = (item: typeof navItems[0]) => {
    const [isOpen, setIsOpen] = useState(false);
    const isActive = pathname === item.href;
    
    const linkContent = (
      <Link
        href={item.href}
        className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
          isActive 
            ? 'bg-yellow-500 text-black font-body-medium'
            : 'text-slate-300 hover:bg-custom-border hover:text-white font-body-medium'
        } ${!sidebarExpanded ? 'justify-center' : ''}`}
      >
        <item.icon className="w-5 h-5" />
        {sidebarExpanded && <span>{item.label}</span>}
      </Link>
    );

    // When collapsed, wrap in popover for tooltip
    if (!sidebarExpanded) {
      return (
        <Popover key={item.label} open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger 
            asChild
            onMouseEnter={() => setIsOpen(true)}
            onMouseLeave={() => setIsOpen(false)}
          >
            {linkContent}
          </PopoverTrigger>
          <PopoverContent 
            side="right" 
            className="w-auto p-2"
            sideOffset={8}
            onMouseEnter={() => setIsOpen(true)}
            onMouseLeave={() => setIsOpen(false)}
          >
            <p className="text-sm font-medium">{item.label}</p>
          </PopoverContent>
        </Popover>
      );
    }

    return linkContent;
  };

  return (
    <div className="min-h-screen bg-custom-bg">
      {/* Sticky Header */}
      <div className={`bg-custom-box border-b border-custom-border sticky top-0 z-20 ${sidebarExpanded ? 'ml-64' : 'ml-16'}`}>
        <div className="flex items-center justify-between px-6 py-3">
          <div className="flex items-center gap-4">
            <Menu 
              className="icon-lg text-white cursor-pointer hover:text-yellow-400 transition-colors" 
              onClick={() => setSidebarExpanded(!sidebarExpanded)}
            />
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded flex items-center justify-center">
                <img src="/yp_logo.svg" alt="Yellow Panther Logo" className="icon-xl" />
              </div>
              <h1 className="font-subheader-large text-header">Yellow Panther</h1>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <VectorSearch />
          </div>
        </div>
      </div>

      {/* Fixed Sidebar */}
      <div className={`${sidebarExpanded ? 'w-64' : 'w-16'} bg-custom-box border-r border-custom-border h-screen fixed left-0 top-0 z-10`}>
        <div className="p-3 pt-20">
          <nav className="space-y-2">
            {navItems.map((item) => (
              <div key={item.href}>
                {renderNavItem(item)}
              </div>
            ))}
          </nav>
        </div>
      </div>

      {/* Main Content Area */}
      <div className={`p-6 ${sidebarExpanded ? 'ml-64' : 'ml-16'}`}>
        <div className="max-w-7xl mx-auto">
          <PageTransition>
            {children}
          </PageTransition>
        </div>
      </div>
    </div>
  );
}