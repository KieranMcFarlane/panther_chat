'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import PrefetchLink from '@/components/ui/PrefetchLink';

const menuTabs = [
  { id: 'matches', label: 'Matches', href: '/matches', icon: 'calendar' },
  { id: 'standings', label: 'Standings', href: '/standings', icon: 'bar-chart' },
  { id: 'players', label: 'Players', href: '/players', icon: 'users' },
  { id: 'transfers', label: 'Transfers', href: '/transfers', icon: 'shuffle' },
  { id: 'news', label: 'News', href: '/news', icon: 'newspaper' },
];

export default function MenuTabs() {
  const pathname = usePathname();
  const [activeTab, setActiveTab] = useState(() => {
    const currentTab = menuTabs.find(tab => pathname === tab.href);
    return currentTab ? currentTab.id : 'matches';
  });

  const getTabIcon = (iconName: string) => {
    switch (iconName) {
      case 'calendar':
        return (
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
        );
      case 'bar-chart':
        return (
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="12" y1="20" x2="12" y2="10" />
            <line x1="18" y1="20" x2="18" y2="4" />
            <line x1="6" y1="20" x2="6" y2="16" />
          </svg>
        );
      case 'users':
        return (
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="m22 21-3-3 3-3" />
            <path d="M16 11h4" />
          </svg>
        );
      case 'shuffle':
        return (
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M2 18h3l2-2-7-7 7-7V2l9 9-9 9z" />
            <path d="M22 6h-3l-2 2 7 7-7 7v-3L8 12l9-9z" />
          </svg>
        );
      case 'newspaper':
        return (
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2" />
            <path d="M18 14h-8" />
            <path d="M15 18h-5" />
            <path d="M10 6h8v4h-8Z" />
          </svg>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex items-center gap-1 bg-white/5 rounded-lg p-1">
      {menuTabs.map((tab) => {
        const isActive = activeTab === tab.id;
        const isCurrentPage = pathname === tab.href;

        return (
          <PrefetchLink 
            key={tab.id} 
            href={tab.href}
            prefetchApi={tab.href.includes('/entity/') ? [`/api/entities/${tab.href.split('/').pop()}`] : []}
          >
            <button
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                isActive || isCurrentPage
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-white/80 hover:text-white hover:bg-white/10'
              }`}
            >
              {getTabIcon(tab.icon)}
              <span>{tab.label}</span>
            </button>
          </PrefetchLink>
        );
      })}
    </div>
  );
}