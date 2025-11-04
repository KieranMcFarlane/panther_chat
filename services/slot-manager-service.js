/**
 * Multi-User Slot Management Service
 * 
 * This service manages user slots, coordinates resource allocation,
 * and integrates all ClaudeBox services for multi-user operation.
 * 
 * Based on TICKET-006 requirements for Multi-User Slot Management
 */

import EventEmitter from 'events';
import { v4 as uuidv4 } from 'uuid';

class SlotManagerService extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      maxSlots: 50,                           // Maximum concurrent slots
      slotTimeout: 1800000,                   // Slot timeout (30 minutes)
      resourceLimits: {
        maxMemoryPerSlot: 512,               // MB per slot
        maxCpuPerSlot: 50,                   // CPU percentage per slot
        maxDiskPerSlot: 1024,                // MB per slot
        maxNetworkConnections: 100           // Connections per slot
      },
      healthCheckInterval: 30000,             // Health check interval (30 seconds)
      cleanupInterval: 300000,                // Cleanup interval (5 minutes)
      enableAutoScaling: true,                // Enable automatic slot scaling
      enableLoadBalancing: true,             // Enable load balancing
      monitoring: {
        enableMetrics: true,                 // Enable metrics collection
        enableAlerting: true,                // Enable alerting
        metricsRetention: 86400000           // Metrics retention (24 hours)
      },
      ...config
    };
    
    // Core data structures
    this.slots = new Map();                   // Active slots
    this.users = new Map();                  // User sessions
    this.resources = new Map();              // Resource usage tracking
    this.metrics = new Map();                // Performance metrics
    this.healthStatus = new Map();           // Service health status
    
    // Service references
    this.authService = null;
    this.ttydService = null;
    this.sshTunnelManager = null;
    this.healthMonitor = null;
    
    // State management
    this.isInitialized = false;
    this.isRunning = false;
    this.startTime = null;
    this.totalSlotsCreated = 0;
    this.totalSlotsTerminated = 0;
    
    // Intervals
    this.healthCheckIntervalId = null;
    this.cleanupIntervalId = null;
    this.metricsIntervalId = null;
  }

  /**
   * Initialize the Slot Manager Service
   */
  async initialize() {
    try {
      console.log('🎰 Initializing Multi-User Slot Manager Service...');
      
      // Initialize service dependencies
      await this.initializeServices();
      
      // Set up event listeners
      this.setupEventListeners();
      
      // Start background processes
      this.startBackgroundProcesses();
      
      this.isInitialized = true;
      this.startTime = new Date();
      
      console.log('✅ Multi-User Slot Manager Service initialized successfully');
      this.emit('initialized', {
        timestamp: this.startTime,
        config: this.config
      });
      
      return true;
      
    } catch (error) {
      console.error('❌ Failed to initialize Slot Manager Service:', error);
      throw error;
    }
  }

  /**
   * Initialize service dependencies
   */
  async initializeServices() {
    console.log('🔧 Initializing service dependencies...');
    
    // Import and initialize Enhanced Authentication Service
    try {
      const { default: EnhancedAuthService } = await import('./enhanced-auth-service.js');
      this.authService = new EnhancedAuthService({
        sessionTimeout: this.config.slotTimeout,
        maxConcurrentSessions: this.config.maxSlots,
        enableRateLimiting: true,
        enableIPTracking: true,
        enableDeviceFingerprinting: true
      });
      await this.authService.initialize();
      console.log('✅ Enhanced Authentication Service connected');
    } catch (error) {
      console.warn('⚠️ Enhanced Authentication Service not available:', error.message);
    }
    
    // Import and initialize TTYD Service
    try {
      const { default: TTYDService } = await import('./ttyd-service.js');
      this.ttydService = new TTYDService({
        sessionTimeout: this.config.slotTimeout,
        maxSessions: this.config.maxSlots,
        enableAuth: true,
        sshTunnelConfig: {
          host: process.env.SSH_HOST || '13.60.60.50',
          port: parseInt(process.env.SSH_PORT) || 22,
          keyPath: process.env.SSH_KEY_PATH || '/home/ec2-user/yellowpanther.pem',
          user: process.env.SSH_USER || 'ec2-user'
        }
      });
      await this.ttydService.initialize();
      console.log('✅ TTYD Service connected');
    } catch (error) {
      console.warn('⚠️ TTYD Service not available:', error.message);
    }
    
    // Import and initialize SSH Tunnel Manager
    try {
      const { default: SSHTunnelManager } = await import('./ssh-tunnel-manager.js');
      this.sshTunnelManager = new SSHTunnelManager();
      await this.sshTunnelManager.initialize();
      console.log('✅ SSH Tunnel Manager connected');
    } catch (error) {
      console.warn('⚠️ SSH Tunnel Manager not available:', error.message);
    }
    
    console.log('🔧 Service dependencies initialized');
  }

  /**
   * Set up event listeners for integrated services
   */
  setupEventListeners() {
    console.log('🔗 Setting up service event listeners...');
    
    // Authentication Service Events
    if (this.authService) {
      this.authService.on('userAuthenticated', (data) => {
        this.handleUserAuthenticated(data);
      });
      
      this.authService.on('sessionTerminated', (data) => {
        this.handleSessionTerminated(data);
      });
      
      this.authService.on('authenticationFailed', (data) => {
        this.handleAuthenticationFailed(data);
      });
    }
    
    // TTYD Service Events
    if (this.ttydService) {
      this.ttydService.on('sessionCreated', (data) => {
        this.handleTTYDSessionCreated(data);
      });
      
      this.ttydService.on('sessionTerminated', (data) => {
        this.handleTTYDSessionTerminated(data);
      });
      
      this.ttydService.on('tunnelCreated', (data) => {
        this.handleSSHTunnelCreated(data);
      });
    }
    
    // SSH Tunnel Manager Events
    if (this.sshTunnelManager) {
      this.sshTunnelManager.on('tunnelCreated', (data) => {
        this.handleSSHTunnelCreated(data);
      });
      
      this.sshTunnelManager.on('tunnelClosed', (data) => {
        this.handleSSHTunnelClosed(data);
      });
    }
    
    console.log('🔗 Service event listeners configured');
  }

  /**
   * Start background processes
   */
  startBackgroundProcesses() {
    console.log('⚡ Starting background processes...');
    
    // Health check interval
    this.healthCheckIntervalId = setInterval(() => {
      this.performHealthChecks();
    }, this.config.healthCheckInterval);
    
    // Cleanup interval
    this.cleanupIntervalId = setInterval(() => {
      this.performCleanup();
    }, this.config.cleanupInterval);
    
    // Metrics collection interval
    if (this.config.monitoring.enableMetrics) {
      this.metricsIntervalId = setInterval(() => {
        this.collectMetrics();
      }, 60000); // Collect metrics every minute
    }
    
    console.log('⚡ Background processes started');
  }

  /**
   * Create a new user slot
   */
  async createSlot(userId, options = {}) {
    try {
      if (!this.isInitialized) {
        throw new Error('Slot Manager Service not initialized');
      }
      
      // Check slot limits
      if (this.slots.size >= this.config.maxSlots) {
        throw new Error('Maximum slot limit reached');
      }
      
      // Check if user already has active slots
      const userSlots = Array.from(this.slots.values()).filter(slot => slot.userId === userId);
      if (userSlots.length >= 3) { // Max 3 slots per user
        throw new Error('Maximum slots per user exceeded');
      }
      
      // Generate slot ID
      const slotId = this.generateSlotId();
      
      // Create slot configuration
      const slotConfig = {
        slotId,
        userId,
        status: 'initializing',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + this.config.slotTimeout),
        resourceLimits: { ...this.config.resourceLimits, ...options.resourceLimits },
        permissions: options.permissions || ['create_sessions', 'manage_own_sessions'],
        metadata: {
          ...options.metadata,
          platform: 'claudebox-multi-slot',
          version: '1.0.0'
        }
      };
      
      // Initialize slot services
      const slotServices = await this.initializeSlotServices(slotConfig);
      
      // Create complete slot object
      const slot = {
        ...slotConfig,
        ...slotServices,
        status: 'active',
        lastActivity: new Date()
      };
      
      // Store slot
      this.slots.set(slotId, slot);
      
      // Update user slots
      if (!this.users.has(userId)) {
        this.users.set(userId, new Set());
      }
      this.users.get(userId).add(slotId);
      
      // Initialize resource tracking
      this.initializeResourceTracking(slotId);
      
      this.totalSlotsCreated++;
      
      console.log(`🎰 Slot ${slotId} created for user ${userId}`);
      
      this.emit('slotCreated', {
        slotId,
        userId,
        status: 'active',
        timestamp: new Date()
      });
      
      return {
        success: true,
        slotId,
        slot: this.getSlotInfo(slotId)
      };
      
    } catch (error) {
      console.error('❌ Failed to create slot:', error);
      throw error;
    }
  }

  /**
   * Initialize services for a slot
   */
  async initializeSlotServices(slotConfig) {
    const services = {};
    
    // Create authentication session for the slot
    if (this.authService) {
      try {
        const authSession = await this.authService.authenticateUser(
          { email: `${slotConfig.userId}@claudebox.local`, password: 'slot-auth' },
          'oauth2',
          {
            ipAddress: '127.0.0.1',
            userAgent: 'ClaudeBox-Slot-Manager',
            deviceFingerprint: `slot-${slotConfig.slotId}`
          }
        );
        services.authSession = authSession;
      } catch (error) {
        console.warn('⚠️ Failed to create auth session for slot:', error.message);
      }
    }
    
    // Create TTYD session for the slot
    if (this.ttydService) {
      try {
        const ttydSession = await this.ttydService.createSession({
          userId: slotConfig.userId,
          slotId: slotConfig.slotId,
          command: slotConfig.metadata.command || '/bin/bash',
          env: slotConfig.metadata.env || {}
        });
        services.ttydSession = ttydSession;
      } catch (error) {
        console.warn('⚠️ Failed to create TTYD session for slot:', error.message);
      }
    }
    
    // Create SSH tunnel for the slot
    if (this.sshTunnelManager) {
      try {
        const tunnelConfig = {
          localPort: this.getAvailablePort(),
          remoteHost: slotConfig.metadata.remoteHost || 'localhost',
          remotePort: slotConfig.metadata.remotePort || 22,
          userId: slotConfig.userId,
          slotId: slotConfig.slotId
        };
        
        const tunnel = await this.sshTunnelManager.createTunnel(tunnelConfig);
        services.sshTunnel = tunnel;
      } catch (error) {
        console.warn('⚠️ Failed to create SSH tunnel for slot:', error.message);
      }
    }
    
    return services;
  }

  /**
   * Check if slot exists
   */
  hasSlot(slotId) {
    return this.slots.has(slotId);
  }

  /**
   * Get slot information
   */
  getSlotInfo(slotId) {
    const slot = this.slots.get(slotId);
    if (!slot) {
      return null;
    }
    
    return {
      slotId: slot.slotId,
      userId: slot.userId,
      status: slot.status,
      createdAt: slot.createdAt,
      expiresAt: slot.expiresAt,
      lastActivity: slot.lastActivity,
      resourceUsage: this.resources.get(slotId) || {},
      services: {
        authSession: slot.authSession ? {
          sessionId: slot.authSession.sessionId,
          userId: slot.authSession.userId,
          role: slot.authSession.role
        } : null,
        ttydSession: slot.ttydSession ? {
          sessionId: slot.ttydSession.sessionId,
          port: slot.ttydSession.port,
          url: slot.ttydSession.url
        } : null,
        sshTunnel: slot.sshTunnel ? {
          tunnelId: slot.sshTunnel.tunnelId,
          localPort: slot.sshTunnel.localPort,
          remoteHost: slot.sshTunnel.remoteHost,
          remotePort: slot.sshTunnel.remotePort
        } : null
      },
      metadata: slot.metadata
    };
  }

  /**
   * Terminate a slot
   */
  async terminateSlot(slotId, reason = 'manual') {
    try {
      const slot = this.slots.get(slotId);
      if (!slot) {
        throw new Error('Slot not found');
      }
      
      console.log(`🛑 Terminating slot ${slotId} (${reason})`);
      
      // Terminate slot services
      await this.terminateSlotServices(slot);
      
      // Remove from user slots
      const userSlots = this.users.get(slot.userId);
      if (userSlots) {
        userSlots.delete(slotId);
        if (userSlots.size === 0) {
          this.users.delete(slot.userId);
        }
      }
      
      // Remove resource tracking
      this.resources.delete(slotId);
      
      // Remove slot
      this.slots.delete(slotId);
      
      this.totalSlotsTerminated++;
      
      this.emit('slotTerminated', {
        slotId,
        userId: slot.userId,
        reason,
        timestamp: new Date()
      });
      
      return { success: true };
      
    } catch (error) {
      console.error('❌ Failed to terminate slot:', error);
      throw error;
    }
  }

  /**
   * Terminate slot services
   */
  async terminateSlotServices(slot) {
    // Terminate TTYD session
    if (slot.ttydSession && this.ttydService) {
      try {
        await this.ttydService.terminateSession(slot.ttydSession.sessionId);
      } catch (error) {
        console.warn('⚠️ Failed to terminate TTYD session:', error.message);
      }
    }
    
    // Terminate authentication session
    if (slot.authSession && this.authService) {
      try {
        await this.authService.terminateSession(slot.authSession.sessionId, 'slot_terminated');
      } catch (error) {
        console.warn('⚠️ Failed to terminate auth session:', error.message);
      }
    }
    
    // Close SSH tunnel
    if (slot.sshTunnel && this.sshTunnelManager) {
      try {
        await this.sshTunnelManager.closeTunnel(slot.sshTunnel.tunnelId);
      } catch (error) {
        console.warn('⚠️ Failed to close SSH tunnel:', error.message);
      }
    }
  }

  /**
   * Perform health checks
   */
  async performHealthChecks() {
    const healthResults = {
      slotManager: { status: 'healthy', timestamp: new Date() },
      services: {},
      slots: {}
    };
    
    // Check service health
    if (this.authService) {
      try {
        const authStats = this.authService.getStats();
        healthResults.services.authService = { status: 'healthy', stats: authStats };
      } catch (error) {
        healthResults.services.authService = { status: 'unhealthy', error: error.message };
      }
    }
    
    if (this.ttydService) {
      try {
        const ttydStats = this.ttydService.getStats();
        healthResults.services.ttydService = { status: 'healthy', stats: ttydStats };
      } catch (error) {
        healthResults.services.ttydService = { status: 'unhealthy', error: error.message };
      }
    }
    
    if (this.sshTunnelManager) {
      try {
        const tunnelStats = this.sshTunnelManager.getStats();
        healthResults.services.sshTunnelManager = { status: 'healthy', stats: tunnelStats };
      } catch (error) {
        healthResults.services.sshTunnelManager = { status: 'unhealthy', error: error.message };
      }
    }
    
    // Check slot health
    for (const [slotId, slot] of this.slots.entries()) {
      try {
        const slotHealth = await this.checkSlotHealth(slot);
        healthResults.slots[slotId] = slotHealth;
      } catch (error) {
        healthResults.slots[slotId] = { status: 'unhealthy', error: error.message };
      }
    }
    
    // Store health status
    this.healthStatus.set('current', healthResults);
    
    // Emit health check event
    this.emit('healthCheck', healthResults);
  }

  /**
   * Check individual slot health
   */
  async checkSlotHealth(slot) {
    const health = {
      status: 'healthy',
      timestamp: new Date(),
      services: {}
    };
    
    // Check authentication session health
    if (slot.authSession && this.authService) {
      try {
        const validation = await this.authService.validateSession(slot.authSession.sessionId);
        health.services.authSession = validation.valid ? 'healthy' : 'unhealthy';
      } catch (error) {
        health.services.authSession = 'unhealthy';
      }
    }
    
    // Check TTYD session health
    if (slot.ttydSession && this.ttydService) {
      try {
        const ttydHealth = await this.ttydService.getSessionHealth(slot.ttydSession.sessionId);
        health.services.ttydSession = ttydHealth.status === 'active' ? 'healthy' : 'unhealthy';
      } catch (error) {
        health.services.ttydSession = 'unhealthy';
      }
    }
    
    // Check SSH tunnel health
    if (slot.sshTunnel && this.sshTunnelManager) {
      try {
        const tunnelHealth = await this.sshTunnelManager.getTunnelHealth(slot.sshTunnel.tunnelId);
        health.services.sshTunnel = tunnelHealth.status === 'active' ? 'healthy' : 'unhealthy';
      } catch (error) {
        health.services.sshTunnel = 'unhealthy';
      }
    }
    
    // Determine overall health
    const unhealthyServices = Object.values(health.services).filter(status => status === 'unhealthy');
    if (unhealthyServices.length > 0) {
      health.status = 'degraded';
    }
    
    return health;
  }

  /**
   * Perform cleanup operations
   */
  async performCleanup() {
    console.log('🧹 Performing slot cleanup...');
    
    const now = new Date();
    const expiredSlots = [];
    const inactiveSlots = [];
    
    // Find expired and inactive slots
    for (const [slotId, slot] of this.slots.entries()) {
      if (now > slot.expiresAt) {
        expiredSlots.push(slotId);
      } else if (now - slot.lastActivity > this.config.slotTimeout / 2) {
        inactiveSlots.push(slotId);
      }
    }
    
    // Clean up expired slots
    for (const slotId of expiredSlots) {
      try {
        await this.terminateSlot(slotId, 'expired');
        console.log(`🧹 Cleaned up expired slot ${slotId}`);
      } catch (error) {
        console.error(`❌ Failed to clean up expired slot ${slotId}:`, error);
      }
    }
    
    // Clean up old metrics
    if (this.config.monitoring.enableMetrics) {
      const cutoffTime = new Date(now - this.config.monitoring.metricsRetention);
      for (const [key, metrics] of this.metrics.entries()) {
        const filteredMetrics = metrics.filter(m => new Date(m.timestamp) > cutoffTime);
        this.metrics.set(key, filteredMetrics);
      }
    }
    
    console.log(`🧹 Cleanup completed: ${expiredSlots.length} expired slots removed`);
  }

  /**
   * Collect performance metrics
   */
  collectMetrics() {
    const now = new Date();
    const metrics = {
      timestamp: now,
      slots: {
        total: this.slots.size,
        active: Array.from(this.slots.values()).filter(s => s.status === 'active').length,
        expired: Array.from(this.slots.values()).filter(s => s.status === 'expired').length
      },
      users: this.users.size,
      resources: {
        totalMemory: Array.from(this.resources.values()).reduce((sum, r) => sum + (r.memory || 0), 0),
        totalCpu: Array.from(this.resources.values()).reduce((sum, r) => sum + (r.cpu || 0), 0),
        totalDisk: Array.from(this.resources.values()).reduce((sum, r) => sum + (r.disk || 0), 0)
      },
      performance: {
        uptime: now - this.startTime,
        totalSlotsCreated: this.totalSlotsCreated,
        totalSlotsTerminated: this.totalSlotsTerminated,
        successRate: this.totalSlotsCreated > 0 ? 
          ((this.totalSlotsCreated - this.totalSlotsTerminated) / this.totalSlotsCreated * 100).toFixed(2) : 100
      }
    };
    
    // Store metrics
    if (!this.metrics.has('system')) {
      this.metrics.set('system', []);
    }
    this.metrics.get('system').push(metrics);
    
    // Emit metrics event
    this.emit('metrics', metrics);
  }

  /**
   * Initialize resource tracking for a slot
   */
  initializeResourceTracking(slotId) {
    this.resources.set(slotId, {
      memory: 0,
      cpu: 0,
      disk: 0,
      network: 0,
      startTime: new Date()
    });
  }

  /**
   * Get system statistics
   */
  getStats() {
    return {
      isRunning: this.isRunning,
      isInitialized: this.isInitialized,
      uptime: this.startTime ? new Date() - this.startTime : 0,
      totalSlots: this.slots.size,
      activeUsers: this.users.size,
      totalSlotsCreated: this.totalSlotsCreated,
      totalSlotsTerminated: this.totalSlotsTerminated,
      config: this.config,
      healthStatus: this.healthStatus.get('current'),
      latestMetrics: this.metrics.get('system') ? 
        this.metrics.get('system')[this.metrics.get('system').length - 1] : null
    };
  }

  /**
   * Get all slots
   */
  getAllSlots() {
    return Array.from(this.slots.keys()).map(slotId => this.getSlotInfo(slotId));
  }

  /**
   * Get user slots
   */
  getUserSlots(userId) {
    const userSlotIds = this.users.get(userId) || new Set();
    return Array.from(userSlotIds).map(slotId => this.getSlotInfo(slotId));
  }

  /**
   * Event Handlers
   */
  handleUserAuthenticated(data) {
    console.log(`🔐 User authenticated: ${data.userId}`);
    this.emit('userActivity', {
      userId: data.userId,
      sessionId: data.sessionId,
      activity: 'authentication',
      timestamp: new Date()
    });
  }

  handleSessionTerminated(data) {
    console.log(`🔓 Session terminated: ${data.sessionId}`);
    this.emit('userActivity', {
      userId: data.userId,
      sessionId: data.sessionId,
      activity: 'session_termination',
      timestamp: new Date()
    });
  }

  handleAuthenticationFailed(data) {
    console.log(`❌ Authentication failed: ${data.provider}`);
    this.emit('securityEvent', {
      type: 'authentication_failed',
      data,
      timestamp: new Date()
    });
  }

  handleTTYDSessionCreated(data) {
    console.log(`💻 TTYD session created: ${data.sessionId}`);
    this.emit('serviceEvent', {
      service: 'ttyd',
      event: 'session_created',
      data,
      timestamp: new Date()
    });
  }

  handleTTYDSessionTerminated(data) {
    console.log(`💻 TTYD session terminated: ${data.sessionId}`);
    this.emit('serviceEvent', {
      service: 'ttyd',
      event: 'session_terminated',
      data,
      timestamp: new Date()
    });
  }

  handleSSHTunnelCreated(data) {
    console.log(`🔗 SSH tunnel created: ${data.tunnelId}`);
    this.emit('serviceEvent', {
      service: 'ssh',
      event: 'tunnel_created',
      data,
      timestamp: new Date()
    });
  }

  handleSSHTunnelClosed(data) {
    console.log(`🔗 SSH tunnel closed: ${data.tunnelId}`);
    this.emit('serviceEvent', {
      service: 'ssh',
      event: 'tunnel_closed',
      data,
      timestamp: new Date()
    });
  }

  /**
   * Utility methods
   */
  generateSlotId() {
    return `slot_${uuidv4()}`;
  }

  getAvailablePort() {
    const usedPorts = Array.from(this.slots.values())
      .map(slot => slot.sshTunnel?.localPort)
      .filter(port => port);
    
    let port = 8000;
    while (usedPorts.includes(port)) {
      port++;
    }
    return port;
  }

  /**
   * Shutdown the service
   */
  async shutdown() {
    console.log('🛑 Shutting down Multi-User Slot Manager Service...');
    
    this.isRunning = false;
    
    // Clear intervals
    if (this.healthCheckIntervalId) {
      clearInterval(this.healthCheckIntervalId);
    }
    if (this.cleanupIntervalId) {
      clearInterval(this.cleanupIntervalId);
    }
    if (this.metricsIntervalId) {
      clearInterval(this.metricsIntervalId);
    }
    
    // Terminate all slots
    const terminatePromises = Array.from(this.slots.keys()).map(slotId => 
      this.terminateSlot(slotId, 'shutdown').catch(error => {
        console.error(`❌ Error terminating slot ${slotId}:`, error);
      })
    );
    
    await Promise.all(terminatePromises);
    
    // Shutdown services
    if (this.authService) {
      await this.authService.shutdown().catch(error => {
        console.error('❌ Error shutting down auth service:', error);
      });
    }
    
    if (this.ttydService) {
      await this.ttydService.shutdown().catch(error => {
        console.error('❌ Error shutting down TTYD service:', error);
      });
    }
    
    if (this.sshTunnelManager) {
      await this.sshTunnelManager.shutdown().catch(error => {
        console.error('❌ Error shutting down SSH tunnel manager:', error);
      });
    }
    
    console.log('✅ Multi-User Slot Manager Service shutdown complete');
  }
}

// Export for use in other modules
export default SlotManagerService;