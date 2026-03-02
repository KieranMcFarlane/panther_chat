'use client';

import React, { useEffect } from 'react';
import HistoryNav from './HistoryNav';
import LeagueNavSimple from './LeagueNavSimple';
import Notifications from './Notifications';
import SearchBox from './SearchBox';

interface HeaderProps {
  currentEntity?: any | null;
}

export default function Header({ currentEntity = null }: HeaderProps) {
  // Track hydration without time to avoid hydration mismatches
  useEffect(() => {
    console.log('🔥 HEADER COMPONENT HYDRATED ON CLIENT!')
  }, [])
  
  return (
    <header className="liquid-glass">
      <div className="liquid-glass-effect" />
      <div className="liquid-glass-shine" />
      
      <div className="container mx-auto liquid-glass-content">
        <div className="flex items-center justify-between gap-4 py-4 px-4">
          {/* Left side: History navigation and club filters */}
          <div className="flex items-center gap-4">
            <HistoryNav />
            <LeagueNavSimple currentEntity={currentEntity} />
          </div>

          {/* Right side: Search and notifications */}
          <div className="flex items-center gap-4">
            <Notifications />
            <SearchBox />
          </div>
        </div>

      </div>
    </header>
  );
}
