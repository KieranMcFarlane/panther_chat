'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Menu,
  ChevronDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import PageTransition from './PageTransition';
import { primaryNavItems } from './discovery-nav';
import { OperationalStatusStrip } from './OperationalStatusStrip';
import { OperationalDrawer } from './OperationalDrawer';

const navSections = [
  { key: 'client-path', label: 'Client Path', items: primaryNavItems },
] as const

interface AppNavigationProps {
  children: React.ReactNode;
  authMenu?: React.ReactNode;
}

export default function AppNavigation({ children, authMenu }: AppNavigationProps) {
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const [openSubmenu, setOpenSubmenu] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const pathname = usePathname();
  const isDossierRoute = pathname?.includes('/dossier') ?? false;
  const isEntityBrowserRoute = pathname?.startsWith('/entity-browser') ?? false;
  const isFullScreenAuthRoute = pathname === '/sign-in' || pathname === '/login';

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

    const handleClick = (e: React.MouseEvent) => {
      if (item.hasSubmenu) {
        e.preventDefault();
        setOpenSubmenu(isOpen ? null : item.label);
      }
      if (item.isSearch) {
        e.preventDefault();
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

    if (item.isSearch) {
      if (!sidebarExpanded) {
        return (
          <Popover key={item.label} open={isOpen} onOpenChange={(open) => setOpenSubmenu(open ? item.label : null)}>
            <PopoverTrigger
              asChild
              onMouseEnter={() => setOpenSubmenu(item.label)}
              onMouseLeave={() => setOpenSubmenu(null)}
            >
              <div className="cursor-pointer">
                <VectorSearchDebounced variant="navitem" className="w-full justify-center" />
              </div>
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
          <VectorSearchDebounced variant="navitem" className="w-full" />
        </div>
      );
    }

    if (!sidebarExpanded) {
      return (
        <Popover key={item.label} open={isOpen} onOpenChange={(open) => setOpenSubmenu(open ? item.label : null)}>
          <PopoverTrigger
            asChild
            onMouseEnter={() => setOpenSubmenu(item.label)}
            onMouseLeave={() => setOpenSubmenu(null)}
          >
            <Link href={item.hasSubmenu ? '#' : item.href}>
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
        <Link href={item.href} onClick={handleClick}>
          {linkContent}
        </Link>
      </div>
    );
  };

  const renderSection = (section: typeof navSections[number]) => (
    <div key={section.key} className="space-y-2">
      {sidebarExpanded && section.key !== 'search' && (
        <div className="px-3 pt-2 text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-slate-500">
          {section.label}
        </div>
      )}
      <div className="space-y-2">
        {section.items.map((item) => (
          <div key={item.href}>
            {renderNavItem(item)}
          </div>
        ))}
      </div>
    </div>
  )

  return (
    <div className="relative z-10 min-h-screen bg-custom-bg overflow-x-hidden">
      <div className="flex">
        {!isDossierRoute && !isEntityBrowserRoute && (
          <aside
            className={`${sidebarExpanded ? 'w-64' : 'w-20'} transition-all duration-300 border-r border-custom-border min-h-screen bg-custom-box/80 backdrop-blur-md relative z-50 flex-shrink-0`}
          >
            <div className="p-4">
              <div className="flex items-center justify-between mb-6">
                {sidebarExpanded ? (
                  <div className="flex items-center gap-3">
                    <img src="/yellow-panther-logo.png" alt="Yellow Panther Logo" className="h-10 w-10 object-contain" />
                    <span className="text-white font-semibold">Reverse</span>
                  </div>
                ) : (
                  <div className="flex justify-center w-full">
                    <img src="/yellow-panther-logo.png" alt="Yellow Panther Logo" className="h-10 w-10 object-contain" />
                  </div>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSidebarExpanded(!sidebarExpanded)}
                  className="text-white hover:bg-custom-border"
                >
                  <Menu className="h-5 w-5" />
                </Button>
              </div>

              <div className="space-y-6">
                {navSections.map((section) => renderSection(section))}
              </div>
            </div>
          </aside>
        )}

        <div className="flex-1 min-w-0">
          <OperationalStatusStrip onOpenDetails={() => setDrawerOpen(true)} />
          <PageTransition>{children}</PageTransition>
        </div>
      </div>
      <OperationalDrawer open={drawerOpen} onOpenChange={setDrawerOpen} authMenu={authMenu} />
    </div>
  );
}
