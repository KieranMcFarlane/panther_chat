'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  Home,
  Search,
  FileText,
  Brain,
  BarChart3,
  ChevronDown,
  ChevronRight,
  Network,
  Monitor,
  Eye,
  Menu,
  X,
  ArrowLeft
} from 'lucide-react';
import { 
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useNavigationPrefetch } from '@/lib/swr-config';

// Enhanced navigation items with graph submenu
const navItems = [
  { icon: Home, label: 'Home', href: '/' },
  { icon: Search, label: 'Entities', href: '/entity-browser' },
  { icon: FileText, label: 'Tenders', href: '/tenders' },
  { icon: Brain, label: 'RFP Intelligence', href: '/rfp-intelligence' },
  { 
    icon: BarChart3, 
    label: 'Graph', 
    href: '/graph',
    isCollapsible: true,
    subItems: [
      { icon: Network, label: '2D Network', href: '/graph', description: 'Interactive 2D force graph' },
      { icon: Monitor, label: 'VR Visualization', href: '/graph/vr', description: 'Immersive VR experience (coming soon)' },
      { icon: Eye, label: 'AR Visualization', href: '/graph/ar', description: 'Augmented reality overlay (coming soon)' },
    ]
  },
];

interface AppSidebarProps {
  className?: string;
}

