'use client';

import React, { createContext, useContext, useReducer, useCallback, useEffect, ReactNode } from 'react';
import { 
  ChatTab, 
  TabState, 
  TabAction, 
  Message, 
  TabType, 
  DEFAULT_TAB_TEMPLATES,
  TAB_TYPE_CONFIGS 
} from '@/types/tab-system';
import { useUser } from '@/contexts/UserContext';

const initialState: TabState = {
  tabs: [],
  activeTabId: null,
  isLoading: false,
  error: null,
  searchQuery: '',
  filterType: 'all',
  viewMode: 'tabs'
};

function tabReducer(state: TabState, action: TabAction): TabState {
  switch (action.type) {
    case 'CREATE_TAB':
      return {
        ...state,
        tabs: [...state.tabs, action.payload],
        activeTabId: action.payload.id
      };

    case 'UPDATE_TAB':
      return {
        ...state,
        tabs: state.tabs.map(tab => 
          tab.id === action.payload.tabId 
            ? { ...tab, ...action.payload.updates, updatedAt: new Date() }
            : tab
        )
      };

    case 'DELETE_TAB':
      const newTabs = state.tabs.filter(tab => tab.id !== action.payload.tabId);
      const newActiveTabId = state.activeTabId === action.payload.tabId 
        ? (newTabs.length > 0 ? newTabs[0].id : null)
        : state.activeTabId;
      
      return {
        ...state,
        tabs: newTabs,
        activeTabId: newActiveTabId
      };

    case 'SET_ACTIVE_TAB':
      return {
        ...state,
        activeTabId: action.payload.tabId
      };

    case 'ADD_MESSAGE':
      return {
        ...state,
        tabs: state.tabs.map(tab => 
          tab.id === action.payload.tabId 
            ? { 
                ...tab, 
                messages: [...tab.messages, action.payload.message],
                metadata: {
                  ...tab.metadata,
                  messageCount: tab.metadata.messageCount + 1,
                  updatedAt: new Date()
                },
                updatedAt: new Date()
              }
            : tab
        )
      };

    case 'UPDATE_MESSAGES':
      return {
        ...state,
        tabs: state.tabs.map(tab => 
          tab.id === action.payload.tabId 
            ? { 
                ...tab, 
                messages: action.payload.messages,
                metadata: {
                  ...tab.metadata,
                  messageCount: action.payload.messages.length,
                  updatedAt: new Date()
                },
                updatedAt: new Date()
              }
            : tab
        )
      };

    case 'SET_LOADING':
      return {
        ...state,
        isLoading: action.payload.isLoading
      };

    case 'SET_ERROR':
      return {
        ...state,
        error: action.payload.error
      };

    case 'SET_SEARCH_QUERY':
      return {
        ...state,
        searchQuery: action.payload.query
      };

    case 'SET_FILTER_TYPE':
      return {
        ...state,
        filterType: action.payload.filterType
      };

    case 'SET_VIEW_MODE':
      return {
        ...state,
        viewMode: action.payload.viewMode
      };

    case 'REORDER_TABS':
      return {
        ...state,
        tabs: action.payload.tabs
      };

    default:
      return state;
  }
}

interface TabContextType {
  state: TabState;
  actions: {
    createTab: (type: TabType, name?: string) => Promise<string>;
    updateTab: (tabId: string, updates: Partial<ChatTab>) => Promise<void>;
    deleteTab: (tabId: string) => Promise<void>;
    setActiveTab: (tabId: string) => void;
    addMessage: (tabId: string, message: Message) => Promise<void>;
    updateMessages: (tabId: string, messages: Message[]) => void;
    duplicateTab: (tabId: string) => Promise<string>;
    pinTab: (tabId: string, pinned: boolean) => Promise<void>;
    setSearchQuery: (query: string) => void;
    setFilterType: (filterType: TabType | 'all') => void;
    setViewMode: (viewMode: 'tabs' | 'history' | 'search') => void;
    reorderTabs: (tabs: ChatTab[]) => void;
    clearError: () => void;
  };
  helpers: {
    activeTab: ChatTab | null;
    getTabById: (tabId: string) => ChatTab | null;
    getFilteredTabs: () => ChatTab[];
    canUserEditTab: (tabId: string) => boolean;
    canUserDeleteTab: (tabId: string) => boolean;
    canUserShareTab: (tabId: string) => boolean;
  };
}

