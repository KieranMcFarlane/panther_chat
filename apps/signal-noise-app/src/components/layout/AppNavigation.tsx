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
  Shield,
  MessagesSquare,
  Target,
  Brain,
  Trophy,
  Calendar,
  ChevronDown,
  ChevronRight,
  Network,
  Monitor,
  Eye,
  Bot,
  Clock,
  Radar
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import PageTransition from './PageTransition';
import VectorSearch from '@/components/ui/VectorSearch';
import { authClient } from '@/lib/auth-client';

// Navigation items - Core demo functionality only
const navItems = [
  { icon: Home, label: 'Home', href: '/' },
  { icon: Search, label: 'Entities', href: '/entity-browser' },
  { icon: FileText, label: "RFP's/Tenders", href: '/tenders' },
  { 
    icon: Bot, 
    label: 'Claude Agent Demo', 
    href: '/claude-agent-demo',
    badge: { text: 'LIVE', variant: 'default' as const }
  },
  { 
    icon: Monitor, 
    label: 'Agent Logs', 
    href: '/agent-logs',
    badge: { text: 'LIVE', variant: 'destructive' as const }
  },
  { 
    icon: Radar, 
    label: 'A2A RFP Discovery', 
    href: '/a2a-rfp-discovery',
    badge: { text: 'AI', variant: 'default' as const }
  },
  { 
    icon: Network, 
    label: 'MCP-Enabled A2A', 
    href: '/mcp-a2a-discovery',
    badge: { text: 'MCP', variant: 'destructive' as const }
  },
  { 
    icon: BarChart3, 
    label: 'Graph', 
    href: '/graph',
    hasSubmenu: true,
    subItems: [
      { icon: Network, label: '2D Network', href: '/graph' },
      { icon: Monitor, label: 'VR Visualization', href: '/graph/vr' },
      { icon: Eye, label: 'AR Visualization', href: '/graph/ar' },
    ]
  },
  { 
    icon: Calendar, 
    label: 'Conventions', 
    href: '/conventions',
    badge: { text: 'NEW', variant: 'default' as const }
  },
];

interface AppNavigationProps {
  children: React.ReactNode;
}