export function AppSidebar({ className }: AppSidebarProps) {
  const pathname = usePathname();
  const [graphOpen, setGraphOpen] = useState(pathname?.startsWith('/graph') || false);
  const [isMobile, setIsMobile] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { prefetchPage } = useNavigationPrefetch();

  // Detect mobile screen size
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
      if (window.innerWidth >= 768) {
        setMobileOpen(false); // Close mobile menu when switching to desktop
      }
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return (
    <SidebarProvider>
      <Sidebar 
        variant={isMobile ? "floating" : "inset"} 
        collapsible={isMobile ? "none" : "icon"} 
        className={`
          ${className}
          ${isMobile ? `
            fixed left-0 top-0 h-full w-64 shadow-xl
            [&[data-state=open]]:translate-x-0
            [&[data-state=closed]]:translate-x-[-100%]
            transition-transform duration-300 ease-in-out
            z-50
          ` : ''}
        `}
        open={isMobile ? mobileOpen : undefined}
        onOpenChange={(open) => {
          if (isMobile) {
            setMobileOpen(open);
          }
        }}
      >
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" asChild>
                <Link href="/">
                  <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                    <img 
                      src="/yp_logo.svg" 
                      alt="Yellow Panther Logo" 
                      className="size-6" 
                    />
                  </div>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">Signal Noise</span>
                    <span className="truncate text-xs">Sports Intelligence</span>
                  </div>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
        
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Platform</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {navItems.map((item) => {
                  const isActive = pathname === item.href;
                  
                  if (item.isCollapsible && item.subItems) {
                    return (
                      <Collapsible
                        key={item.href}
                        open={graphOpen}
                        onOpenChange={setGraphOpen}
                        className="group/collapsible"
                      >
                        <SidebarMenuItem>
                          <CollapsibleTrigger asChild>
                            <SidebarMenuButton tooltip={item.label} isActive={pathname?.startsWith(item.href)}>
                              {item.icon && <item.icon />}
                              <span>{item.label}</span>
                              <ChevronDown className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-180" size={16} />
                            </SidebarMenuButton>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <SidebarMenuSub>
                              {item.subItems.map((subItem) => {
                                const isSubActive = pathname === subItem.href;
                                return (
                                  <SidebarMenuSubItem key={subItem.href}>
                                    <SidebarMenuSubButton 
                                      asChild={true}
                                      isActive={isSubActive}
                                    >
                                      <Link href={subItem.href}>
                                        {subItem.icon && <subItem.icon />}
                                        <span>{subItem.label}</span>
                                      </Link>
                                    </SidebarMenuSubButton>
                                  </SidebarMenuSubItem>
                                );
                              })}
                            </SidebarMenuSub>
                          </CollapsibleContent>
                        </SidebarMenuItem>
                      </Collapsible>
                    );
                  }

                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton 
                        asChild={true}
                        tooltip={item.label}
                        isActive={isActive}
                        onMouseEnter={() => prefetchPage(item.href)}
                      >
                        <Link href={item.href}>
                          {item.icon && <item.icon />}
                          <span>{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">Yellow Panther</span>
                  <span className="truncate text-xs">v2.0.1</span>
                </div>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>
    </SidebarProvider>
  );
}

// Mobile hamburger trigger component
function MobileHamburgerTrigger() {
  const [isMobile, setIsMobile] = useState(false);
  const sidebar = useSidebar();

  // Detect mobile screen size
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (!mobile) {
        sidebar.setOpen(false);
      }
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, [sidebar]);

  const handleClick = () => {
    sidebar.setOpen(!sidebar.open);
  };

  // Only show on mobile devices
  if (!isMobile) return null;

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleClick}
      className="fixed top-4 left-4 z-50 md:hidden bg-custom-box border-custom-border text-white hover:bg-custom-border h-10 w-10 p-0"
      aria-label={sidebar.open ? "Close menu" : "Open menu"}
    >
      <div className="relative w-5 h-5">
        {/* Hamburger to X transition */}
        <span 
          className={`
            absolute inset-0 flex items-center justify-center transition-all duration-300 ease-in-out
            ${sidebar.open ? 'opacity-0 rotate-90 scale-0' : 'opacity-100 rotate-0 scale-100'}
          `}
        >
          <Menu className="w-5 h-5" />
        </span>
        <span 
          className={`
            absolute inset-0 flex items-center justify-center transition-all duration-300 ease-in-out
            ${sidebar.open ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 -rotate-90 scale-0'}
          `}
        >
          <X className="w-5 h-5" />
        </span>
      </div>
    </Button>
  );
}

export function SidebarLayout({ children }: { children: React.ReactNode }) {
  const [isMobile, setIsMobile] = useState(false);
  const sidebar = useSidebar();

  // Detect mobile screen size
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (!mobile) {
        sidebar.setOpen(false);
      }
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, [sidebar]);

  // Close sidebar when clicking outside on mobile
  useEffect(() => {
    if (!isMobile) return;

    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as Element;
      if (sidebar.open && !target.closest('[data-sidebar]')) {
        sidebar.setOpen(false);
      }
    };

    if (sidebar.open) {
      document.addEventListener('mousedown', handleOutsideClick);
    }

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isMobile, sidebar.open, sidebar]);

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        {/* Mobile Header */}
        {isMobile && (
          <header className="flex h-16 shrink-0 items-center gap-2 border-b border-custom-border md:hidden">
            <div className="flex items-center gap-2 px-4">
              <SidebarTrigger className="-ml-1" />
              <div className="flex items-center gap-2">
                <img 
                  src="/yp_logo.svg" 
                  alt="Yellow Panther Logo" 
                  className="w-8 h-8" 
                />
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-white">Signal Noise</span>
                  <span className="text-xs text-fm-light-grey">Sports Intelligence</span>
                </div>
              </div>
            </div>
          </header>
        )}
        
        {/* Desktop Header */}
        <header className="hidden md:flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            {/* Additional header content can go here */}
          </div>
        </header>
        
        {/* Mobile Overlay */}
        {isMobile && sidebar.open && (
          <div 
            className="fixed inset-0 bg-black/50 z-40 md:hidden"
            onClick={() => sidebar.setOpen(false)}
          />
        )}
        
        {/* Main Content */}
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
          {children}
        </div>
        
        {/* Mobile Hamburger Trigger */}
        <MobileHamburgerTrigger />
      </SidebarInset>
    </SidebarProvider>
  );
}

// Custom hook for sidebar usage
export function useAppSidebar() {
  return useSidebar();
}