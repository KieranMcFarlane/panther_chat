'use client';

import React, { useEffect } from 'react';
import HistoryNav from './HistoryNav';
import ClubModal from './ClubModal';
import LeagueNav from './LeagueNav';
import Notifications from './Notifications';
import SearchBox from './SearchBox';
import MenuTabs from './MenuTabs';

export default function Header() {
  console.log('🔥 HEADER COMPONENT LOADING!', {
    isClient: typeof window !== 'undefined',
    isServer: typeof window === 'undefined',
    timestamp: new Date().toISOString()
  })
  
  // Track hydration
  useEffect(() => {
    console.log('🔥 HEADER COMPONENT HYDRATED ON CLIENT!', {
      url: window.location?.href,
      timestamp: new Date().toISOString()
    })
  }, [])
  
  return (
    <header className="liquid-glass border-b border-white/20">
      <div className="liquid-glass-effect" />
      <div className="liquid-glass-shine" />
      
      <div className="container mx-auto px-4 liquid-glass-content">
        <div className="flex items-center justify-between gap-4 py-4">
          {/* Left side: History navigation and club filters */}
          <div className="flex items-center gap-4">
            <HistoryNav />
            <LeagueNav />
          </div>

          {/* Right side: Search and notifications */}
          <div className="flex items-center gap-4">
            <Notifications />
            <SearchBox />
          </div>
        </div>

        {/* Bottom: Menu tabs */}
        <div className="flex items-center justify-center py-3 border-t border-white/10">
          <MenuTabs />
        </div>
      </div>
    </header>
  );
}