export default function AppNavigation({ children }: AppNavigationProps) {
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const pathname = usePathname();

  const renderNavItem = (item: typeof navItems[0]) => {
    const [isOpen, setIsOpen] = useState(false);
    const isActive = pathname === item.href || (item.hasSubmenu && pathname.startsWith(item.href));
    
    const handleClick = (e: React.MouseEvent) => {
      if (item.hasSubmenu) {
        e.preventDefault();
        setIsOpen(!isOpen);
      }
    };
    
    const linkContent = (
      <div
        className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
          isActive 
            ? 'bg-yellow-500 text-black font-body-medium'
            : 'text-slate-300 hover:bg-custom-border hover:text-white font-body-medium'
        } ${!sidebarExpanded ? 'justify-center px-3' : ''}`}
      >
        <item.icon className="w-5 h-5 flex-shrink-0" />
        {sidebarExpanded && (
          <>
            <span className="flex-1">{item.label}</span>
            <div className="flex items-center gap-2">
              {item.badge && (
                <Badge variant={item.badge.variant} className="text-xs">
                  {item.badge.text}
                </Badge>
              )}
              {item.hasSubmenu && (
                <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
              )}
            </div>
          </>
        )}
      </div>
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
            <Link href={item.hasSubmenu ? '#' : item.href}>
              {linkContent}
            </Link>
          </PopoverTrigger>
          <PopoverContent 
            side="right" 
            className="w-auto p-2"
            sideOffset={8}
            onMouseEnter={() => setIsOpen(true)}
            onMouseLeave={() => setIsOpen(false)}
          >
            <p className="text-sm font-medium">{item.label}</p>
            {item.hasSubmenu && item.subItems && (
              <div className="mt-1 space-y-1 border-t border-custom-border pt-1">
                {item.subItems.map((subItem) => (
                  <Link
                    key={subItem.href}
                    href={subItem.href}
                    className="flex items-center gap-2 px-2 py-1 text-xs hover:bg-custom-bg rounded"
                  >
                    <subItem.icon className="w-3 h-3" />
                    <span>{subItem.label}</span>
                  </Link>
                ))}
              </div>
            )}
          </PopoverContent>
        </Popover>
      );
    }

    return (
      <div key={item.href} className="w-full">
        {item.hasSubmenu ? (
          // For items with submenus, keep the clickable div behavior
          <div onClick={handleClick}>
            {linkContent}
          </div>
        ) : (
          // For regular navigation items, use proper Link
          <Link href={item.href} onClick={handleClick}>
            {linkContent}
          </Link>
        )}
        {item.hasSubmenu && sidebarExpanded && isOpen && (
          <div className="ml-4 mt-1 space-y-1">
            {item.subItems?.map((subItem) => {
              const isSubActive = pathname === subItem.href;
              return (
                <Link
                  key={subItem.href}
                  href={subItem.href}
                  className={`flex items-center gap-2 px-3 py-1 text-sm rounded transition-colors ${
                    isSubActive 
                      ? 'bg-yellow-500 text-black font-medium'
                      : 'text-fm-light-grey hover:bg-custom-border hover:text-white'
                  }`}
                >
                  <subItem.icon className="w-4 h-4" />
                  <span>{subItem.label}</span>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-custom-bg overflow-x-hidden">
      {/* Fixed Sidebar */}
      <div className={`${sidebarExpanded ? 'w-64' : 'w-[4.4375rem]'} bg-custom-box border-r border-custom-border h-screen fixed left-0 top-0 z-10 transition-[width,transform] duration-1200`} style={{ transitionTimingFunction: 'cubic-bezier(0.37, 0, 0.63, 1)' }}>
        <div className={`${sidebarExpanded ? 'flex items-center justify-between gap-4 p-3' : 'flex flex-col justify-between gap-3 p-3'}`}>
          <div className={`${sidebarExpanded ? 'flex items-center gap-3' : 'relative w-12 h-12 group flex items-center'}`}>
            <div className="w-12 h-12 rounded flex items-center justify-center">
              <img 
                src="/yp_logo.svg" 
                alt="Yellow Panther Logo" 
                className="icon-xl transition-opacity opacity-100 group-hover:opacity-0 z-10 relative duration-300" style={{ transitionTimingFunction: 'cubic-bezier(0.37, 0, 0.63, 1)' }} 
              />
            </div>
            {!sidebarExpanded && (
              <>
                <div className="absolute inset-0 z-0 flex items-center justify-center">
                  <svg 
                    width="20" 
                    height="20" 
                    viewBox="0 0 20 20" 
                    fill="currentColor" 
                    xmlns="http://www.w3.org/2000/svg" 
                    data-rtl-flip="" 
                    className="icon-lg text-white cursor-pointer hover:text-yellow-400 transition-colors max-md:hidden"
                    onClick={() => setSidebarExpanded(!sidebarExpanded)}
                  >
                    <path d="M6.83496 3.99992C6.38353 4.00411 6.01421 4.0122 5.69824 4.03801C5.31232 4.06954 5.03904 4.12266 4.82227 4.20012L4.62207 4.28606C4.18264 4.50996 3.81498 4.85035 3.55859 5.26848L3.45605 5.45207C3.33013 5.69922 3.25006 6.01354 3.20801 6.52824C3.16533 7.05065 3.16504 7.71885 3.16504 8.66301V11.3271C3.16504 12.2712 3.16533 12.9394 3.20801 13.4618C3.25006 13.9766 3.33013 14.2909 3.45605 14.538L3.55859 14.7216C3.81498 15.1397 4.18266 15.4801 4.62207 15.704L4.82227 15.79C5.03904 15.8674 5.31234 15.9205 5.69824 15.9521C6.01398 15.9779 6.383 15.986 6.83398 15.9902L6.83496 3.99992ZM18.165 11.3271C18.165 12.2493 18.1653 12.9811 18.1172 13.5702C18.0745 14.0924 17.9916 14.5472 17.8125 14.9648L17.7295 15.1415C17.394 15.8 16.8834 16.3511 16.2568 16.7353L15.9814 16.8896C15.5157 17.1268 15.0069 17.2285 14.4102 17.2773C13.821 17.3254 13.0893 17.3251 12.167 17.3251H7.83301C6.91071 17.3251 6.17898 17.3254 5.58984 17.2773C5.06757 17.2346 4.61294 17.1508 4.19531 16.9716L4.01855 16.8896C3.36014 16.5541 2.80898 16.0434 2.4248 15.4169L2.27051 15.1415C2.03328 14.6758 1.93158 14.167 1.88281 13.5702C1.83468 12.9811 1.83496 12.2493 1.83496 11.3271V8.66301C1.83496 7.74072 1.83468 7.00898 1.88281 6.41985C1.93157 5.82309 2.03329 5.31432 2.27051 4.84856L2.4248 4.57317C2.80898 3.94666 3.36012 3.436 4.01855 3.10051L4.19531 3.0175C4.61285 2.83843 5.06771 2.75548 5.58984 2.71281C6.17898 2.66468 6.91071 2.66496 7.83301 2.66496H12.167C13.0893 2.66496 13.821 2.66468 14.4102 2.71281C15.0069 2.76157 15.5157 2.86329 15.9814 3.10051L16.2568 3.25481C16.8833 3.63898 17.394 4.19012 17.7295 4.84856L17.8125 5.02531C17.9916 5.44285 18.0745 5.89771 18.1172 6.41985C18.1653 7.00898 18.165 7.74072 18.165 8.66301V11.3271ZM8.16406 15.995H12.167C13.1112 15.995 13.7794 15.9947 14.3018 15.9521C14.8164 15.91 15.1308 15.8299 15.3779 15.704L15.5615 15.6015C15.9797 15.3451 16.32 14.9774 16.5439 14.538L16.6299 14.3378C16.7074 14.121 16.7605 13.8478 16.792 13.4618C16.8347 12.9394 16.835 12.2712 16.835 11.3271V8.66301C16.835 7.71885 16.8347 7.05065 16.792 6.52824C16.7605 6.14232 16.7073 5.86904 16.6299 5.65227L16.5439 5.45207C16.32 5.01264 15.9796 4.64498 15.5615 4.3886L15.3779 4.28606C15.1308 4.16013 14.8165 4.08006 14.3018 4.03801C13.7794 3.99533 13.1112 3.99504 12.167 3.99504H8.16406C8.16407 3.99667 8.16504 3.99829 8.16504 3.99992L8.16406 15.995Z"></path>
                  </svg>
                </div>
                <div 
                  className="absolute inset-0 z-20 cursor-pointer"
                  onClick={() => setSidebarExpanded(!sidebarExpanded)}
                />
              </>
            )}
          </div>
          {sidebarExpanded && (
            <svg 
              width="20" 
              height="20" 
              viewBox="0 0 20 20" 
              fill="currentColor" 
              xmlns="http://www.w3.org/2000/svg" 
              data-rtl-flip="" 
              className="icon-lg text-white cursor-pointer hover:text-yellow-400 transition-colors"
              onClick={() => setSidebarExpanded(!sidebarExpanded)}
            >
              <path d="M6.83496 3.99992C6.38353 4.00411 6.01421 4.0122 5.69824 4.03801C5.31232 4.06954 5.03904 4.12266 4.82227 4.20012L4.62207 4.28606C4.18264 4.50996 3.81498 4.85035 3.55859 5.26848L3.45605 5.45207C3.33013 5.69922 3.25006 6.01354 3.20801 6.52824C3.16533 7.05065 3.16504 7.71885 3.16504 8.66301V11.3271C3.16504 12.2712 3.16533 12.9394 3.20801 13.4618C3.25006 13.9766 3.33013 14.2909 3.45605 14.538L3.55859 14.7216C3.81498 15.1397 4.18266 15.4801 4.62207 15.704L4.82227 15.79C5.03904 15.8674 5.31234 15.9205 5.69824 15.9521C6.01398 15.9779 6.383 15.986 6.83398 15.9902L6.83496 3.99992ZM18.165 11.3271C18.165 12.2493 18.1653 12.9811 18.1172 13.5702C18.0745 14.0924 17.9916 14.5472 17.8125 14.9648L17.7295 15.1415C17.394 15.8 16.8834 16.3511 16.2568 16.7353L15.9814 16.8896C15.5157 17.1268 15.0069 17.2285 14.4102 17.2773C13.821 17.3254 13.0893 17.3251 12.167 17.3251H7.83301C6.91071 17.3251 6.17898 17.3254 5.58984 17.2773C5.06757 17.2346 4.61294 17.1508 4.19531 16.9716L4.01855 16.8896C3.36014 16.5541 2.80898 16.0434 2.4248 15.4169L2.27051 15.1415C2.03328 14.6758 1.93158 14.167 1.88281 13.5702C1.83468 12.9811 1.83496 12.2493 1.83496 11.3271V8.66301C1.83496 7.74072 1.83468 7.00898 1.88281 6.41985C1.93157 5.82309 2.03329 5.31432 2.27051 4.84856L2.4248 4.57317C2.80898 3.94666 3.36012 3.436 4.01855 3.10051L4.19531 3.0175C4.61285 2.83843 5.06771 2.75548 5.58984 2.71281C6.17898 2.66468 6.91071 2.66496 7.83301 2.66496H12.167C13.0893 2.66496 13.821 2.66468 14.4102 2.71281C15.0069 2.76157 15.5157 2.86329 15.9814 3.10051L16.2568 3.25481C16.8833 3.63898 17.394 4.19012 17.7295 4.84856L17.8125 5.02531C17.9916 5.44285 18.0745 5.89771 18.1172 6.41985C18.1653 7.00898 18.165 7.74072 18.165 8.66301V11.3271ZM8.16406 15.995H12.167C13.1112 15.995 13.7794 15.9947 14.3018 15.9521C14.8164 15.91 15.1308 15.8299 15.3779 15.704L15.5615 15.6015C15.9797 15.3451 16.32 14.9774 16.5439 14.538L16.6299 14.3378C16.7074 14.121 16.7605 13.8478 16.792 13.4618C16.8347 12.9394 16.835 12.2712 16.835 11.3271V8.66301C16.835 7.71885 16.8347 7.05065 16.792 6.52824C16.7605 6.14232 16.7073 5.86904 16.6299 5.65227L16.5439 5.45207C16.32 5.01264 15.9796 4.64498 15.5615 4.3886L15.3779 4.28606C15.1308 4.16013 14.8165 4.08006 14.3018 4.03801C13.7794 3.99533 13.1112 3.99504 12.167 3.99504H8.16406C8.16407 3.99667 8.16504 3.99829 8.16504 3.99992L8.16406 15.995Z"></path>
            </svg>
          )}
        </div>
        <div className="p-3">
          <div className="space-y-2">
            {navItems.map((item) => (
              <div key={item.href}>
                {renderNavItem(item)}
              </div>
            ))}
            </div>
        </div>
      </div>

      {/* Sticky Header */}
      {/* <div className={`bg-custom-box border-b border-custom-border sticky top-0 z-20 ${sidebarExpanded ? 'ml-64' : 'ml-16'}`}>
        <div className="flex items-center justify-between px-6 py-3">
          <div className="flex items-center gap-4">
          </div>
          
          <div className="flex items-center gap-4">
            <VectorSearch />
          </div>
        </div>
      </div> */}

      {/* Main Content Area */}
      <div className={`p-6 bg-transparent ${sidebarExpanded ? 'ml-64' : 'ml-[4.4375rem]'} transition-[margin-left] duration-1200`} style={{ transitionTimingFunction: 'cubic-bezier(0.37, 0, 0.63, 1)' }}>
        <div className="max-w-7xl overflow-hidden rounded-lg mx-auto">
          <PageTransition>
            {children}
          </PageTransition>
        </div>
      </div>

      </div>
  );
}