const TabContext = createContext<TabContextType | undefined>(undefined);

interface TabProviderProps {
  children: ReactNode;
}

export function TabProvider({ children }: TabProviderProps) {
  const [state, dispatch] = useReducer(tabReducer, initialState);
  const { userId, ensureUserId } = useUser();

  // Load tabs from localStorage on mount
  useEffect(() => {
    if (userId) {
      loadTabsFromStorage();
    }
  }, [userId]);

  // Save tabs to localStorage whenever they change
  useEffect(() => {
    if (userId && state.tabs.length > 0) {
      saveTabsToStorage();
    }
  }, [state.tabs, userId]);

  const loadTabsFromStorage = useCallback(() => {
    try {
      const stored = localStorage.getItem(`tabs_${userId}`);
      if (stored) {
        const tabs = JSON.parse(stored);
        // Convert dates back to Date objects
        tabs.forEach((tab: ChatTab) => {
          tab.createdAt = new Date(tab.createdAt);
          tab.updatedAt = new Date(tab.updatedAt);
          tab.messages.forEach((msg: Message) => {
            msg.timestamp = new Date(msg.timestamp);
          });
        });
        
        dispatch({ type: 'REORDER_TABS', payload: { tabs } });
        
        // Set active tab to first tab if none active
        if (tabs.length > 0 && !state.activeTabId) {
          dispatch({ type: 'SET_ACTIVE_TAB', payload: { tabId: tabs[0].id } });
        }
      }
    } catch (error) {
      console.error('Error loading tabs from storage:', error);
    }
  }, [userId, state.activeTabId]);

  const saveTabsToStorage = useCallback(() => {
    try {
      localStorage.setItem(`tabs_${userId}`, JSON.stringify(state.tabs));
    } catch (error) {
      console.error('Error saving tabs to storage:', error);
    }
  }, [state.tabs, userId]);

  const createTab = useCallback(async (type: TabType, name?: string): Promise<string> => {
    const currentUserId = ensureUserId();
    const tabId = `tab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const template = DEFAULT_TAB_TEMPLATES[name === 'Quick Chat' ? 'quickChat' : 
                                           name === 'RFP Analysis' ? 'rfpAnalysis' :
                                           name === 'Sports Research' ? 'sportsResearch' :
                                           name === 'Graph Exploration' ? 'graphExploration' :
                                           'quickChat'];
    
    const newTab: ChatTab = {
      id: tabId,
      ownerId: currentUserId,
      name: name || `${TAB_TYPE_CONFIGS[type].name} ${new Date().toLocaleTimeString()}`,
      type,
      color: TAB_TYPE_CONFIGS[type].color,
      isPinned: false,
      isShared: false,
      sharedWith: [],
      messages: [],
      context: {
        userId: currentUserId,
        sessionId: `session_${Date.now()}`,
        role: 'user',
        permissions: [],
        activeSession: {
          token: 'temp_token',
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
        }
      },
      acl: {
        owner: currentUserId,
        viewers: [],
        editors: [],
        isPublic: false,
        organizationLevel: false,
        permissions: {
          canView: true,
          canEdit: true,
          canShare: true,
          canDelete: true,
          canExport: true
        }
      },
      claudeConfig: template.claudeConfig,
      metadata: {
        title: name || `${TAB_TYPE_CONFIGS[type].name} Chat`,
        summary: '',
        messageCount: 0,
        tokenUsage: 0,
        toolsUsed: [],
        entitiesMentioned: [],
        category: type,
        tags: [],
        isFavorite: false,
        isArchived: false
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };

    dispatch({ type: 'CREATE_TAB', payload: newTab });
    return tabId;
  }, [ensureUserId]);

  const updateTab = useCallback(async (tabId: string, updates: Partial<ChatTab>) => {
    dispatch({ type: 'UPDATE_TAB', payload: { tabId, updates } });
  }, []);

  const deleteTab = useCallback(async (tabId: string) => {
    const tab = state.tabs.find(t => t.id === tabId);
    if (tab && canUserDeleteTab(tabId)) {
      dispatch({ type: 'DELETE_TAB', payload: { tabId } });
    }
  }, [state.tabs]);

  const setActiveTab = useCallback((tabId: string) => {
    dispatch({ type: 'SET_ACTIVE_TAB', payload: { tabId } });
  }, []);

  const addMessage = useCallback(async (tabId: string, message: Message) => {
    dispatch({ type: 'ADD_MESSAGE', payload: { tabId, message } });
  }, []);

  const updateMessages = useCallback((tabId: string, messages: Message[]) => {
    dispatch({ type: 'UPDATE_MESSAGES', payload: { tabId, messages } });
  }, []);

  const duplicateTab = useCallback(async (tabId: string): Promise<string> => {
    const originalTab = state.tabs.find(t => t.id === tabId);
    if (!originalTab) throw new Error('Tab not found');
    
    const newTabId = await createTab(originalTab.type, `${originalTab.name} (Copy)`);
    await updateTab(newTabId, {
      messages: [...originalTab.messages],
      claudeConfig: { ...originalTab.claudeConfig }
    });
    
    return newTabId;
  }, [state.tabs, createTab, updateTab]);

  const pinTab = useCallback(async (tabId: string, pinned: boolean) => {
    await updateTab(tabId, { isPinned: pinned });
  }, [updateTab]);

  const setSearchQuery = useCallback((query: string) => {
    dispatch({ type: 'SET_SEARCH_QUERY', payload: { query } });
  }, []);

  const setFilterType = useCallback((filterType: TabType | 'all') => {
    dispatch({ type: 'SET_FILTER_TYPE', payload: { filterType } });
  }, []);

  const setViewMode = useCallback((viewMode: 'tabs' | 'history' | 'search') => {
    dispatch({ type: 'SET_VIEW_MODE', payload: { viewMode } });
  }, []);

  const reorderTabs = useCallback((tabs: ChatTab[]) => {
    dispatch({ type: 'REORDER_TABS', payload: { tabs } });
  }, []);

  const clearError = useCallback(() => {
    dispatch({ type: 'SET_ERROR', payload: { error: null } });
  }, []);

  // Helper functions
  const activeTab = state.tabs.find(tab => tab.id === state.activeTabId) || null;

  const getTabById = useCallback((tabId: string): ChatTab | null => {
    return state.tabs.find(tab => tab.id === tabId) || null;
  }, [state.tabs]);

  const getFilteredTabs = useCallback((): ChatTab[] => {
    let filtered = [...state.tabs];
    
    // Filter by type
    if (state.filterType !== 'all') {
      filtered = filtered.filter(tab => tab.type === state.filterType);
    }
    
    // Filter by search query
    if (state.searchQuery) {
      const query = state.searchQuery.toLowerCase();
      filtered = filtered.filter(tab => 
        tab.name.toLowerCase().includes(query) ||
        tab.messages.some(msg => msg.content.toLowerCase().includes(query))
      );
    }
    
    // Sort: pinned tabs first, then by last updated
    return filtered.sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return b.updatedAt.getTime() - a.updatedAt.getTime();
    });
  }, [state.tabs, state.filterType, state.searchQuery]);

  const canUserEditTab = useCallback((tabId: string): boolean => {
    const tab = getTabById(tabId);
    if (!tab) return false;
    return tab.acl.permissions.canEdit || tab.ownerId === userId;
  }, [getTabById, userId]);

  const canUserDeleteTab = useCallback((tabId: string): boolean => {
    const tab = getTabById(tabId);
    if (!tab) return false;
    return tab.acl.permissions.canDelete || tab.ownerId === userId;
  }, [getTabById, userId]);

  const canUserShareTab = useCallback((tabId: string): boolean => {
    const tab = getTabById(tabId);
    if (!tab) return false;
    return tab.acl.permissions.canShare || tab.ownerId === userId;
  }, [getTabById, userId]);

  const value: TabContextType = {
    state,
    actions: {
      createTab,
      updateTab,
      deleteTab,
      setActiveTab,
      addMessage,
      updateMessages,
      duplicateTab,
      pinTab,
      setSearchQuery,
      setFilterType,
      setViewMode,
      reorderTabs,
      clearError
    },
    helpers: {
      activeTab,
      getTabById,
      getFilteredTabs,
      canUserEditTab,
      canUserDeleteTab,
      canUserShareTab
    }
  };

  return (
    <TabContext.Provider value={value}>
      {children}
    </TabContext.Provider>
  );
}

export function useTabs() {
  const context = useContext(TabContext);
  if (context === undefined) {
    throw new Error('useTabs must be used within a TabProvider');
  }
  return context;
}