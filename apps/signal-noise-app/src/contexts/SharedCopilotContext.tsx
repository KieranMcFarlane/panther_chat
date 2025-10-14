'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';

interface SharedCopilotContextType {
  // Shared state across all chat instances
  globalHistory: any[];
  setGlobalHistory: (history: any[]) => void;
  
  // Shared actions and tools
  sharedActions: any[];
  setSharedActions: (actions: any[]) => void;
  
  // Shared context
  sharedContext: any;
  setSharedContext: (context: any) => void;
  
  // Methods for interacting with shared CopilotKit
  executeSharedAction: (action: any) => Promise<any>;
  addToSharedHistory: (message: any) => void;
  clearSharedHistory: () => void;
}

const SharedCopilotContext = createContext<SharedCopilotContextType | null>(null);

interface SharedCopilotProviderProps {
  children: ReactNode;
}

export function SharedCopilotProvider({ children }: SharedCopilotProviderProps) {
  const [globalHistory, setGlobalHistory] = useState<any[]>([]);
  const [sharedActions, setSharedActions] = useState<any[]>([]);
  const [sharedContext, setSharedContext] = useState<any>({});

  const executeSharedAction = async (action: any) => {
    console.log('Executing shared action:', action);
    // Execute action using shared Claude Agent manager
    try {
      const result = await action.handler();
      return result;
    } catch (error) {
      console.error('Shared action execution failed:', error);
      throw error;
    }
  };

  const addToSharedHistory = (message: any) => {
    setGlobalHistory(prev => [...prev, message]);
    console.log('Added to shared history:', message, 'Total:', globalHistory.length + 1);
  };

  const clearSharedHistory = () => {
    setGlobalHistory([]);
    console.log('Cleared shared history');
  };

  const value: SharedCopilotContextType = {
    globalHistory,
    setGlobalHistory,
    sharedActions,
    setSharedActions,
    sharedContext,
    setSharedContext,
    executeSharedAction,
    addToSharedHistory,
    clearSharedHistory
  };

  return (
    <SharedCopilotContext.Provider value={value}>
      {children}
    </SharedCopilotContext.Provider>
  );
}

export function useSharedCopilot() {
  const context = useContext(SharedCopilotContext);
  if (!context) {
    throw new Error('useSharedCopilot must be used within a SharedCopilotProvider');
  }
  return context;
}