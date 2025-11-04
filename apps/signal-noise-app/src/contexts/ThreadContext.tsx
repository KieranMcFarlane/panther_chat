'use client';

import React, { createContext, useContext, useReducer, useCallback, useEffect, ReactNode } from 'react';
import { 
  ConversationThread, 
  ThreadState, 
  ThreadAction, 
  ThreadStatus,
  Message,
  ThreadExecution,
  ThreadNotification,
  THREAD_TEMPLATES,
  ThreadTemplate
} from '@/types/thread-system';
import { useUser } from '@/contexts/UserContext';
import teamsStoreService from '@/services/TeamsStoreService';

const initialState: ThreadState = {
  threads: [],
  activeThreadId: null,
  teamsStore: teamsStoreService.getStore(),
  executions: {},
  notifications: [],
  isLoading: false,
  error: null,
  filters: {
    status: undefined,
    userId: undefined,
    tags: [],
    dateRange: undefined
  },
  viewMode: 'threads'
};

function threadReducer(state: ThreadState, action: ThreadAction): ThreadState {
  switch (action.type) {
    case 'CREATE_THREAD':
      return {
        ...state,
        threads: [...state.threads, action.payload],
        activeThreadId: action.payload.id
      };

    case 'UPDATE_THREAD':
      return {
        ...state,
        threads: state.threads.map(thread => 
          thread.id === action.payload.threadId 
            ? { ...thread, ...action.payload.updates, updatedAt: new Date() }
            : thread
        )
      };

    case 'DELETE_THREAD':
      const newThreads = state.threads.filter(thread => thread.id !== action.payload.threadId);
      const newActiveThreadId = state.activeThreadId === action.payload.threadId 
        ? (newThreads.length > 0 ? newThreads[0].id : null)
        : state.activeThreadId;
      
      return {
        ...state,
        threads: newThreads,
        activeThreadId: newActiveThreadId,
        executions: Object.fromEntries(
          Object.entries(state.executions).filter(([threadId]) => threadId !== action.payload.threadId)
        )
      };

    case 'SET_ACTIVE_THREAD':
      // Mark thread as read when activated
      const updatedThreads = state.threads.map(thread => 
        thread.id === action.payload.threadId 
          ? { ...thread, hasUnreadActivity: false }
          : thread
      );
      
      return {
        ...state,
        threads: updatedThreads,
        activeThreadId: action.payload.threadId
      };

    case 'START_EXECUTION':
      const newExecution: ThreadExecution = {
        threadId: action.payload.threadId,
        status: 'processing',
        currentStep: action.payload.step || 'Starting...',
        progress: 0,
        startTime: new Date(),
        notifications: []
      };
      
      return {
        ...state,
        executions: {
          ...state.executions,
          [action.payload.threadId]: newExecution
        },
        threads: state.threads.map(thread =>
          thread.id === action.payload.threadId
            ? { 
                ...thread, 
                status: 'processing',
                isCurrentlyProcessing: true,
                currentTask: {
                  type: action.payload.taskType || 'chat',
                  description: action.payload.description || 'Processing...',
                  startedAt: new Date(),
                  estimatedDuration: action.payload.estimatedDuration
                }
              }
            : thread
        )
      };

    case 'UPDATE_EXECUTION':
      const currentExecution = state.executions[action.payload.threadId];
      if (!currentExecution) return state;
      
      return {
        ...state,
        executions: {
          ...state.executions,
          [action.payload.threadId]: {
            ...currentExecution,
            ...action.payload.updates
          }
        },
        threads: state.threads.map(thread =>
          thread.id === action.payload.threadId
            ? { 
                ...thread, 
                status: action.payload.updates.status || thread.status,
                currentTask: action.payload.updates.currentStep 
                  ? { ...thread.currentTask, ...{ description: action.payload.updates.currentStep } }
                  : thread.currentTask
              }
            : thread
        )
      };

    case 'COMPLETE_EXECUTION':
      const execution = state.executions[action.payload.threadId];
      const notification: ThreadNotification = {
        id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        threadId: action.payload.threadId,
        type: 'task_completed',
        title: 'Task Completed',
        message: action.payload.message || 'Thread task completed successfully',
        timestamp: new Date(),
        isRead: false,
        priority: 'medium'
      };
      
      return {
        ...state,
        executions: {
          ...state.executions,
          [action.payload.threadId]: {
            ...execution,
            status: 'completed',
            progress: 100,
            endTime: new Date(),
            currentStep: 'Completed'
          }
        },
        threads: state.threads.map(thread =>
          thread.id === action.payload.threadId
            ? { 
                ...thread, 
                status: 'completed',
                isCurrentlyProcessing: false,
                hasUnreadActivity: true,
                currentTask: undefined,
                lastActivity: new Date()
              }
            : thread
        ),
        notifications: [notification, ...state.notifications]
      };

    case 'SET_THREAD_STATUS':
      return {
        ...state,
        threads: state.threads.map(thread => 
          thread.id === action.payload.threadId 
            ? { ...thread, status: action.payload.status, lastActivity: new Date() }
            : thread
        )
      };

    case 'ADD_MESSAGE':
      return {
        ...state,
        threads: state.threads.map(thread => 
          thread.id === action.payload.threadId 
            ? { 
                ...thread, 
                messages: [...thread.messages, action.payload.message],
                lastActivity: new Date(),
                updatedAt: new Date()
              }
            : thread
        )
      };

    case 'UPDATE_TEAMS_STORE':
      return {
        ...state,
        teamsStore: action.payload.store
      };

    case 'ADD_NOTIFICATION':
      return {
        ...state,
        notifications: [action.payload.notification, ...state.notifications]
      };

    case 'MARK_NOTIFICATION_READ':
      return {
        ...state,
        notifications: state.notifications.map(notif =>
          notif.id === action.payload.notificationId
            ? { ...notif, isRead: true }
            : notif
        ),
        threads: state.threads.map(thread =>
          thread.id === action.payload.threadId
            ? { ...thread, hasUnreadActivity: false }
            : thread
        )
      };

    case 'SET_FILTERS':
      return {
        ...state,
        filters: { ...state.filters, ...action.payload.filters }
      };

    case 'SET_VIEW_MODE':
      return {
        ...state,
        viewMode: action.payload.viewMode
      };

    default:
      return state;
  }
}

