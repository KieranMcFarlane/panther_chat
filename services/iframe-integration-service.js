/**
 * Iframe Integration Service with Better Auth
 * 
 * This service provides seamless iframe integration for ClaudeBox access
 * with Better Auth authentication, session management, and cross-origin security.
 * 
 * Based on TICKET-010 requirements for Iframe Integration Service with Better Auth
 */

import EventEmitter from 'events';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

class IframeIntegrationService extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      // Base configuration
      baseUrl: 'http://localhost:7681',          // Base ClaudeBox URL
      iframeTimeout: 30000,                     // Iframe load timeout (30 seconds)
      sessionTimeout: 3600000,                  // Session timeout (1 hour)
      refreshInterval: 300000,                  // Session refresh interval (5 minutes)
      
      // Security settings
      allowedOrigins: ['http://localhost:3000', 'http://localhost:5173'],  // Allowed iframe origins
      sandboxPermissions: [
        'allow-same-origin',
        'allow-scripts', 
        'allow-forms',
        'allow-popups',
        'allow-modals',
        'allow-downloads',
        'allow-orientation-lock',
        'allow-presentation'
      ],
      allowedFeatures: [
        'clipboard-read',
        'clipboard-write', 
        'fullscreen',
        'presentation',
        'screen-orientation'
      ],
      
      // Rate limiting
      maxIframesPerUser: 5,                      // Maximum concurrent iframes per user
      maxRequestsPerMinute: 100,                // Rate limiting per user
      
      // Session management
      enableSessionPersistence: true,            // Enable session persistence
      enableAutoRefresh: true,                  // Enable automatic session refresh
      cleanupInterval: 300000,                  // Cleanup interval (5 minutes)
      
      // Cross-origin communication
      enableCrossOriginComm: true,              // Enable cross-origin messaging
      messageTimeout: 5000,                     // Message timeout (5 seconds)
      
      // Monitoring and logging
      enableMetrics: true,                      // Enable metrics collection
      enableLogging: true,                      // Enable detailed logging
      metricsRetention: 86400000,               // Metrics retention (24 hours)
      
      ...config
    };
    
    // Core data structures
    this.iframeSessions = new Map();            // Active iframe sessions
    this.userSessions = new Map();              // User sessions mapping
    this.slotUrls = new Map();                  // Slot URL mapping
    this.authTokens = new Map();                // Authentication tokens
    this.metrics = new Map();                   // Performance metrics
    this.messageHandlers = new Map();           // Message handlers
    
    // Service references
    this.authService = null;
    this.slotManager = null;
    this.userManagement = null;
    this.sessionPersistence = null;
    
    // State management
    this.isInitialized = false;
    this.isRunning = false;
    this.startTime = null;
    this.totalIframesCreated = 0;
    this.totalIframesTerminated = 0;
    this.totalMessagesProcessed = 0;
    
    // Intervals
    this.cleanupIntervalId = null;
    this.refreshIntervalId = null;
    this.metricsIntervalId = null;
  }

  /**
   * Initialize the Iframe Integration Service
   */
  async initialize() {
    try {
      console.log('🖼️ Initializing Iframe Integration Service with Better Auth...');
      
      // Initialize service dependencies
      await this.initializeServices();
      
      // Set up event listeners
      this.setupEventListeners();
      
      // Set up cross-origin communication
      this.setupCrossOriginCommunication();
      
      // Start background processes
      this.startBackgroundProcesses();
      
      this.isInitialized = true;
      this.startTime = Date.now();
      
      console.log('✅ Iframe Integration Service initialized successfully');
      this.emit('initialized', { 
        service: 'iframe-integration',
        timestamp: this.startTime,
        config: this.config
      });
      
    } catch (error) {
      console.error('❌ Failed to initialize Iframe Integration Service:', error);
      throw error;
    }
  }

  /**
   * Initialize service dependencies
   */
  async initializeServices() {
    try {
      // Import services dynamically
      const { default: EnhancedAuthService } = await import('./enhanced-auth-service.js');
      const { default: SlotManagerService } = await import('./slot-manager-service.js');
      const { default: UserManagementAPI } = await import('./user-management-api.js');
      const { default: SessionPersistenceManager } = await import('./session-persistence-manager.js');
      
      // Initialize services
      this.authService = new EnhancedAuthService();
      this.slotManager = new SlotManagerService();
      this.userManagement = new UserManagementAPI();
      this.sessionPersistence = new SessionPersistenceManager();
      
      // Initialize all services
      await Promise.all([
        this.authService.initialize(),
        this.slotManager.initialize(),
        this.userManagement.initialize(),
        this.sessionPersistence.initialize()
      ]);
      
      console.log('✅ All service dependencies initialized');
      
    } catch (error) {
      console.error('❌ Failed to initialize service dependencies:', error);
      throw error;
    }
  }

  /**
   * Set up event listeners
   */
  setupEventListeners() {
    // Listen to slot manager events
    this.slotManager.on('slotCreated', (data) => {
      this.handleSlotCreated(data);
    });
    
    this.slotManager.on('slotTerminated', (data) => {
      this.handleSlotTerminated(data);
    });
    
    // Listen to auth service events
    this.authService.on('sessionExpired', (data) => {
      this.handleSessionExpired(data);
    });
    
    this.authService.on('sessionRefreshed', (data) => {
      this.handleSessionRefreshed(data);
    });
    
    // Listen to user management events
    this.userManagement.on('userSessionUpdated', (data) => {
      this.handleUserSessionUpdated(data);
    });
    
    // Listen to session persistence events
    this.sessionPersistence.on('sessionRestored', (data) => {
      this.handleSessionRestored(data);
    });
    
    // Set up global message listener
    if (typeof window !== 'undefined') {
      window.addEventListener('message', this.handleMessage.bind(this));
    }
    
    console.log('✅ Event listeners set up');
  }

  /**
   * Set up cross-origin communication
   */
  setupCrossOriginCommunication() {
    // Register message handlers
    this.registerMessageHandler('auth_request', this.handleAuthRequest.bind(this));
    this.registerMessageHandler('session_validate', this.handleSessionValidate.bind(this));
    this.registerMessageHandler('slot_info', this.handleSlotInfo.bind(this));
    this.registerMessageHandler('iframe_ready', this.handleIframeReady.bind(this));
    this.registerMessageHandler('iframe_error', this.handleIframeError.bind(this));
    this.registerMessageHandler('user_activity', this.handleUserActivity.bind(this));
    
    console.log('✅ Cross-origin communication set up');
  }

  /**
   * Start background processes
   */
  startBackgroundProcesses() {
    // Start cleanup process
    this.cleanupIntervalId = setInterval(() => {
      this.cleanupExpiredSessions();
    }, this.config.cleanupInterval);
    
    // Start session refresh process
    if (this.config.enableAutoRefresh) {
      this.refreshIntervalId = setInterval(() => {
        this.refreshActiveSessions();
      }, this.config.refreshInterval);
    }
    
    // Start metrics collection
    if (this.config.enableMetrics) {
      this.metricsIntervalId = setInterval(() => {
        this.collectMetrics();
      }, 60000); // Collect metrics every minute
    }
    
    console.log('✅ Background processes started');
  }

  /**
   * Generate iframe URL for a specific slot
   */
  generateSlotUrl(slotId, options = {}) {
    try {
      const {
        userId,
        sessionId,
        authToken,
        width = '100%',
        height = '600px',
        theme = 'default',
        mobile = false,
        debug = false
      } = options;
      
      // Validate slot exists
      if (!this.slotManager.hasSlot(slotId)) {
        throw new Error(`Slot ${slotId} not found`);
      }
      
      // Generate secure URL parameters
      const timestamp = Date.now();
      const nonce = crypto.randomBytes(16).toString('hex');
      const signature = this.generateUrlSignature(slotId, userId, timestamp, nonce);
      
      // Build URL with authentication parameters
      const url = new URL(`${this.config.baseUrl}/slot/${slotId}`);
      url.searchParams.append('ts', timestamp.toString());
      url.searchParams.append('nonce', nonce);
      url.searchParams.append('sig', signature);
      url.searchParams.append('theme', theme);
      
      if (mobile) {
        url.searchParams.append('mobile', 'true');
      }
      
      if (debug) {
        url.searchParams.append('debug', 'true');
      }
      
      if (width && width !== '100%') {
        url.searchParams.append('width', width);
      }
      
      if (height && height !== '600px') {
        url.searchParams.append('height', height);
      }
      
      const urlString = url.toString();
      
      // Store URL mapping
      this.slotUrls.set(slotId, urlString);
      
      console.log(`🔗 Generated iframe URL for slot ${slotId}: ${urlString}`);
      
      return {
        slotId,
        url: urlString,
        timestamp,
        nonce,
        signature,
        expiresAt: timestamp + this.config.sessionTimeout
      };
      
    } catch (error) {
      console.error('❌ Failed to generate slot URL:', error);
      throw error;
    }
  }

  /**
   * Create iframe session for a user
   */
  async createIframeSession(userId, slotId, options = {}) {
    try {
      console.log(`🖼️ Creating iframe session for user ${userId}, slot ${slotId}`);
      
      // Validate user session with Better Auth
      const userSession = await this.authService.validateUserSession(userId);
      if (!userSession.valid) {
        throw new Error('Invalid user session');
      }
      
      // Check rate limits
      if (!this.checkRateLimit(userId)) {
        throw new Error('Rate limit exceeded');
      }
      
      // Check concurrent iframe limit
      const userIframes = this.getUserIframes(userId);
      if (userIframes.length >= this.config.maxIframesPerUser) {
        throw new Error('Maximum concurrent iframes exceeded');
      }
      
      // Validate slot exists and user has access
      const slotAccess = await this.userManagement.validateSlotAccess(userId, slotId, userSession.sessionId);
      if (!slotAccess.allowed) {
        throw new Error('Unauthorized slot access');
      }
      
      // Generate iframe URL
      const urlInfo = this.generateSlotUrl(slotId, {
        userId,
        sessionId: userSession.sessionId,
        authToken: userSession.authToken,
        ...options
      });
      
      // Create iframe session
      const iframeSession = {
        id: uuidv4(),
        userId,
        slotId,
        sessionId: userSession.sessionId,
        url: urlInfo.url,
        urlInfo,
        status: 'created',
        createdAt: Date.now(),
        lastActivity: Date.now(),
        expiresAt: Date.now() + this.config.sessionTimeout,
        options: {
          ...options,
          width: options.width || '100%',
          height: options.height || '600px',
          theme: options.theme || 'default',
          mobile: options.mobile || false
        },
        metadata: {
          userAgent: options.userAgent,
          ipAddress: options.ipAddress,
          origin: options.origin,
          referrer: options.referrer
        }
      };
      
      // Store iframe session
      this.iframeSessions.set(iframeSession.id, iframeSession);
      this.userSessions.set(userId, iframeSession.id);
      
      // Track metrics
      this.totalIframesCreated++;
      this.updateMetrics('iframes_created', 1);
      
      console.log(`✅ Iframe session created: ${iframeSession.id}`);
      
      // Emit event
      this.emit('iframeSessionCreated', {
        sessionId: iframeSession.id,
        userId,
        slotId,
        timestamp: iframeSession.createdAt
      });
      
      return iframeSession;
      
    } catch (error) {
      console.error('❌ Failed to create iframe session:', error);
      throw error;
    }
  }

  /**
   * Get iframe session by ID
   */
  getIframeSession(sessionId) {
    const session = this.iframeSessions.get(sessionId);
    
    if (!session) {
      return null;
    }
    
    // Check if session is expired
    if (Date.now() > session.expiresAt) {
      this.terminateIframeSession(sessionId, 'session_expired');
      return null;
    }
    
    return session;
  }

  /**
   * Get user iframe sessions
   */
  getUserIframes(userId) {
    const userSessions = [];
    
    for (const [sessionId, session] of this.iframeSessions) {
      if (session.userId === userId && session.status === 'active') {
        userSessions.push(session);
      }
    }
    
    return userSessions;
  }

  /**
   * Terminate iframe session
   */
  async terminateIframeSession(sessionId, reason = 'user_terminated') {
    try {
      const session = this.iframeSessions.get(sessionId);
      
      if (!session) {
        return { success: false, error: 'Session not found' };
      }
      
      // Update session status
      session.status = 'terminated';
      session.terminatedAt = Date.now();
      session.terminationReason = reason;
      
      // Remove from active sessions
      this.iframeSessions.delete(sessionId);
      
      // Remove from user sessions mapping
      this.userSessions.delete(session.userId);
      
      // Remove from slot URLs
      this.slotUrls.delete(session.slotId);
      
      // Track metrics
      this.totalIframesTerminated++;
      this.updateMetrics('iframes_terminated', 1);
      
      console.log(`🗑️ Iframe session terminated: ${sessionId} (${reason})`);
      
      // Emit event
      this.emit('iframeSessionTerminated', {
        sessionId,
        userId: session.userId,
        slotId: session.slotId,
        reason,
        timestamp: session.terminatedAt
      });
      
      return { success: true, sessionId, reason };
      
    } catch (error) {
      console.error('❌ Failed to terminate iframe session:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Validate iframe session with Better Auth
   */
  async validateIframeSession(sessionId, validationData = {}) {
    try {
      const session = this.getIframeSession(sessionId);
      
      if (!session) {
        return { valid: false, error: 'Session not found or expired' };
      }
      
      // Validate with Better Auth
      const authValidation = await this.authService.validateBetterAuthSession(session.sessionId);
      
      if (!authValidation.valid) {
        await this.terminateIframeSession(sessionId, 'auth_validation_failed');
        return { valid: false, error: 'Authentication validation failed' };
      }
      
      // Update session activity
      session.lastActivity = Date.now();
      session.lastValidation = Date.now();
      
      // Update validation data
      if (validationData.userAgent) {
        session.metadata.userAgent = validationData.userAgent;
      }
      
      if (validationData.ipAddress) {
        session.metadata.ipAddress = validationData.ipAddress;
      }
      
      // Extend session if needed
      if (this.config.enableAutoRefresh) {
        const timeUntilExpiry = session.expiresAt - Date.now();
        if (timeUntilExpiry < this.config.refreshInterval) {
          session.expiresAt = Date.now() + this.config.sessionTimeout;
        }
      }
      
      console.log(`✅ Iframe session validated: ${sessionId}`);
      
      return {
        valid: true,
        sessionId,
        userId: session.userId,
        slotId: session.slotId,
        expiresAt: session.expiresAt,
        lastActivity: session.lastActivity
      };
      
    } catch (error) {
      console.error('❌ Failed to validate iframe session:', error);
      return { valid: false, error: error.message };
    }
  }

  /**
   * Refresh iframe session
   */
  async refreshIframeSession(sessionId) {
    try {
      const session = this.getIframeSession(sessionId);
      
      if (!session) {
        return { success: false, error: 'Session not found' };
      }
      
      // Refresh Better Auth session
      const refreshResult = await this.authService.refreshBetterAuthSession(session.sessionId);
      
      if (!refreshResult.success) {
        await this.terminateIframeSession(sessionId, 'session_refresh_failed');
        return { success: false, error: 'Session refresh failed' };
      }
      
      // Generate new URL with fresh signature
      const urlInfo = this.generateSlotUrl(session.slotId, {
        userId: session.userId,
        sessionId: session.sessionId,
        ...session.options
      });
      
      // Update session
      session.url = urlInfo.url;
      session.urlInfo = urlInfo;
      session.expiresAt = Date.now() + this.config.sessionTimeout;
      session.lastRefreshed = Date.now();
      
      console.log(`🔄 Iframe session refreshed: ${sessionId}`);
      
      return {
        success: true,
        sessionId,
        newUrl: urlInfo.url,
        expiresAt: session.expiresAt
      };
      
    } catch (error) {
      console.error('❌ Failed to refresh iframe session:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Handle iframe loading state
   */
  updateIframeLoadingState(sessionId, loadingState) {
    const session = this.getIframeSession(sessionId);
    
    if (!session) {
      return false;
    }
    
    session.loadingState = loadingState;
    session.lastStateUpdate = Date.now();
    
    this.emit('iframeLoadingStateChanged', {
      sessionId,
      loadingState,
      timestamp: session.lastStateUpdate
    });
    
    return true;
  }

  /**
   * Handle iframe error
   */
  handleIframeError(sessionId, error) {
    const session = this.getIframeSession(sessionId);
    
    if (!session) {
      return;
    }
    
    session.lastError = {
      message: error.message,
      code: error.code,
      timestamp: Date.now()
    };
    
    session.errorCount = (session.errorCount || 0) + 1;
    
    // Auto-terminate on too many errors
    if (session.errorCount >= 3) {
      this.terminateIframeSession(sessionId, 'too_many_errors');
    }
    
    this.emit('iframeError', {
      sessionId,
      userId: session.userId,
      slotId: session.slotId,
      error,
      errorCount: session.errorCount,
      timestamp: session.lastError.timestamp
    });
  }

  /**
   * Register message handler
   */
  registerMessageHandler(messageType, handler) {
    this.messageHandlers.set(messageType, handler);
    console.log(`📨 Message handler registered for: ${messageType}`);
  }

  /**
   * Handle cross-origin messages
   */
  async handleMessage(event) {
    try {
      const { origin, data, source } = event;
      
      // Validate origin
      if (!this.config.allowedOrigins.includes(origin)) {
        console.warn(`🚫 Message from unauthorized origin: ${origin}`);
        return;
      }
      
      // Validate message structure
      if (!data || !data.type) {
        console.warn('🚫 Invalid message structure');
        return;
      }
      
      const { type, sessionId, payload } = data;
      
      // Get handler
      const handler = this.messageHandlers.get(type);
      if (!handler) {
        console.warn(`🚫 No handler for message type: ${type}`);
        return;
      }
      
      // Handle message
      const result = await handler({ sessionId, payload, origin, source });
      
      // Send response if needed
      if (result && source && source.postMessage) {
        source.postMessage({
          type: `${type}_response`,
          sessionId,
          result,
          timestamp: Date.now()
        }, origin);
      }
      
      this.totalMessagesProcessed++;
      this.updateMetrics('messages_processed', 1);
      
    } catch (error) {
      console.error('❌ Error handling message:', error);
    }
  }

  /**
   * Message handlers
   */
  async handleAuthRequest({ sessionId, payload, origin }) {
    const session = this.getIframeSession(sessionId);
    
    if (!session) {
      return { success: false, error: 'Invalid session' };
    }
    
    // Validate auth request
    const authResult = await this.authService.validateBetterAuthSession(session.sessionId);
    
    return {
      success: authResult.valid,
      userId: session.userId,
      expiresAt: session.expiresAt,
      origin
    };
  }

  async handleSessionValidate({ sessionId, payload }) {
    return await this.validateIframeSession(sessionId, payload);
  }

  async handleSlotInfo({ sessionId }) {
    const session = this.getIframeSession(sessionId);
    
    if (!session) {
      return { success: false, error: 'Session not found' };
    }
    
    const slotInfo = await this.slotManager.getSlotInfo(session.slotId);
    
    return {
      success: true,
      slotId: session.slotId,
      slotInfo,
      sessionInfo: {
        id: session.id,
        status: session.status,
        createdAt: session.createdAt,
        lastActivity: session.lastActivity,
        expiresAt: session.expiresAt
      }
    };
  }

  async handleIframeReady({ sessionId, payload }) {
    const session = this.getIframeSession(sessionId);
    
    if (!session) {
      return { success: false, error: 'Session not found' };
    }
    
    // Update session state
    session.status = 'active';
    session.iframeReadyAt = Date.now();
    session.iframeInfo = payload;
    
    this.emit('iframeReady', {
      sessionId,
      userId: session.userId,
      slotId: session.slotId,
      iframeInfo: payload,
      timestamp: session.iframeReadyAt
    });
    
    return { success: true, sessionId };
  }

  async handleIframeError({ sessionId, payload }) {
    this.handleIframeError(sessionId, payload);
    return { success: true, sessionId };
  }

  async handleUserActivity({ sessionId, payload }) {
    const session = this.getIframeSession(sessionId);
    
    if (!session) {
      return { success: false, error: 'Session not found' };
    }
    
    // Update activity
    session.lastActivity = Date.now();
    session.activityLog = session.activityLog || [];
    session.activityLog.push({
      type: payload.type,
      timestamp: Date.now(),
      data: payload.data
    });
    
    // Extend session if needed
    if (this.config.enableAutoRefresh) {
      const timeUntilExpiry = session.expiresAt - Date.now();
      if (timeUntilExpiry < this.config.refreshInterval) {
        await this.refreshIframeSession(sessionId);
      }
    }
    
    return { success: true, sessionId };
  }

  /**
   * Event handlers
   */
  handleSlotCreated(data) {
    console.log(`🎰 Slot created event: ${data.slotId}`);
    this.emit('slotCreated', data);
  }

  handleSlotTerminated(data) {
    console.log(`🗑️ Slot terminated event: ${data.slotId}`);
    
    // Terminate all iframe sessions for this slot
    const sessionsToTerminate = [];
    for (const [sessionId, session] of this.iframeSessions) {
      if (session.slotId === data.slotId) {
        sessionsToTerminate.push(sessionId);
      }
    }
    
    sessionsToTerminate.forEach(sessionId => {
      this.terminateIframeSession(sessionId, 'slot_terminated');
    });
    
    this.emit('slotTerminated', data);
  }

  handleSessionExpired(data) {
    console.log(`⏰ Session expired event: ${data.userId}`);
    
    // Terminate all iframe sessions for this user
    const userSessions = this.getUserIframes(data.userId);
    userSessions.forEach(session => {
      this.terminateIframeSession(session.id, 'session_expired');
    });
    
    this.emit('sessionExpired', data);
  }

  handleSessionRefreshed(data) {
    console.log(`🔄 Session refreshed event: ${data.userId}`);
    this.emit('sessionRefreshed', data);
  }

  handleUserSessionUpdated(data) {
    console.log(`👤 User session updated event: ${data.userId}`);
    this.emit('userSessionUpdated', data);
  }

  handleSessionRestored(data) {
    console.log(`🔄 Session restored event: ${data.sessionId}`);
    this.emit('sessionRestored', data);
  }

  /**
   * Utility methods
   */
  generateUrlSignature(slotId, userId, timestamp, nonce) {
    const data = `${slotId}:${userId}:${timestamp}:${nonce}`;
    return crypto.createHmac('sha256', this.config.secretKey || 'default-secret')
      .update(data)
      .digest('hex');
  }

  checkRateLimit(userId) {
    const now = Date.now();
    const windowStart = now - 60000; // 1 minute window
    
    let requestCount = 0;
    for (const session of this.iframeSessions.values()) {
      if (session.userId === userId && session.createdAt > windowStart) {
        requestCount++;
      }
    }
    
    return requestCount < this.config.maxRequestsPerMinute;
  }

  cleanupExpiredSessions() {
    const now = Date.now();
    const expiredSessions = [];
    
    for (const [sessionId, session] of this.iframeSessions) {
      if (now > session.expiresAt) {
        expiredSessions.push(sessionId);
      }
    }
    
    expiredSessions.forEach(sessionId => {
      this.terminateIframeSession(sessionId, 'session_expired');
    });
    
    if (expiredSessions.length > 0) {
      console.log(`🧹 Cleaned up ${expiredSessions.length} expired sessions`);
    }
  }

  refreshActiveSessions() {
    const now = Date.now();
    const refreshThreshold = now + this.config.refreshInterval;
    
    for (const [sessionId, session] of this.iframeSessions) {
      if (session.expiresAt < refreshThreshold && session.status === 'active') {
        this.refreshIframeSession(sessionId);
      }
    }
  }

  updateMetrics(metric, value) {
    if (!this.config.enableMetrics) return;
    
    const current = this.metrics.get(metric) || 0;
    this.metrics.set(metric, current + value);
  }

  collectMetrics() {
    if (!this.config.enableMetrics) return;
    
    const metrics = {
      service: 'iframe-integration',
      timestamp: Date.now(),
      uptime: Date.now() - this.startTime,
      activeSessions: this.iframeSessions.size,
      totalSessionsCreated: this.totalIframesCreated,
      totalSessionsTerminated: this.totalIframesTerminated,
      totalMessagesProcessed: this.totalMessagesProcessed,
      metrics: Object.fromEntries(this.metrics)
    };
    
    this.emit('metricsCollected', metrics);
    return metrics;
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      service: 'iframe-integration',
      isInitialized: this.isInitialized,
      isRunning: this.isRunning,
      startTime: this.startTime,
      uptime: this.startTime ? Date.now() - this.startTime : 0,
      config: this.config,
      sessions: {
        active: this.iframeSessions.size,
        totalCreated: this.totalIframesCreated,
        totalTerminated: this.totalIframesTerminated
      },
      messages: {
        totalProcessed: this.totalMessagesProcessed
      },
      services: {
        authService: this.authService?.isInitialized || false,
        slotManager: this.slotManager?.isInitialized || false,
        userManagement: this.userManagement?.isInitialized || false,
        sessionPersistence: this.sessionPersistence?.isInitialized || false
      },
      metrics: this.config.enableMetrics ? Object.fromEntries(this.metrics) : {}
    };
  }

  /**
   * Shutdown the service
   */
  async shutdown() {
    try {
      console.log('🛑 Shutting down Iframe Integration Service...');
      
      // Stop background processes
      if (this.cleanupIntervalId) {
        clearInterval(this.cleanupIntervalId);
      }
      
      if (this.refreshIntervalId) {
        clearInterval(this.refreshIntervalId);
      }
      
      if (this.metricsIntervalId) {
        clearInterval(this.metricsIntervalId);
      }
      
      // Terminate all active sessions
      const activeSessions = Array.from(this.iframeSessions.keys());
      await Promise.all(
        activeSessions.map(sessionId => 
          this.terminateIframeSession(sessionId, 'service_shutdown')
        )
      );
      
      // Shutdown service dependencies
      await Promise.all([
        this.authService?.shutdown(),
        this.slotManager?.shutdown(),
        this.userManagement?.shutdown(),
        this.sessionPersistence?.shutdown()
      ]);
      
      // Clear data structures
      this.iframeSessions.clear();
      this.userSessions.clear();
      this.slotUrls.clear();
      this.authTokens.clear();
      this.metrics.clear();
      this.messageHandlers.clear();
      
      this.isInitialized = false;
      this.isRunning = false;
      
      console.log('✅ Iframe Integration Service shutdown complete');
      this.emit('shutdown', { 
        service: 'iframe-integration',
        timestamp: Date.now()
      });
      
    } catch (error) {
      console.error('❌ Error during shutdown:', error);
      throw error;
    }
  }
}

export default IframeIntegrationService;