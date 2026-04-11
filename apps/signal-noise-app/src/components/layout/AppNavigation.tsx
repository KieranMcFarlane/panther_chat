'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Menu,
  ChevronDown,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import VectorSearch from '@/components/ui/VectorSearch-debounced';
import PageTransition from './PageTransition';
import { primaryNavItems } from './discovery-nav';
import { OperationalStatusStrip } from './OperationalStatusStrip';
import { OperationalDrawer } from './OperationalDrawer';

const navSections = [
  { key: 'client-path', label: '', items: primaryNavItems },
] as const

interface AppNavigationProps {
  children: React.ReactNode;
  authMenu?: React.ReactNode;
}

export default function AppNavigation({ children, authMenu }: AppNavigationProps) {
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const [openSubmenu, setOpenSubmenu] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [activeOpsSection, setActiveOpsSection] = useState<'running' | 'blocked' | 'completed' | 'entities'>('running');
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const pathname = usePathname();
  const router = useRouter();
  const isFullScreenAuthRoute = pathname === '/sign-in' || pathname === '/login';

  useEffect(() => {
    setPendingHref(null);
    setMobileNavOpen(false);
  }, [pathname]);

  if (isFullScreenAuthRoute) {
    return (
      <div className="relative z-10 min-h-screen">
        <PageTransition>
          {children}
        </PageTransition>
      </div>
    );
  }

  type NavItem = (typeof navSections)[number]['items'][number]

  const renderNavItem = (item: NavItem) => {
    const isOpen = openSubmenu === item.label;
    const isActive = pathname === item.href || (item.hasSubmenu && pathname.startsWith(item.href));
    const isPending = pendingHref === item.href;

    if (item.href === '/search') {
      return (
        <VectorSearch
          variant="navitem"
          compact={!sidebarExpanded}
          className={isActive ? 'bg-yellow-500 text-black font-body-medium' : ''}
        />
      );
    }

    const handleClick = (e: React.MouseEvent) => {
      if (item.hasSubmenu) {
        e.preventDefault();
        setOpenSubmenu(isOpen ? null : item.label);
      }
      setPendingHref(item.href);
    };

    const handlePrefetch = () => {
      if (item.href) {
        router.prefetch(item.href);
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
        {isPending ? (
          <Loader2 className="w-5 h-5 flex-shrink-0 animate-spin" />
        ) : (
          <item.icon className="w-5 h-5 flex-shrink-0" />
        )}
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

    if (!sidebarExpanded) {
      return (
        <Popover key={item.label} open={isOpen} onOpenChange={(open) => setOpenSubmenu(open ? item.label : null)}>
          <PopoverTrigger
            asChild
            onMouseEnter={() => setOpenSubmenu(item.label)}
            onMouseLeave={() => setOpenSubmenu(null)}
          >
            <Link href={item.hasSubmenu ? '#' : item.href} onClick={handleClick} onMouseEnter={handlePrefetch}>
              {linkContent}
            </Link>
          </PopoverTrigger>
          <PopoverContent
            side="right"
            className="w-auto p-2"
            sideOffset={8}
            onMouseEnter={() => setOpenSubmenu(item.label)}
            onMouseLeave={() => setOpenSubmenu(null)}
          >
            <p className="text-sm font-medium">{item.label}</p>
          </PopoverContent>
        </Popover>
      );
    }

    return (
      <div key={item.href} className="w-full">
        <Link href={item.href} onClick={handleClick} onMouseEnter={handlePrefetch}>
          {linkContent}
        </Link>
      </div>
    );
  };

  const renderSection = (section: typeof navSections[number]) => (
    <div key={section.key} className="space-y-2">
      {sidebarExpanded && section.key !== 'search' && section.label ? (
        <div className="px-3 pt-2 text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-slate-300">
          {section.label}
        </div>
      ) : null}
      <div className="space-y-2">
        {section.items.map((item) => (
          <div key={item.href}>
            {renderNavItem(item)}
          </div>
        ))}
      </div>
    </div>
  )

  const renderSidebarContent = (expanded: boolean) => (
    <div className="flex min-h-full flex-col p-4">
      <div className="mb-6 flex items-center justify-between">
        {expanded ? (
          <div className="flex items-center gap-3">
            <img src="/yp_logo.svg" alt="Yellow Panther Logo" className="h-10 w-10 object-contain" />
            <span className="text-white font-semibold">Reverse</span>
          </div>
        ) : (
          <div className="flex w-full justify-center">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarExpanded(!sidebarExpanded)}
              className="text-white hover:bg-custom-border"
              aria-label={sidebarExpanded ? 'Collapse navigation' : 'Expand navigation'}
            >
              <Menu className="h-5 w-5" />
            </Button>
          </div>
        )}
        {expanded ? (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarExpanded(!sidebarExpanded)}
            className="text-white hover:bg-custom-border"
            aria-label={sidebarExpanded ? 'Collapse navigation' : 'Expand navigation'}
          >
            <Menu className="h-5 w-5" />
          </Button>
        ) : null}
      </div>

      <div className="flex-1 space-y-6">
        {navSections.map((section) => renderSection(section))}
      </div>

      {expanded && authMenu ? (
        <div className="mt-6 border-t border-custom-border pt-4">{authMenu}</div>
      ) : null}
    </div>
  );

  return (
    <div className="relative z-10 h-screen overflow-hidden bg-custom-bg overflow-x-hidden">
      <div className="flex h-full items-stretch">
        <aside
          className={`${sidebarExpanded ? 'w-64' : 'w-20'} sticky top-0 hidden h-screen overflow-hidden border-r border-custom-border bg-custom-box/80 backdrop-blur-md relative z-50 flex-shrink-0 transition-all duration-300 lg:flex`}
        >
          {renderSidebarContent(sidebarExpanded)}
        </aside>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto">
          <div className="sticky top-0 z-40 border-b border-custom-border/70 bg-custom-bg/90 backdrop-blur supports-[backdrop-filter]:bg-custom-bg/75">
            <div className="flex items-center gap-3 px-3 py-3 sm:px-6 lg:px-8">
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden text-white hover:bg-custom-border"
                aria-label={mobileNavOpen ? 'Close navigation' : 'Open navigation'}
                onClick={() => setMobileNavOpen((current) => !current)}
              >
                <Menu className="h-5 w-5" />
              </Button>
              <div className="min-w-0 flex-1">
                <OperationalStatusStrip
                  drawerOpen={drawerOpen}
                  activeSection={activeOpsSection}
                  onToggleDrawer={() => setDrawerOpen((current) => !current)}
                />
              </div>
            </div>
            {drawerOpen ? (
              <div className="px-4 pb-6 sm:px-6 lg:px-8">
                <OperationalDrawer open={drawerOpen} activeSection={activeOpsSection} onSelectSection={setActiveOpsSection} />
              </div>
            ) : null}
          </div>
          <div className="min-h-0 min-w-0 flex-1">
            <PageTransition>{children}</PageTransition>
          </div>
        </div>
      </div>
      <Dialog open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <DialogContent className="left-0 top-0 h-full w-[min(18rem,calc(100vw-1rem))] max-w-none translate-x-0 translate-y-0 rounded-none border-r border-border/70 bg-custom-box p-0 text-white shadow-2xl sm:rounded-none">
          <DialogTitle className="sr-only">Navigation</DialogTitle>
          <div className="h-full overflow-y-auto">
            {renderSidebarContent(true)}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
