// Shared execution log storage for cross-tab synchronization
export interface ExecutionLog {
  id: string
  timestamp: string
  type: 'system' | 'assistant' | 'tool_use' | 'result' | 'error' | 'agent_message'
  message?: string
  toolName?: string
  toolUseId?: string
  status?: 'starting' | 'completed' | 'error'
  data?: any
  input?: any
  result?: any
  service?: string
}

export interface ExecutionState {
  id: string
  status: 'idle' | 'running' | 'completed' | 'error'
  startTime?: string
  endTime?: string
  duration?: number
  logs: ExecutionLog[]
  progress: { current: number; total: number; message: string }
  cost?: { tokens: number; cost: number }
  activeService: 'headless' | 'a2a' | 'claude-sdk'
}

class SharedExecutionStore {
  private storageKey = 'claude-agent-execution-state';
  private listeners: Array<(state: ExecutionState) => void> = [];
  private currentExecution: ExecutionState = {
    id: '',
    status: 'idle',
    logs: [],
    progress: { current: 0, total: 100, message: 'Ready to start Claude Agent' },
    activeService: 'headless'
  };
  private isClient = false;

  constructor() {
    // Check if we're in a browser environment
    this.isClient = typeof window !== 'undefined' && typeof localStorage !== 'undefined';
    
    if (this.isClient) {
      this.loadFromStorage();
      this.setupStorageListener();
    }
  }

  private loadFromStorage() {
    if (!this.isClient) return;
    
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        this.currentExecution = JSON.parse(stored);
      }
    } catch (error) {
      console.error('Failed to load execution state from localStorage:', error);
    }
  }

  private saveToStorage() {
    if (!this.isClient) return;
    
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.currentExecution));
    } catch (error) {
      console.error('Failed to save execution state to localStorage:', error);
    }
  }

  private setupStorageListener() {
    if (!this.isClient) return;
    
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === this.storageKey) {
        const newState = JSON.parse(event.newValue || '{}');
        this.currentExecution = newState;
        this.notifyListeners();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }

  private notifyListeners() {
    this.listeners.forEach(listener => listener(this.currentExecution));
  }

  // Get current execution state
  getState(): ExecutionState {
    return { ...this.currentExecution };
  }

  // Start a new execution
  startExecution(service: 'headless' | 'a2a' | 'claude-sdk') {
    this.currentExecution = {
      id: `exec-${Date.now()}`,
      status: 'running',
      startTime: new Date().toISOString(),
      logs: [],
      progress: { current: 0, total: 100, message: 'Initializing Claude Agent...' },
      activeService: service
    };
    this.saveToStorage();
    this.notifyListeners();
  }

  // Add a log entry
  addLog(log: Omit<ExecutionLog, 'id' | 'timestamp'>) {
    const newLog: ExecutionLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      ...log
    };
    
    this.currentExecution.logs.push(newLog);
    this.saveToStorage();
    this.notifyListeners();
  }

  // Update progress
  updateProgress(progress: Partial<{ current: number; total: number; message: string }>) {
    this.currentExecution.progress = { ...this.currentExecution.progress, ...progress };
    this.saveToStorage();
    this.notifyListeners();
  }

  // Complete execution
  completeExecution(cost?: { tokens: number; cost: number }) {
    this.currentExecution.status = 'completed';
    this.currentExecution.endTime = new Date().toISOString();
    if (this.currentExecution.startTime) {
      this.currentExecution.duration = Date.now() - new Date(this.currentExecution.startTime).getTime();
    }
    if (cost) {
      this.currentExecution.cost = cost;
    }
    this.saveToStorage();
    this.notifyListeners();
  }

  // Set error state
  setErrorState() {
    this.currentExecution.status = 'error';
    this.currentExecution.endTime = new Date().toISOString();
    this.saveToStorage();
    this.notifyListeners();
  }

  // Clear execution
  clearExecution() {
    this.currentExecution = {
      id: '',
      status: 'idle',
      logs: [],
      progress: { current: 0, total: 100, message: 'Ready to start Claude Agent' },
      activeService: 'headless'
    };
    this.saveToStorage();
    this.notifyListeners();
  }

  // Subscribe to state changes
  subscribe(listener: (state: ExecutionState) => void) {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }
}

// Export singleton instance
export const sharedExecutionStore = new SharedExecutionStore();