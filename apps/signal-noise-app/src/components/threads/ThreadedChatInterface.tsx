'use client';

import React from 'react';
import { useThreads } from '@/contexts/ThreadContext';
import ThreadBar from './ThreadBar';
import ThreadChatInstance from './ThreadChatInstance';
import TeamsStoreView from './TeamsStoreView';
import NotificationCenter from './NotificationCenter';
import { LoadingSpinner, EmptyState } from '@/components/ui/LoadingComponents';

interface ThreadedChatInterfaceProps {
  className?: string;
}

export default function ThreadedChatInterface({ className = '' }: ThreadedChatInterfaceProps) {
  const { state, helpers } = useThreads();

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

    // Show Teams Store view
    if (state.viewMode === 'teams-store') {
      return <TeamsStoreView />;
    }

    // Show notifications view
    if (state.viewMode === 'notifications') {
      return <NotificationCenter />;
    }

    // Show threads view
    if (state.viewMode === 'threads') {
      // If no threads exist, show empty state
      if (state.threads.length === 0) {
        return (
          <EmptyState
            icon="🧵"
            title="No conversation threads yet"
            description="Create your first thread to start parallel AI conversations with shared memory"
            action={{
              label: "Create Quick Research Thread",
              onClick: () => state.actions?.createThread?.('quick_research')
            }}
          />
        );
      }

      // If no active thread, show empty state
      if (!state.activeThreadId) {
        return (
          <EmptyState
            icon="👆"
            title="Select a thread"
            description="Choose a thread from the toolbar above to start chatting"
          />
        );
      }

      // Show the active thread's chat instance
      return (
        <ThreadChatInstance 
          threadId={state.activeThreadId}
          className="h-full"
        />
      );
    }

    // Default empty state
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
      {/* Thread Bar */}
      <ThreadBar />
      
      {/* Content Area */}
      <div className="flex-1 overflow-hidden">
        {renderContent()}
      </div>

      {/* Status Bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-custom-box border-t border-custom-border text-xs text-gray-400">
        <div className="flex items-center gap-4">
          <span>
            {state.threads.length} {state.threads.length === 1 ? 'thread' : 'threads'}
          </span>
          {state.activeThreadId && (
            <span>
              Active: {helpers.getThreadById(state.activeThreadId)?.name || 'Unknown'}
            </span>
          )}
          {state.activeThreadId && helpers.isThreadProcessing(state.activeThreadId) && (
            <span className="text-yellow-400 flex items-center gap-1">
              <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></div>
              Processing
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-4">
          {state.filters.status && (
            <span>Filter: {state.filters.status}</span>
          )}
          {state.filters.tags && state.filters.tags.length > 0 && (
            <span>Tags: {state.filters.tags.join(', ')}</span>
          )}
          <span>
            View: {state.viewMode}
          </span>
          <span>
            Better Auth MCP: {state.teamsStore ? 'Connected' : 'Disconnected'}
          </span>
        </div>
      </div>
    </div>
  );
}