interface ThreadContextType {
  state: ThreadState;
  actions: {
    createThread: (template: ThreadTemplate, name?: string) => Promise<string>;
    updateThread: (threadId: string, updates: Partial<ConversationThread>) => void;
    deleteThread: (threadId: string) => void;
    setActiveThread: (threadId: string) => void;
    addMessage: (threadId: string, message: Message) => Promise<void>;
    
    // Parallel execution
    startExecution: (threadId: string, step: string, taskType?: string, description?: string, estimatedDuration?: number) => void;
    updateExecution: (threadId: string, updates: Partial<ThreadExecution>) => void;
    completeExecution: (threadId: string, message?: string) => void;
    setThreadStatus: (threadId: string, status: ThreadStatus) => void;
    
    // Notifications
    addNotification: (threadId: string, notification: Omit<ThreadNotification, 'id' | 'threadId' | 'timestamp' | 'isRead'>) => void;
    markNotificationRead: (notificationId: string, threadId: string) => void;
    clearAllNotifications: () => void;
    
    // Filters and views
    setFilters: (filters: Partial<ThreadState['filters']>) => void;
    setViewMode: (viewMode: 'threads' | 'teams-store' | 'notifications') => void;
    
    // Teams Store integration
    updateTeamsStore: () => void;
  };
  helpers: {
    activeThread: ConversationThread | null;
    getThreadById: (threadId: string) => ConversationThread | null;
    getFilteredThreads: () => ConversationThread[];
    getUnreadNotificationCount: () => number;
    getThreadsByStatus: (status: ThreadStatus) => ConversationThread[];
    isThreadProcessing: (threadId: string) => boolean;
  };
}

const ThreadContext = createContext<ThreadContextType | undefined>(undefined);

interface ThreadProviderProps {
  children: ReactNode;
}

