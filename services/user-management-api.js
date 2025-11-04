/**
 * Enhanced User Management API with Better Auth Integration
 * 
 * Complete implementation of TICKET-009 requirements:
 * - User registration and management endpoints
 * - Slot assignment and management endpoints  
 * - Authentication status endpoints with Better Auth
 * - Usage statistics endpoints
 * - Better Auth session management
 * 
 * This provides comprehensive API endpoints for the ClaudeBox Multi-Slot system
 */

import EventEmitter from 'events';
import { v4 as uuidv4 } from 'uuid';
import UserManagementService from './user-management-service.js';
import EnhancedAuthService from './enhanced-auth-service.js';
import SlotManagerService from './slot-manager-service.js';

class UserManagementAPI extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      apiVersion: 'v1',
      enableRateLimiting: true,
      enableCORS: true,
      enableRequestLogging: true,
      maxRequestsPerMinute: 60,
      sessionTimeout: 3600000, // 1 hour
      enableMetrics: true,
      ...config
    };
    
    // Service instances
    this.userService = null;
    this.authService = null;
    this.slotManager = null;
    
    // API state
    this.isInitialized = false;
    this.requestCount = 0;
    this.activeSessions = new Map();
    this.apiMetrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      endpoints: new Map()
    };
    
    // Rate limiting
    this.rateLimitStore = new Map();
  }

  /**
   * Initialize the User Management API
   */
  async initialize() {
    try {
      console.log('🚀 Initializing User Management API...');
      
      // Initialize services
      this.userService = new UserManagementService(this.config.userService || {});
      await this.userService.initialize();
      console.log('✅ User Management Service connected');
      
      this.authService = new EnhancedAuthService(this.config.authService || {});
      await this.authService.initialize();
      console.log('✅ Enhanced Auth Service connected');
      
      this.slotManager = new SlotManagerService(this.config.slotManager || {});
      await this.slotManager.initialize();
      console.log('✅ Slot Manager Service connected');
      
      // Setup event listeners
      this.setupEventListeners();
      
      this.isInitialized = true;
      console.log('✅ User Management API initialized successfully');
      
      this.emit('initialized', {
        timestamp: new Date(),
        config: this.config
      });
      
      return true;
      
    } catch (error) {
      console.error('❌ Failed to initialize User Management API:', error);
      throw error;
    }
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // User events
    this.userService.on('userRegistered', (data) => {
      this.emit('userRegistered', data);
      this.logMetric('userRegistered', data);
    });
    
    this.userService.on('userLoggedIn', (data) => {
      this.emit('userLoggedIn', data);
      this.logMetric('userLoggedIn', data);
    });
    
    this.userService.on('userActivity', (data) => {
      this.emit('userActivity', data);
      this.logMetric('userActivity', data);
    });
    
    // Auth events
    this.authService.on('userAuthenticated', (data) => {
      this.emit('userAuthenticated', data);
      this.logMetric('userAuthenticated', data);
    });
    
    this.authService.on('authenticationFailed', (data) => {
      this.emit('authenticationFailed', data);
      this.logMetric('authenticationFailed', data);
    });
    
    // Slot events
    this.slotManager.on('slotCreated', (data) => {
      this.emit('slotCreated', data);
      this.logMetric('slotCreated', data);
    });
    
    this.slotManager.on('slotTerminated', (data) => {
      this.emit('slotTerminated', data);
      this.logMetric('slotTerminated', data);
    });
  }

  /**
   * User Management Endpoints
   */

  /**
   * Register new user with Better Auth integration
   */
  async registerUser(userData, authProvider = 'oauth2', options = {}) {
    const startTime = Date.now();
    this.requestCount++;
    
    try {
      // Rate limiting check
      if (options.ipAddress) {
        await this.checkRateLimit(`register:${options.ipAddress}`);
      }
      
      const result = await this.userService.registerUser(userData, authProvider, options);
      
      this.logMetric('registerUser', { success: true, duration: Date.now() - startTime });
      return result;
      
    } catch (error) {
      this.logMetric('registerUser', { success: false, duration: Date.now() - startTime, error: error.message });
      throw error;
    }
  }

  /**
   * User login with Better Auth integration
   */
  async loginUser(credentials, authProvider, options = {}) {
    const startTime = Date.now();
    this.requestCount++;
    
    try {
      const result = await this.userService.loginUser(credentials, authProvider, options);
      
      if (result.success) {
        // Track active session
        this.activeSessions.set(result.authSession.sessionId, {
          userId: result.userId,
          createdAt: new Date(),
          lastActivity: new Date(),
          authProvider
        });
      }
      
      this.logMetric('loginUser', { success: true, duration: Date.now() - startTime });
      return result;
      
    } catch (error) {
      this.logMetric('loginUser', { success: false, duration: Date.now() - startTime, error: error.message });
      throw error;
    }
  }

  /**
   * Get user profile with Better Auth validation
   */
  async getUserProfile(userId, sessionId) {
    const startTime = Date.now();
    this.requestCount++;
    
    try {
      // Validate session with Better Auth
      if (sessionId) {
        const sessionValid = await this.authService.validateSession(sessionId);
        if (!sessionValid.valid) {
          throw new Error('Invalid session');
        }
      }
      
      const user = await this.userService.getUserById(userId);
      const profile = await this.userService.getUserProfile(userId);
      
      if (!user) {
        throw new Error('User not found');
      }
      
      this.logMetric('getUserProfile', { success: true, duration: Date.now() - startTime });
      return {
        user: this.userService.getSafeUserData(user),
        profile
      };
      
    } catch (error) {
      this.logMetric('getUserProfile', { success: false, duration: Date.now() - startTime, error: error.message });
      throw error;
    }
  }

  /**
   * Update user profile with Better Auth validation
   */
  async updateUserProfile(userId, profileData, sessionId) {
    const startTime = Date.now();
    this.requestCount++;
    
    try {
      // Validate session with Better Auth
      const sessionValid = await this.authService.validateSession(sessionId);
      if (!sessionValid.valid) {
        throw new Error('Invalid session');
      }
      
      // Check if user owns the profile
      const sessionUser = await this.getUserBySession(sessionId);
      if (sessionUser !== userId && !await this.isAdmin(sessionId)) {
        throw new Error('Unauthorized to update this profile');
      }
      
      const result = await this.userService.updateUserProfile(userId, profileData);
      
      this.logMetric('updateUserProfile', { success: true, duration: Date.now() - startTime });
      return result;
      
    } catch (error) {
      this.logMetric('updateUserProfile', { success: false, duration: Date.now() - startTime, error: error.message });
      throw error;
    }
  }

  /**
   * Slot Management Endpoints
   */

  /**
   * Create and assign slot to user with Better Auth validation
   */
  async createUserSlot(userId, slotConfig, sessionId) {
    const startTime = Date.now();
    this.requestCount++;
    
    try {
      // Validate session with Better Auth
      const sessionValid = await this.authService.validateSession(sessionId);
      if (!sessionValid.valid) {
        throw new Error('Invalid session');
      }
      
      // Check authorization
      const sessionUser = await this.getUserBySession(sessionId);
      if (sessionUser !== userId && !await this.isAdmin(sessionId)) {
        throw new Error('Unauthorized to create slot for this user');
      }
      
      // Create slot
      const slotResult = await this.slotManager.createSlot(userId, slotConfig);
      
      if (slotResult.success) {
        // Configure authentication for slot if provided
        if (slotConfig.auth) {
          await this.configureSlotAuth(slotResult.slotId, slotConfig.auth);
        }
      }
      
      this.logMetric('createUserSlot', { success: true, duration: Date.now() - startTime });
      return slotResult;
      
    } catch (error) {
      this.logMetric('createUserSlot', { success: false, duration: Date.now() - startTime, error: error.message });
      throw error;
    }
  }

  /**
   * Get user slots with Better Auth validation
   */
  async getUserSlots(userId, sessionId) {
    const startTime = Date.now();
    this.requestCount++;
    
    try {
      // Validate session with Better Auth
      const sessionValid = await this.authService.validateSession(sessionId);
      if (!sessionValid.valid) {
        throw new Error('Invalid session');
      }
      
      // Check authorization
      const sessionUser = await this.getUserBySession(sessionId);
      if (sessionUser !== userId && !await this.isAdmin(sessionId)) {
        throw new Error('Unauthorized to access user slots');
      }
      
      const slots = this.slotManager.getUserSlots(userId);
      
      this.logMetric('getUserSlots', { success: true, duration: Date.now() - startTime });
      return { userId, slots };
      
    } catch (error) {
      this.logMetric('getUserSlots', { success: false, duration: Date.now() - startTime, error: error.message });
      throw error;
    }
  }

  /**
   * Configure slot authentication
   */
  async configureSlotAuth(slotId, authConfig, sessionId) {
    const startTime = Date.now();
    this.requestCount++;
    
    try {
      // Validate session with Better Auth
      const sessionValid = await this.authService.validateSession(sessionId);
      if (!sessionValid.valid) {
        throw new Error('Invalid session');
      }
      
      // Check if user owns the slot or is admin
      const slot = this.slotManager.getSlotInfo(slotId);
      if (!slot) {
        throw new Error('Slot not found');
      }
      
      const sessionUser = await this.getUserBySession(sessionId);
      if (slot.userId !== sessionUser && !await this.isAdmin(sessionId)) {
        throw new Error('Unauthorized to configure this slot');
      }
      
      // Configure authentication with Better Auth
      const authResult = await this.authService.configureAuth(slotId, authConfig);
      
      this.logMetric('configureSlotAuth', { success: true, duration: Date.now() - startTime });
      return authResult;
      
    } catch (error) {
      this.logMetric('configureSlotAuth', { success: false, duration: Date.now() - startTime, error: error.message });
      throw error;
    }
  }

  /**
   * Authentication Status Endpoints
   */

  /**
   * Get authentication status with Better Auth
   */
  async getAuthStatus(userId, sessionId) {
    const startTime = Date.now();
    this.requestCount++;
    
    try {
      // Validate session with Better Auth
      const sessionValid = await this.authService.validateSession(sessionId);
      if (!sessionValid.valid) {
        throw new Error('Invalid session');
      }
      
      // Check authorization
      const sessionUser = await this.getUserBySession(sessionId);
      if (sessionUser !== userId && !await this.isAdmin(sessionId)) {
        throw new Error('Unauthorized to access auth status');
      }
      
      const authStatus = await this.authService.getAuthStatus(userId);
      const user = await this.userService.getUserById(userId);
      
      this.logMetric('getAuthStatus', { success: true, duration: Date.now() - startTime });
      return {
        userId,
        user: user ? this.userService.getSafeUserData(user) : null,
        authStatus,
        lastUpdated: new Date()
      };
      
    } catch (error) {
      this.logMetric('getAuthStatus', { success: false, duration: Date.now() - startTime, error: error.message });
      throw error;
    }
  }

  /**
   * Validate Better Auth session
   */
  async validateBetterAuthSession(sessionId) {
    const startTime = Date.now();
    this.requestCount++;
    
    try {
      const validation = await this.authService.validateSession(sessionId);
      
      // Update session activity
      if (validation.valid && this.activeSessions.has(sessionId)) {
        const session = this.activeSessions.get(sessionId);
        session.lastActivity = new Date();
        this.activeSessions.set(sessionId, session);
      }
      
      this.logMetric('validateBetterAuthSession', { success: true, duration: Date.now() - startTime });
      return validation;
      
    } catch (error) {
      this.logMetric('validateBetterAuthSession', { success: false, duration: Date.now() - startTime, error: error.message });
      throw error;
    }
  }

  /**
   * Refresh Better Auth session
   */
  async refreshBetterAuthSession(sessionId, refreshToken) {
    const startTime = Date.now();
    this.requestCount++;
    
    try {
      const result = await this.authService.refreshSession(sessionId, refreshToken);
      
      if (result.success) {
        // Update session activity
        if (this.activeSessions.has(sessionId)) {
          const session = this.activeSessions.get(sessionId);
          session.lastActivity = new Date();
          this.activeSessions.set(sessionId, session);
        }
      }
      
      this.logMetric('refreshBetterAuthSession', { success: true, duration: Date.now() - startTime });
      return result;
      
    } catch (error) {
      this.logMetric('refreshBetterAuthSession', { success: false, duration: Date.now() - startTime, error: error.message });
      throw error;
    }
  }

  /**
   * Usage Statistics Endpoints
   */

  /**
   * Get user usage statistics
   */
  async getUserUsageStats(userId, sessionId, period = '24h') {
    const startTime = Date.now();
    this.requestCount++;
    
    try {
      // Validate session with Better Auth
      const sessionValid = await this.authService.validateSession(sessionId);
      if (!sessionValid.valid) {
        throw new Error('Invalid session');
      }
      
      // Check authorization
      const sessionUser = await this.getUserBySession(sessionId);
      if (sessionUser !== userId && !await this.isAdmin(sessionId)) {
        throw new Error('Unauthorized to access user stats');
      }
      
      // Get user data
      const user = await this.userService.getUserById(userId);
      const userSlots = this.slotManager.getUserSlots(userId);
      const userActivity = await this.userService.getUserActivity(userId, 100);
      
      // Calculate usage metrics
      const now = new Date();
      const periodStart = this.getPeriodStart(period);
      
      const periodActivity = userActivity.filter(activity => 
        new Date(activity.timestamp) >= periodStart
      );
      
      const loginCount = periodActivity.filter(a => a.activity === 'login').length;
      const slotUsageCount = periodActivity.filter(a => a.activity.includes('slot')).length;
      
      const stats = {
        userId,
        period,
        user: user ? this.userService.getSafeUserData(user) : null,
        metrics: {
          totalLogins: loginCount,
          slotOperations: slotUsageCount,
          activeSlots: userSlots.filter(s => s.status === 'active').length,
          totalSlots: userSlots.length,
          lastActivity: userActivity.length > 0 ? userActivity[userActivity.length - 1].timestamp : null
        },
        slots: userSlots,
        recentActivity: periodActivity.slice(-10),
        generatedAt: new Date()
      };
      
      this.logMetric('getUserUsageStats', { success: true, duration: Date.now() - startTime });
      return stats;
      
    } catch (error) {
      this.logMetric('getUserUsageStats', { success: false, duration: Date.now() - startTime, error: error.message });
      throw error;
    }
  }

  /**
   * Get system-wide usage statistics (admin only)
   */
  async getSystemUsageStats(sessionId, period = '24h') {
    const startTime = Date.now();
    this.requestCount++;
    
    try {
      // Validate session with Better Auth
      const sessionValid = await this.authService.validateSession(sessionId);
      if (!sessionValid.valid) {
        throw new Error('Invalid session');
      }
      
      // Check admin authorization
      if (!await this.isAdmin(sessionId)) {
        throw new Error('Admin access required');
      }
      
      // Get system metrics
      const userStats = this.userService.getStats();
      const slotStats = this.slotManager.getStats();
      const authStats = this.authService.getStats();
      const apiStats = this.getAPIMetrics();
      
      // Calculate period-specific metrics
      const periodStart = this.getPeriodStart(period);
      
      const stats = {
        period,
        system: {
          uptime: process.uptime(),
          memoryUsage: process.memoryUsage(),
          cpuUsage: process.cpuUsage()
        },
        users: {
          ...userStats,
          activeUsers: this.activeSessions.size
        },
        slots: slotStats,
        authentication: authStats,
        api: apiStats,
        generatedAt: new Date()
      };
      
      this.logMetric('getSystemUsageStats', { success: true, duration: Date.now() - startTime });
      return stats;
      
    } catch (error) {
      this.logMetric('getSystemUsageStats', { success: false, duration: Date.now() - startTime, error: error.message });
      throw error;
    }
  }

  /**
   * Better Auth Session Management
   */

  /**
   * Get all active sessions for a user
   */
  async getUserSessions(userId, sessionId) {
    const startTime = Date.now();
    this.requestCount++;
    
    try {
      // Validate session with Better Auth
      const sessionValid = await this.authService.validateSession(sessionId);
      if (!sessionValid.valid) {
        throw new Error('Invalid session');
      }
      
      // Check authorization
      const sessionUser = await this.getUserBySession(sessionId);
      if (sessionUser !== userId && !await this.isAdmin(sessionId)) {
        throw new Error('Unauthorized to access user sessions');
      }
      
      const authSessions = await this.authService.getUserSessions(userId);
      const apiSessions = Array.from(this.activeSessions.entries())
        .filter(([_, session]) => session.userId === userId)
        .map(([sessionId, session]) => ({
          sessionId,
          ...session,
          source: 'api'
        }));
      
      this.logMetric('getUserSessions', { success: true, duration: Date.now() - startTime });
      return {
        userId,
        authSessions,
        apiSessions,
        totalSessions: authSessions.length + apiSessions.length
      };
      
    } catch (error) {
      this.logMetric('getUserSessions', { success: false, duration: Date.now() - startTime, error: error.message });
      throw error;
    }
  }

  /**
   * Terminate user session
   */
  async terminateUserSession(userId, sessionId, reason = 'user_request') {
    const startTime = Date.now();
    this.requestCount++;
    
    try {
      // Validate session with Better Auth
      const sessionValid = await this.authService.validateSession(sessionId);
      if (!sessionValid.valid) {
        throw new Error('Invalid session');
      }
      
      // Check authorization
      const sessionUser = await this.getUserBySession(sessionId);
      if (sessionUser !== userId && !await this.isAdmin(sessionId)) {
        throw new Error('Unauthorized to terminate user session');
      }
      
      // Terminate Better Auth session
      const authResult = await this.authService.terminateSession(sessionId, reason);
      
      // Remove from API sessions
      this.activeSessions.delete(sessionId);
      
      this.logMetric('terminateUserSession', { success: true, duration: Date.now() - startTime });
      return {
        success: true,
        userId,
        sessionId,
        reason,
        terminatedAt: new Date(),
        authResult
      };
      
    } catch (error) {
      this.logMetric('terminateUserSession', { success: false, duration: Date.now() - startTime, error: error.message });
      throw error;
    }
  }

  /**
   * Utility Methods
   */

  /**
   * Check rate limit
   */
  async checkRateLimit(key) {
    if (!this.config.enableRateLimiting) return;
    
    const now = Date.now();
    const windowMs = 60000; // 1 minute
    const maxRequests = this.config.maxRequestsPerMinute;
    
    const data = this.rateLimitStore.get(key) || {
      count: 0,
      resetTime: now + windowMs
    };
    
    if (now > data.resetTime) {
      data.count = 0;
      data.resetTime = now + windowMs;
    }
    
    data.count++;
    
    if (data.count > maxRequests) {
      throw new Error('Rate limit exceeded. Please try again later.');
    }
    
    this.rateLimitStore.set(key, data);
  }

  /**
   * Get user by session
   */
  async getUserBySession(sessionId) {
    const session = this.activeSessions.get(sessionId);
    return session ? session.userId : null;
  }

  /**
   * Check if user is admin
   */
  async isAdmin(sessionId) {
    try {
      const userId = await this.getUserBySession(sessionId);
      if (!userId) return false;
      
      const user = await this.userService.getUserById(userId);
      return user && user.role === 'ADMIN';
    } catch (error) {
      return false;
    }
  }

  /**
   * Get period start date
   */
  getPeriodStart(period) {
    const now = new Date();
    switch (period) {
      case '1h':
        return new Date(now.getTime() - 60 * 60 * 1000);
      case '24h':
        return new Date(now.getTime() - 24 * 60 * 60 * 1000);
      case '7d':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case '30d':
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      default:
        return new Date(now.getTime() - 24 * 60 * 60 * 1000); // Default to 24h
    }
  }

  /**
   * Log API metrics
   */
  logMetric(endpoint, data) {
    if (!this.config.enableMetrics) return;
    
    this.apiMetrics.totalRequests++;
    
    if (data.success) {
      this.apiMetrics.successfulRequests++;
    } else {
      this.apiMetrics.failedRequests++;
    }
    
    // Update endpoint-specific metrics
    if (!this.apiMetrics.endpoints.has(endpoint)) {
      this.apiMetrics.endpoints.set(endpoint, {
        calls: 0,
        successes: 0,
        failures: 0,
        totalDuration: 0,
        averageDuration: 0
      });
    }
    
    const endpointMetrics = this.apiMetrics.endpoints.get(endpoint);
    endpointMetrics.calls++;
    endpointMetrics.totalDuration += data.duration;
    
    if (data.success) {
      endpointMetrics.successes++;
    } else {
      endpointMetrics.failures++;
    }
    
    endpointMetrics.averageDuration = endpointMetrics.totalDuration / endpointMetrics.calls;
    
    // Calculate overall average response time
    const totalDuration = Array.from(this.apiMetrics.endpoints.values())
      .reduce((sum, metrics) => sum + metrics.totalDuration, 0);
    this.apiMetrics.averageResponseTime = totalDuration / this.apiMetrics.totalRequests;
  }

  /**
   * Get API metrics
   */
  getAPIMetrics() {
    return {
      ...this.apiMetrics,
      activeSessions: this.activeSessions.size,
      rateLimitStoreSize: this.rateLimitStore.size,
      endpoints: Object.fromEntries(this.apiMetrics.endpoints.entries())
    };
  }

  /**
   * Get API status
   */
  getStatus() {
    return {
      isInitialized: this.isInitialized,
      requestCount: this.requestCount,
      activeSessions: this.activeSessions.size,
      rateLimitStoreSize: this.rateLimitStore.size,
      services: {
        userService: this.userService ? this.userService.getStats() : null,
        authService: this.authService ? this.authService.getStats() : null,
        slotManager: this.slotManager ? this.slotManager.getStats() : null
      },
      metrics: this.getAPIMetrics(),
      config: this.config
    };
  }

  /**
   * Shutdown the API
   */
  async shutdown() {
    console.log('🛑 Shutting down User Management API...');
    
    // Shutdown services
    if (this.userService) {
      await this.userService.shutdown();
    }
    
    if (this.authService) {
      await this.authService.shutdown();
    }
    
    if (this.slotManager) {
      await this.slotManager.shutdown();
    }
    
    // Clear data
    this.activeSessions.clear();
    this.rateLimitStore.clear();
    
    console.log('✅ User Management API shutdown complete');
  }
}

// Export for use in other modules
export default UserManagementAPI;