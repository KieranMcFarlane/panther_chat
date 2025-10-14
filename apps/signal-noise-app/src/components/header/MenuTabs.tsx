'use client';

import { useCallback, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

const menuTabs = [
  { id: 'matches', label: 'Matches', href: '/matches' },
  { id: 'standings', label: 'Standings', href: '/standings' },
  { id: 'players', label: 'Players', href: '/players' },
  { id: 'transfers', label: 'Transfers', href: '/transfers' },
  { id: 'news', label: 'News', href: '/news' },
];

export default function MenuTabs() {
  const router = useRouter();
  const pathname = usePathname();

  const tabByHref = useMemo(() => {
    const map: Record<string, string> = {};
    for (const t of menuTabs) map[t.href] = t.id;
    return map;
  }, []);

  const hrefByTab = useMemo(() => {
    const map: Record<string, string> = {};
    for (const t of menuTabs) map[t.id] = t.href;
    return map;
  }, []);

  const initialValue = useMemo(() => {
    return tabByHref[pathname] ?? 'matches';
  }, [pathname, tabByHref]);

  const [value, setValue] = useState<string>(initialValue);

  const handleValueChange = useCallback((next: string) => {
    setValue(next);
    const href = hrefByTab[next];
    if (href && href !== pathname) {
      router.push(href);
    }
  }, [hrefByTab, pathname, router]);

  return (
    <Tabs
      value={value}
      onValueChange={handleValueChange}
      className="w-full"
    >
      <TabsList className="grid w-full grid-cols-5 bg-header-bg p-1 h-auto text-white/80">
        {menuTabs.map((tab) => (
          <TabsTrigger
            key={tab.id}
            value={tab.id}
            // Keep the same look as the original buttons
            className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 data-[state=active]:bg-white data-[state=active]:text-gray-900 data-[state=active]:shadow-sm hover:text-white hover:bg-white/10"
          >
            <span>{tab.label}</span>
          </TabsTrigger>
        ))}
      </TabsList>
      {/**
       * We intentionally do not render TabsContent here because the header's
       * tabs are used for navigation between pages. The accessible tablist
       * behavior is preserved while routing on selection.
       */}
    </Tabs>
  );
}