export function ThreadProvider({ children }: ThreadProviderProps) {
  const [state, dispatch] = useReducer(threadReducer, initialState);
  const { userId, ensureUserId } = useUser();

  // Load threads from localStorage on mount
  useEffect(() => {
    if (userId) {
      loadThreadsFromStorage();
    }
  }, [userId]);

  // Save threads to localStorage whenever they change
  useEffect(() => {
    if (userId && state.threads.length > 0) {
      saveThreadsToStorage();
    }
  }, [state.threads, userId]);

  // Listen to Teams Store changes
  useEffect(() => {
    const unsubscribe = teamsStoreService.subscribe((store) => {
      dispatch({ type: 'UPDATE_TEAMS_STORE', payload: { store } });
    });

    return unsubscribe;
  }, []);

  const loadThreadsFromStorage = useCallback(() => {
    try {
      const stored = localStorage.getItem(`threads_${userId}`);
      if (stored) {
        const threads = JSON.parse(stored);
        // Convert dates back to Date objects
        threads.forEach((thread: ConversationThread) => {
          thread.createdAt = new Date(thread.createdAt);
          thread.updatedAt = new Date(thread.updatedAt);
          thread.lastActivity = new Date(thread.lastActivity);
          thread.messages.forEach((msg: Message) => {
            msg.timestamp = new Date(msg.timestamp);
          });
        });
        
        dispatch({ type: 'UPDATE_THREAD', payload: { 
          threadId: 'dummy', 
          updates: { threads } 
        } });
        
        // Set active thread to first thread if none active
        if (threads.length > 0 && !state.activeThreadId) {
          dispatch({ type: 'SET_ACTIVE_THREAD', payload: { threadId: threads[0].id } });
        }
      }
    } catch (error) {
      console.error('Error loading threads from storage:', error);
    }
  }, [userId, state.activeThreadId]);

  const saveThreadsToStorage = useCallback(() => {
    try {
      localStorage.setItem(`threads_${userId}`, JSON.stringify(state.threads));
    } catch (error) {
      console.error('Error saving threads to storage:', error);
    }
  }, [state.threads, userId]);

  const createThread = useCallback(async (template: ThreadTemplate, name?: string): Promise<string> => {
    const currentUserId = ensureUserId();
    const threadId = `thread_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const templateData = THREAD_TEMPLATES[template];
    
    const newThread: ConversationThread = {
      id: threadId,
      userId: currentUserId,
      name: name || templateData.name,
      description: templateData.description,
      status: 'idle',
      messages: [],
      lastActivity: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      isArchived: false,
      isPinned: false,
      hasUnreadActivity: false,
      claudeConfig: templateData.claudeConfig,
      tags: templateData.tags,
      isCurrentlyProcessing: false,
      sharedMemory: {
        entities: [],
        insights: [],
        resources: [],
        connections: []
      }
    };

    dispatch({ type: 'CREATE_THREAD', payload: newThread });
    return threadId;
  }, [ensureUserId]);

  const updateThread = useCallback((threadId: string, updates: Partial<ConversationThread>) => {
    dispatch({ type: 'UPDATE_THREAD', payload: { threadId, updates } });
  }, []);

  const deleteThread = useCallback((threadId: string) => {
    dispatch({ type: 'DELETE_THREAD', payload: { threadId } });
  }, []);

  const setActiveThread = useCallback((threadId: string) => {
    dispatch({ type: 'SET_ACTIVE_THREAD', payload: { threadId } });
  }, []);

  const addMessage = useCallback(async (threadId: string, message: Message) => {
    dispatch({ type: 'ADD_MESSAGE', payload: { threadId, message } });
  }, []);

  // Parallel execution methods
  const startExecution = useCallback((
    threadId: string, 
    step: string, 
    taskType?: string, 
    description?: string, 
    estimatedDuration?: number
  ) => {
    dispatch({ 
      type: 'START_EXECUTION', 
      payload: { threadId, step, taskType, description, estimatedDuration } 
    });
  }, []);

  const updateExecution = useCallback((threadId: string, updates: Partial<ThreadExecution>) => {
    dispatch({ type: 'UPDATE_EXECUTION', payload: { threadId, updates } });
  }, []);

  const completeExecution = useCallback((threadId: string, message?: string) => {
    dispatch({ type: 'COMPLETE_EXECUTION', payload: { threadId, message } });
  }, []);

  const setThreadStatus = useCallback((threadId: string, status: ThreadStatus) => {
    dispatch({ type: 'SET_THREAD_STATUS', payload: { threadId, status } });
  }, []);

  // Notification methods
  const addNotification = useCallback((
    threadId: string, 
    notification: Omit<ThreadNotification, 'id' | 'threadId' | 'timestamp' | 'isRead'>
  ) => {
    const fullNotification: ThreadNotification = {
      ...notification,
      id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      threadId,
      timestamp: new Date(),
      isRead: false
    };
    
    dispatch({ type: 'ADD_NOTIFICATION', payload: { notification: fullNotification } });
    
    // Update thread to show unread activity
    if (notification.type === 'task_completed') {
      updateThread(threadId, { hasUnreadActivity: true });
    }
  }, [updateThread]);

  const markNotificationRead = useCallback((notificationId: string, threadId: string) => {
    dispatch({ type: 'MARK_NOTIFICATION_READ', payload: { notificationId, threadId } });
  }, []);

  const clearAllNotifications = useCallback(() => {
    dispatch({ type: 'SET_FILTERS', payload: { filters: {} } });
  }, []);

  // Filter and view methods
  const setFilters = useCallback((filters: Partial<ThreadState['filters']>) => {
    dispatch({ type: 'SET_FILTERS', payload: { filters } });
  }, []);

  const setViewMode = useCallback((viewMode: 'threads' | 'teams-store' | 'notifications') => {
    dispatch({ type: 'SET_VIEW_MODE', payload: { viewMode } });
  }, []);

  const updateTeamsStore = useCallback(() => {
    dispatch({ type: 'UPDATE_TEAMS_STORE', payload: { store: teamsStoreService.getStore() } });
  }, []);

  // Helper functions
  const activeThread = state.threads.find(thread => thread.id === state.activeThreadId) || null;

  const getThreadById = useCallback((threadId: string): ConversationThread | null => {
    return state.threads.find(thread => thread.id === threadId) || null;
  }, [state.threads]);

  const getFilteredThreads = useCallback((): ConversationThread[] => {
    let filtered = [...state.threads];
    
    // Filter by user (only show current user's threads)
    filtered = filtered.filter(thread => thread.userId === userId);
    
    // Filter by status
    if (state.filters.status) {
      filtered = filtered.filter(thread => thread.status === state.filters.status);
    }
    
    // Filter by tags
    if (state.filters.tags && state.filters.tags.length > 0) {
      filtered = filtered.filter(thread => 
        state.filters.tags!.some(tag => thread.tags.includes(tag))
      );
    }
    
    // Filter by date range
    if (state.filters.dateRange) {
      const { start, end } = state.filters.dateRange;
      filtered = filtered.filter(thread => 
        thread.lastActivity >= start && thread.lastActivity <= end
      );
    }
    
    // Sort: pinned threads first, then by last activity
    return filtered.sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return b.lastActivity.getTime() - a.lastActivity.getTime();
    });
  }, [state.threads, state.filters, userId]);

  const getUnreadNotificationCount = useCallback((): number => {
    return state.notifications.filter(notif => !notif.isRead).length;
  }, [state.notifications]);

  const getThreadsByStatus = useCallback((status: ThreadStatus): ConversationThread[] => {
    return state.threads.filter(thread => thread.status === status);
  }, [state.threads]);

  const isThreadProcessing = useCallback((threadId: string): boolean => {
    const execution = state.executions[threadId];
    return execution?.status === 'processing' || false;
  }, [state.executions]);

  const value: ThreadContextType = {
    state,
    actions: {
      createThread,
      updateThread,
      deleteThread,
      setActiveThread,
      addMessage,
      startExecution,
      updateExecution,
      completeExecution,
      setThreadStatus,
      addNotification,
      markNotificationRead,
      clearAllNotifications,
      setFilters,
      setViewMode,
      updateTeamsStore
    },
    helpers: {
      activeThread,
      getThreadById,
      getFilteredThreads,
      getUnreadNotificationCount,
      getThreadsByStatus,
      isThreadProcessing
    }
  };

  return (
    <ThreadContext.Provider value={value}>
      {children}
    </ThreadContext.Provider>
  );
}

export function useThreads() {
  const context = useContext(ThreadContext);
  if (context === undefined) {
    throw new Error('useThreads must be used within a ThreadProvider');
  }
  return context;
}