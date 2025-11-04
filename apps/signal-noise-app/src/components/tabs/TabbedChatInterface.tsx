'use client';

import React from 'react';
import { useTabs } from '@/contexts/TabContext';
import TabBar from './TabBar';
import TabHistory from './TabHistory';
import TabChatInstance from './TabChatInstance';
import { LoadingSpinner, EmptyState } from '@/components/ui/LoadingComponents';

interface TabbedChatInterfaceProps {
  className?: string;
}

export default function TabbedChatInterface({ className = '' }: TabbedChatInterfaceProps) {
  const { state, helpers } = useTabs();

  const renderContent = () => {
    // Show loading state
    if (state.isLoading) {
      return (
        <div className="flex items-center justify-center h-full">
          <LoadingSpinner size="lg" />
        </div>
      );
    }

    // Show error state
    if (state.error) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="text-center text-red-400">
            <p>Error: {state.error}</p>
            <button 
              onClick={() => window.location.reload()}
              className="mt-2 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
            >
              Reload
            </button>
          </div>
        </div>
      );
    }

    // Show history view
    if (state.viewMode === 'history') {
      return <TabHistory />;
    }

    // Show tabs view
    if (state.viewMode === 'tabs') {
      // If no tabs exist, show empty state
      if (state.tabs.length === 0) {
        return (
          <EmptyState
            icon="💬"
            title="No tabs yet"
            description="Create your first chat tab to get started with AI-powered conversations"
            action={{
              label: "Create General Chat",
              onClick: () => helpers.activeTab ? null : state.tabs.length === 0
            }}
          />
        );
      }

      // If no active tab, show empty state
      if (!state.activeTabId) {
        return (
          <EmptyState
            icon="👆"
            title="Select a tab"
            description="Choose a tab from the toolbar above to start chatting"
          />
        );
      }

      // Show the active tab's chat instance
      return (
        <TabChatInstance 
          tabId={state.activeTabId}
          className="h-full"
        />
      );
    }

    // Default empty state for search view
    return (
      <EmptyState
        icon="🔍"
        title="Search Results"
        description="Your search results will appear here"
      />
    );
  };

  return (
    <div className={`flex flex-col h-full bg-custom-bg ${className}`}>
      {/* Tab Bar */}
      <TabBar />
      
      {/* Content Area */}
      <div className="flex-1 overflow-hidden">
        {renderContent()}
      </div>

      {/* Status Bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-custom-box border-t border-custom-border text-xs text-gray-400">
        <div className="flex items-center gap-4">
          <span>
            {state.tabs.length} {state.tabs.length === 1 ? 'tab' : 'tabs'}
          </span>
          {state.activeTabId && (
            <span>
              Active: {helpers.getTabById(state.activeTabId)?.name || 'Unknown'}
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-4">
          {state.searchQuery && (
            <span>Search: "{state.searchQuery}"</span>
          )}
          {state.filterType !== 'all' && (
            <span>Filter: {state.filterType}</span>
          )}
          <span>
            View: {state.viewMode}
          </span>
        </div>
      </div>
    </div>
  );
}