/**
 * Persistent RFP Intelligence Service
 * Handles all entities from Neo4j with pause/resume and reconnection capabilities
 */

interface RFPProgress {
  sessionId: string;
  totalEntities: number;
  processedEntities: number;
  currentEntity?: string;
  status: 'idle' | 'running' | 'paused' | 'completed' | 'error' | 'reconnecting';
  lastActivity: number;
  entities: string[];
  results: any[];
  errors: string[];
}

interface RFPSessionState {
  progress: RFPProgress;
  connectionState: {
    eventSource: EventSource | null;
    retryCount: number;
    lastReconnectAttempt: number;
    isManualPause: boolean;
  };
}

class PersistentRFPService {
  private static instance: PersistentRFPService;
  private sessionState: RFPSessionState;
  private listeners: Set<(progress: RFPProgress) => void> = new Set();
  private reconnectInterval: NodeJS.Timeout | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private maxRetries = 5;
  private reconnectDelay = 3000; // 3 seconds
  private heartbeatTimeout = 30000; // 30 seconds
  private isClientInitialized = false;

  // Initialize entity count from Neo4j
  private async initializeEntityCount(): Promise<void> {
    // Only run on client side
    if (typeof window === 'undefined') {
      console.log('🖥️ [PersistentRFPService] initializeEntityCount: Skipping on server-side');
      return;
    }

    // Prevent multiple simultaneous initializations
    if (this.sessionState.progress.totalEntities > 0) {
      console.log(`✅ [PersistentRFPService] initializeEntityCount: Already have entity count: ${this.sessionState.progress.totalEntities}, skipping`);
      return;
    }

    try {
      console.log('🔍 [PersistentRFPService] Initializing entity count from Neo4j...');
      
      const response = await fetch('/api/neo4j-query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `
            MATCH (e:Entity) 
            WHERE e.type IN ['Club', 'League', 'Venue', 'Federation', 'Organization']
            RETURN count(e) as totalEntities
          `,
          params: {}
        })
      });

      if (response.ok) {
        const result = await response.json();
        const totalCount = result.data?.[0]?.totalEntities?.low || 1478; // Fallback to known count
        
        // Update the session with the real entity count
        this.sessionState.progress.totalEntities = totalCount;
        
        console.log(`✅ [PersistentRFPService] Fetched real entity count: ${totalCount} entities`);
        console.log('📊 [PersistentRFPService] Updated session with real entity count, notifying listeners...');
        
        // Save the updated session state
        this.saveSessionState();
        this.notifyListeners();
        
      } else {
        console.warn('⚠️ [PersistentRFPService] Failed to fetch entity count, using fallback');
        this.sessionState.progress.totalEntities = 1478; // Known fallback count
        console.log(`📊 [PersistentRFPService] Using fallback count: ${this.sessionState.progress.totalEntities} entities`);
        this.saveSessionState();
        this.notifyListeners();
      }
    } catch (error) {
      console.error('❌ [PersistentRFPService] Error fetching entity count:', error);
      // Use known fallback count
      this.sessionState.progress.totalEntities = 1478;
      console.log(`📊 [PersistentRFPService] Using fallback count after error: ${this.sessionState.progress.totalEntities} entities`);
      this.saveSessionState();
      this.notifyListeners();
    }
  }

  private constructor() {
    console.log('🏗️ [PersistentRFPService] Constructor: Initializing service...');
    
    this.sessionState = {
      progress: {
        sessionId: '',
        totalEntities: 0,
        processedEntities: 0,
        status: 'idle',
        lastActivity: Date.now(),
        entities: [],
        results: [],
        errors: []
      },
      connectionState: {
        eventSource: null,
        retryCount: 0,
        lastReconnectAttempt: 0,
        isManualPause: false
      }
    };
    
    const isClientSide = typeof window !== 'undefined';
    console.log(`🖥️ [PersistentRFPService] Constructor: Running on ${isClientSide ? 'client-side' : 'server-side'}`);
    
    if (isClientSide) {
      console.log('📦 [PersistentRFPService] Constructor: Loading session state from localStorage...');
      // Load session state from localStorage
      this.loadSessionState();
      
      console.log(`📊 [PersistentRFPService] Constructor: Initial state - totalEntities: ${this.sessionState.progress.totalEntities}, status: ${this.sessionState.progress.status}`);
      
      // If we don't have a valid entity count, fetch it from Neo4j
      if (this.sessionState.progress.totalEntities === 0) {
        console.log('🔄 [PersistentRFPService] Constructor: No entity count found, initializing from Neo4j...');
        this.initializeEntityCount();
      } else {
        console.log(`✅ [PersistentRFPService] Constructor: Using existing entity count: ${this.sessionState.progress.totalEntities}`);
      }
    } else {
      console.log('🖥️ [PersistentRFPService] Constructor: Server-side initialization, deferring to client-side');
    }
    
    console.log('🚀 [PersistentRFPService] Constructor: Service initialized successfully');
  }

  // Public method to manually re-initialize entity count (for client-side fallback)
  public async reinitializeEntityCount(): Promise<void> {
    console.log('🔄 [PersistentRFPService] Manual reinitialization requested');
    this.sessionState.progress.totalEntities = 0; // Force re-fetch
    await this.initializeEntityCount();
  }

  // Initialize client-side functionality
  private async initializeClientSide(): Promise<void> {
    if (this.isClientInitialized) {
      console.log('✅ [PersistentRFPService] Client already initialized, skipping');
      return;
    }

    console.log('🖥️ [PersistentRFPService] initializeClientSide: Starting client-side initialization...');
    
    try {
      // Load session state from localStorage
      this.loadSessionState();
      
      console.log(`📊 [PersistentRFPService] initializeClientSide: Loaded state - totalEntities: ${this.sessionState.progress.totalEntities}, status: ${this.sessionState.progress.status}`);
      
      // If we don't have a valid entity count, fetch it from Neo4j
      if (this.sessionState.progress.totalEntities === 0) {
        console.log('🔄 [PersistentRFPService] initializeClientSide: No entity count found, fetching from Neo4j...');
        await this.initializeEntityCount();
      } else {
        console.log(`✅ [PersistentRFPService] initializeClientSide: Using existing entity count: ${this.sessionState.progress.totalEntities}`);
      }
      
      this.isClientInitialized = true;
      console.log('🚀 [PersistentRFPService] initializeClientSide: Client-side initialization completed');
      
    } catch (error) {
      console.error('❌ [PersistentRFPService] initializeClientSide: Initialization failed:', error);
    }
  }

  static getInstance(): PersistentRFPService {
    if (!PersistentRFPService.instance) {
      PersistentRFPService.instance = new PersistentRFPService();
    }
    
    // Ensure client-side initialization happens when accessed on client
    if (typeof window !== 'undefined' && !PersistentRFPService.instance.isClientInitialized) {
      console.log('🔄 [PersistentRFPService] getInstance: Triggering client-side initialization...');
      PersistentRFPService.instance.initializeClientSide();
    }
    
    return PersistentRFPService.instance;
  }

  // Subscribe to progress updates
  subscribe(callback: (progress: RFPProgress) => void) {
    this.listeners.add(callback);
    callback(this.sessionState.progress);
    return () => this.listeners.delete(callback);
  }

  private notifyListeners() {
    this.listeners.forEach(callback => callback(this.sessionState.progress));
    this.saveSessionState();
  }

  // Load/save session state from localStorage
  private loadSessionState() {
    // Only access localStorage on client side
    if (typeof window === 'undefined') {
      console.log('🖥️ [PersistentRFPService] loadSessionState: Running on server-side, skipping localStorage');
      return;
    }
    
    try {
      const saved = localStorage.getItem('rfp-intelligence-session');
      console.log(`📦 [PersistentRFPService] loadSessionState: Found saved data: ${saved ? 'YES' : 'NO'}`);
      
      if (saved) {
        const parsed = JSON.parse(saved);
        console.log('📋 [PersistentRFPService] loadSessionState: Parsed data:', {
          sessionId: parsed.progress?.sessionId,
          totalEntities: parsed.progress?.totalEntities,
          processedEntities: parsed.progress?.processedEntities,
          status: parsed.progress?.status
        });
        
        // Validate and sanitize loaded data
        if (parsed.progress) {
          const oldStatus = parsed.progress.status;
          this.sessionState.progress = {
            sessionId: parsed.progress.sessionId || '',
            totalEntities: Math.max(0, Math.floor(parsed.progress.totalEntities) || 0),
            processedEntities: Math.max(0, Math.floor(parsed.progress.processedEntities) || 0),
            status: parsed.progress.status || 'idle',
            lastActivity: Math.max(0, parsed.progress.lastActivity || Date.now()),
            entities: Array.isArray(parsed.progress.entities) ? parsed.progress.entities : [],
            results: Array.isArray(parsed.progress.results) ? parsed.progress.results : [],
            errors: Array.isArray(parsed.progress.errors) ? parsed.progress.errors : []
          };
          
          // Reset status to idle on page load if it was running
          if (this.sessionState.progress.status === 'running') {
            this.sessionState.progress.status = 'idle';
            console.log('🔄 [PersistentRFPService] Reset running status to idle on page load');
          }
          
          console.log('📦 [PersistentRFPService] Loaded session state:', {
            totalEntities: this.sessionState.progress.totalEntities,
            processedEntities: this.sessionState.progress.processedEntities,
            status: this.sessionState.progress.status,
            oldStatus: oldStatus
          });
        }
      } else {
        console.log('📭 [PersistentRFPService] No saved session state found');
      }
    } catch (error) {
      console.error('❌ [PersistentRFPService] Failed to load session state:', error);
      // Reset to defaults if loading fails
      this.clearSession();
    }
  }

  private saveSessionState() {
    // Only access localStorage on client side
    if (typeof window === 'undefined') {
      return;
    }
    
    try {
      localStorage.setItem('rfp-intelligence-session', JSON.stringify(this.sessionState));
    } catch (error) {
      console.error('Failed to save session state:', error);
    }
  }

  // Start processing all entities from Neo4j
  async startProcessing(): Promise<void> {
    console.log(`🚀 [PersistentRFPService] startProcessing called - current status: ${this.sessionState.progress.status}, totalEntities: ${this.sessionState.progress.totalEntities}`);
    
    if (this.sessionState.progress.status === 'running') {
      console.log('⚠️ [PersistentRFPService] Processing already running, ignoring start request');
      return;
    }

    // Reset manual pause flag
    this.sessionState.connectionState.isManualPause = false;
    console.log('✅ [PersistentRFPService] Manual pause flag reset');

    try {
      // First try to fetch total entity count from Neo4j
      let totalEntities = 0;
      try {
        const response = await fetch('/api/neo4j-query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: `
              MATCH (e:Entity) 
              WHERE e.type IN ['Club', 'League', 'Venue', 'Federation', 'Organization']
              RETURN count(e) as totalEntities
            `,
            params: {}
          })
        });

        if (response.ok) {
          const result = await response.json();
          totalEntities = result.data[0]?.totalEntities || 0;
          console.log(`Found ${totalEntities} entities in Neo4j database`);
        } else {
          throw new Error('Failed to fetch entity count from Neo4j');
        }
      } catch (error) {
        console.error('Failed to fetch entity count:', error);
        // Fallback to a reasonable default
        totalEntities = 50;
        this.sessionState.progress.errors.push(`Neo4j query failed, using fallback: ${error.message}`);
      }

      if (totalEntities === 0) {
        throw new Error('No entities found in Neo4j database');
      }

      // Ensure we have a valid entity count
      const safeTotalEntities = Math.max(3, totalEntities); // Ensure at least 3 entities
      
      // Initialize or resume processing
      if (this.sessionState.progress.status === 'idle' || this.sessionState.progress.status === 'completed') {
        // Start fresh
        this.sessionState.progress = {
          sessionId: `rfp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          totalEntities: safeTotalEntities,
          processedEntities: 0,
          status: 'running',
          lastActivity: Date.now(),
          entities: [],
          results: [],
          errors: []
        };
      } else {
        // Resume existing session but ensure valid total
        this.sessionState.progress.totalEntities = Math.max(safeTotalEntities, this.sessionState.progress.totalEntities);
        this.sessionState.progress.status = 'running';
        this.sessionState.progress.lastActivity = Date.now();
      }

      this.sessionState.connectionState.retryCount = 0;
      this.notifyListeners();

      // Start SSE connection
      this.connectSSE();

    } catch (error) {
      console.error('Failed to start processing:', error);
      this.sessionState.progress.status = 'error';
      this.sessionState.progress.errors.push(error.message);
      this.notifyListeners();
    }
  }

  // Connect to SSE stream
  private connectSSE() {
    if (this.sessionState.connectionState.eventSource) {
      this.sessionState.connectionState.eventSource.close();
    }

    // Determine where to resume from
    const startFrom = this.sessionState.progress.processedEntities > 0 
      ? this.sessionState.progress.processedEntities 
      : 0;
    
    // Ensure we have a valid entity count
    if (this.sessionState.progress.totalEntities === 0) {
      console.warn('⚠️ [PersistentRFPService] No entity count available, using fallback of 1478');
      this.sessionState.progress.totalEntities = 1478;
      this.saveSessionState();
      this.notifyListeners();
    }

    // Use smaller chunk size for better reliability
    const chunkSize = 3;
    
    console.log(`🔢 [PersistentRFPService] Entity calculation debug:`);
    console.log(`   - this.sessionState.progress.totalEntities: ${this.sessionState.progress.totalEntities} (type: ${typeof this.sessionState.progress.totalEntities})`);
    console.log(`   - startFrom: ${startFrom} (type: ${typeof startFrom})`);
    console.log(`   - this.sessionState.progress.totalEntities - startFrom: ${this.sessionState.progress.totalEntities - startFrom}`);
    
    // Calculate remainingEntities with comprehensive safety checks
    let remainingEntities: number;
    
    try {
      const total = Number(this.sessionState.progress.totalEntities) || 1478; // Fallback to 1478
      const start = Number(startFrom) || 0;
      const available = total - start;
      
      console.log(`   - Calculation: total=${total}, start=${start}, available=${available}`);
      
      remainingEntities = Math.max(0, Math.min(chunkSize, available));
      
      // Final safety check
      if (!isFinite(remainingEntities) || isNaN(remainingEntities) || remainingEntities < 0) {
        console.warn('⚠️ [PersistentRFPService] Invalid calculation result, using fallback');
        remainingEntities = Math.min(chunkSize, 1478); // Safe fallback
      }
      
      console.log(`   - Final remainingEntities: ${remainingEntities}`);
      
    } catch (error) {
      console.error('❌ [PersistentRFPService] Error calculating remainingEntities:', error);
      remainingEntities = Math.min(chunkSize, 1478); // Safe fallback
    }

    console.log(`🔄 DEBUG: connectSSE called with:`);
    console.log(`   - totalEntities: ${this.sessionState.progress.totalEntities}`);
    console.log(`   - processedEntities: ${this.sessionState.progress.processedEntities}`);
    console.log(`   - startFrom: ${startFrom}`);
    console.log(`   - remainingEntities: ${remainingEntities}`);
    console.log(`   - status: ${this.sessionState.progress.status}`);

    console.log(`🔄 [PersistentRFPService] Connecting to SSE stream: processing ${remainingEntities} entities starting from ${startFrom}`);
    console.log(`📊 [PersistentRFPService] Progress: ${this.sessionState.progress.processedEntities}/${this.sessionState.progress.totalEntities} entities processed`);

    const sseUrl = `/api/claude-agent-demo/stream?service=reliable&query=Persistent%20RFP%20intelligence&mode=batch&entityLimit=${remainingEntities}&startEntityId=${startFrom}`;
    console.log(`🌐 [PersistentRFPService] SSE URL: ${sseUrl}`);

    const eventSource = new EventSource(sseUrl);

    this.sessionState.connectionState.eventSource = eventSource;
    this.sessionState.progress.status = 'running';
    this.notifyListeners();

    // Handle connection open
    eventSource.onopen = () => {
      console.log('✅ SSE connection established');
      console.log(`📡 URL: /api/claude-agent-demo/stream?service=reliable&query=Persistent%20RFP%20intelligence&mode=batch&entityLimit=${remainingEntities}&startEntityId=${startFrom}`);
      this.sessionState.connectionState.retryCount = 0;
      this.startHeartbeat();
      this.notifyListeners();
    };

    // Handle specific event types for entity processing
    eventSource.addEventListener('entity_search_start', (event) => {
      try {
        const data = JSON.parse(event.data);
        this.sessionState.progress.currentEntity = data.sessionState?.currentEntity || 'Unknown';
        console.log(`🔍 Processing entity: ${this.sessionState.progress.currentEntity}`);
        this.notifyListeners();
      } catch (error) {
        console.error('Failed to parse entity_search_start:', error);
      }
    });

    eventSource.addEventListener('entity_search_complete', (event) => {
      try {
        const data = JSON.parse(event.data);
        const entityName = data.sessionState?.currentEntity || 'Unknown';
        console.log(`✅ Completed entity: ${entityName}`);
        
        this.sessionState.progress.processedEntities++;
        this.sessionState.progress.lastActivity = Date.now();
        
        if (!this.sessionState.progress.entities.includes(entityName)) {
          this.sessionState.progress.entities.push(entityName);
        }
        
        this.notifyListeners();
      } catch (error) {
        console.error('Failed to parse entity_search_complete:', error);
      }
    });

    // Handle messages (for other event types)
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.handleSSEMessage(data);
      } catch (error) {
        console.error('Failed to parse SSE message:', error);
        this.sessionState.progress.errors.push(`Parse error: ${error.message}`);
        this.notifyListeners();
      }
    };

    eventSource.addEventListener('result', (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('🎯 Received final results:', data.data);
        
        if (data.data?.results) {
          this.sessionState.progress.results.push(...data.data.results);
        }
        
        this.sessionState.progress.status = 'completed';
        this.cleanup();
        this.notifyListeners();
      } catch (error) {
        console.error('Failed to parse result:', error);
      }
    });

    eventSource.addEventListener('completed', (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('🏁 Processing completed:', data);
        
        this.sessionState.progress.status = 'completed';
        this.sessionState.progress.lastActivity = Date.now();
        this.cleanup();
        this.notifyListeners();
      } catch (error) {
        console.error('Failed to parse completed event:', error);
      }
    });

    // Handle errors and reconnection
    eventSource.onerror = (error) => {
      console.error('SSE connection error:', error);
      this.handleConnectionError();
    };
  }

  // Handle SSE messages
  private handleSSEMessage(data: any) {
    this.sessionState.progress.lastActivity = Date.now();

    switch (data.type) {
      case 'system':
      case 'progress':
        console.log(`📋 ${data.message}`);
        break;
      
      case 'error':
        console.error(`❌ Error: ${data.message}`);
        this.sessionState.progress.errors.push(data.message);
        break;
      
      case 'success':
        console.log(`✅ ${data.message}`);
        break;
    }

    this.notifyListeners();
  }

  // Handle connection errors with automatic reconnection
  private handleConnectionError() {
    if (this.sessionState.connectionState.isManualPause) {
      console.log('Connection paused manually');
      return;
    }

    this.sessionState.connectionState.retryCount++;
    
    if (this.sessionState.connectionState.retryCount > this.maxRetries) {
      console.error('Max retries exceeded, giving up');
      this.sessionState.progress.status = 'error';
      this.sessionState.progress.errors.push('Connection failed after maximum retries');
      this.cleanup();
      this.notifyListeners();
      return;
    }

    console.log(`Connection lost, retrying (${this.sessionState.connectionState.retryCount}/${this.maxRetries})...`);
    
    this.sessionState.progress.status = 'reconnecting';
    this.sessionState.connectionState.lastReconnectAttempt = Date.now();
    this.notifyListeners();

    // Close existing connection
    if (this.sessionState.connectionState.eventSource) {
      this.sessionState.connectionState.eventSource.close();
      this.sessionState.connectionState.eventSource = null;
    }

    // Schedule reconnection
    setTimeout(() => {
      if (!this.sessionState.connectionState.isManualPause) {
        this.connectSSE();
      }
    }, this.reconnectDelay * this.sessionState.connectionState.retryCount);
  }

  // Start heartbeat monitoring
  private startHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    this.heartbeatInterval = setInterval(() => {
      const timeSinceLastActivity = Date.now() - this.sessionState.progress.lastActivity;
      
      if (timeSinceLastActivity > this.heartbeatTimeout) {
        console.warn('Heartbeat timeout, reconnecting...');
        this.handleConnectionError();
      }
    }, this.heartbeatTimeout / 2);
  }

  // Manual pause/resume controls
  pauseProcessing() {
    if (this.sessionState.progress.status !== 'running') {
      return;
    }

    console.log('⏸️ Manually pausing processing');
    this.sessionState.connectionState.isManualPause = true;
    this.sessionState.progress.status = 'paused';
    
    if (this.sessionState.connectionState.eventSource) {
      this.sessionState.connectionState.eventSource.close();
      this.sessionState.connectionState.eventSource = null;
    }
    
    this.cleanup();
    this.notifyListeners();
  }

  resumeProcessing() {
    if (this.sessionState.progress.status !== 'paused') {
      return;
    }

    console.log('▶️ Resuming processing');
    this.sessionState.connectionState.isManualPause = false;
    this.sessionState.connectionState.retryCount = 0;
    this.connectSSE();
  }

  // Stop processing completely
  stopProcessing() {
    console.log('🛑 Stopping processing');
    this.sessionState.progress.status = 'idle';
    this.sessionState.connectionState.isManualPause = false;
    this.cleanup();
    this.notifyListeners();
  }

  // Clear session state
  clearSession() {
    console.log('🗑️ Clearing session state');
    
    // Only access localStorage on client side
    if (typeof window !== 'undefined') {
      localStorage.removeItem('rfp-intelligence-session');
    }
    
    this.sessionState.progress = {
      sessionId: '',
      totalEntities: 0,
      processedEntities: 0,
      status: 'idle',
      lastActivity: Date.now(),
      entities: [],
      results: [],
      errors: []
    };
    this.cleanup();
    this.notifyListeners();
    
    // Reinitialize entity count after clearing
    this.initializeEntityCount();
  }

  // Cleanup resources
  private cleanup() {
    if (this.sessionState.connectionState.eventSource) {
      this.sessionState.connectionState.eventSource.close();
      this.sessionState.connectionState.eventSource = null;
    }
    
    if (this.reconnectInterval) {
      clearTimeout(this.reconnectInterval);
      this.reconnectInterval = null;
    }
    
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  // Get current progress
  getProgress(): RFPProgress {
    return { ...this.sessionState.progress };
  }

  // Get statistics
  getStatistics() {
    const safeTotalEntities = Math.max(0, Math.floor(this.sessionState.progress.totalEntities) || 0);
    const safeProcessedEntities = Math.max(0, Math.floor(this.sessionState.progress.processedEntities) || 0);
    const safeLastActivity = this.sessionState.progress.lastActivity || Date.now();
    
    return {
      ...this.sessionState.progress,
      totalEntities: safeTotalEntities,
      processedEntities: safeProcessedEntities,
      completionPercentage: safeTotalEntities > 0 
        ? Math.round((safeProcessedEntities / safeTotalEntities) * 100)
        : 0,
      processingRate: safeProcessedEntities > 0 
        ? (safeProcessedEntities / (Date.now() - safeLastActivity + 1) * 1000 * 60).toFixed(2) + ' entities/min'
        : '0 entities/min'
    };
  }
}

export default PersistentRFPService;