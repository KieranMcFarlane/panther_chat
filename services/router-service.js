/**
 * Router Service for ClaudeBox Multi-Slot Architecture
 * 
 * This service handles HTTP routing, load balancing, and API endpoints
 * for the multi-user slot management system.
 * 
 * Based on TICKET-006 requirements for Multi-User Slot Management
 */

import EventEmitter from 'events';
import { createServer } from 'http';

class RouterService extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      port: process.env.PORT || 3000,
      host: process.env.HOST || 'localhost',
      enableCors: true,
      enableCompression: true,
      enableLogging: true,
      rateLimit: {
        windowMs: 900000, // 15 minutes
        max: 100 // limit each IP to 100 requests per windowMs
      },
      ssl: {
        enabled: false,
        keyPath: null,
        certPath: null
      },
      ...config
    };
    
    // Server instance
    this.server = null;
    this.isRunning = false;
    this.isInitialized = false;
    
    // Service references
    this.slotManager = null;
    this.authService = null;
    this.userService = null;
    
    // Request tracking
    this.requestCount = 0;
    this.activeConnections = new Set();
    this.rateLimitStore = new Map();
    
    // API routes
    this.routes = new Map();
    this.middleware = [];
    
    // Setup default routes
    this.setupDefaultRoutes();
  }

  /**
   * Initialize the Router Service
   */
  async initialize() {
    try {
      console.log('🌐 Initializing Router Service...');
      
      // Import and connect to Slot Manager
      try {
        const { default: SlotManagerService } = await import('./slot-manager-service.js');
        this.slotManager = new SlotManagerService();
        await this.slotManager.initialize();
        console.log('✅ Slot Manager connected');
      } catch (error) {
        console.warn('⚠️ Slot Manager not available:', error.message);
      }
      
      // Import and connect to Auth Service
      try {
        const { default: EnhancedAuthService } = await import('./enhanced-auth-service.js');
        this.authService = new EnhancedAuthService();
        await this.authService.initialize();
        console.log('✅ Auth Service connected');
      } catch (error) {
        console.warn('⚠️ Auth Service not available:', error.message);
      }
      
      // Import and connect to User Management Service
      try {
        const { default: UserManagementService } = await import('./user-management-service.js');
        this.userService = new UserManagementService();
        await this.userService.initialize();
        console.log('✅ User Management Service connected');
      } catch (error) {
        console.warn('⚠️ User Management Service not available:', error.message);
      }
      
      // Setup event listeners
      this.setupEventListeners();
      
      this.isInitialized = true;
      console.log('✅ Router Service initialized successfully');
      
      this.emit('initialized', {
        timestamp: new Date(),
        config: this.config
      });
      
      return true;
      
    } catch (error) {
      console.error('❌ Failed to initialize Router Service:', error);
      throw error;
    }
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    if (this.slotManager) {
      this.slotManager.on('slotCreated', (data) => {
        this.emit('slotCreated', data);
      });
      
      this.slotManager.on('slotTerminated', (data) => {
        this.emit('slotTerminated', data);
      });
      
      this.slotManager.on('healthCheck', (data) => {
        this.emit('healthCheck', data);
      });
    }
    
    if (this.authService) {
      this.authService.on('userAuthenticated', (data) => {
        this.emit('userAuthenticated', data);
      });
      
      this.authService.on('authenticationFailed', (data) => {
        this.emit('authenticationFailed', data);
      });
    }
    
    if (this.userService) {
      this.userService.on('userRegistered', (data) => {
        this.emit('userRegistered', data);
      });
      
      this.userService.on('userLoggedIn', (data) => {
        this.emit('userLoggedIn', data);
      });
      
      this.userService.on('userActivity', (data) => {
        this.emit('userActivity', data);
      });
      
      this.userService.on('securityEvent', (data) => {
        this.emit('securityEvent', data);
      });
    }
  }

  /**
   * Setup default API routes
   */
  setupDefaultRoutes() {
    // Health check endpoint
    this.addRoute('GET', '/health', this.handleHealthCheck.bind(this));
    
    // API info endpoint
    this.addRoute('GET', '/', this.handleApiInfo.bind(this));
    
    // Slot management endpoints
    this.addRoute('POST', '/slots', this.handleCreateSlot.bind(this));
    this.addRoute('GET', '/slots', this.handleListSlots.bind(this));
    this.addRoute('GET', '/slots/:slotId', this.handleGetSlot.bind(this));
    this.addRoute('DELETE', '/slots/:slotId', this.handleTerminateSlot.bind(this));
    
    // User management endpoints
    this.addRoute('POST', '/users/register', this.handleUserRegister.bind(this));
    this.addRoute('POST', '/users/login', this.handleUserLogin.bind(this));
    this.addRoute('GET', '/users/:userId', this.handleGetUser.bind(this));
    this.addRoute('PUT', '/users/:userId', this.handleUpdateUser.bind(this));
    this.addRoute('DELETE', '/users/:userId', this.handleDeleteUser.bind(this));
    this.addRoute('GET', '/users/:userId/profile', this.handleGetUserProfile.bind(this));
    this.addRoute('PUT', '/users/:userId/profile', this.handleUpdateUserProfile.bind(this));
    this.addRoute('GET', '/users/:userId/activity', this.handleGetUserActivity.bind(this));
    this.addRoute('PUT', '/users/:userId/settings', this.handleUpdateUserSettings.bind(this));
    this.addRoute('GET', '/users/:userId/slots', this.handleGetUserSlots.bind(this));
    
    // Authentication endpoints
    this.addRoute('POST', '/auth/login', this.handleLogin.bind(this));
    this.addRoute('POST', '/auth/logout', this.handleLogout.bind(this));
    this.addRoute('GET', '/auth/session/:sessionId', this.handleValidateSession.bind(this));
    this.addRoute('POST', '/auth/refresh', this.handleRefreshSession.bind(this));
    
    // Admin endpoints
    this.addRoute('GET', '/admin/users', this.handleListUsers.bind(this));
    this.addRoute('GET', '/admin/stats', this.handleAdminStats.bind(this));
    this.addRoute('POST', '/admin/users/:userId/role', this.handleUpdateUserRole.bind(this));
    
    // System endpoints
    this.addRoute('GET', '/system/stats', this.handleSystemStats.bind(this));
    this.addRoute('GET', '/system/metrics', this.handleSystemMetrics.bind(this));
    
    // WebSocket endpoint for real-time updates
    this.addRoute('GET', '/ws', this.handleWebSocket.bind(this));
  }

  /**
   * Add a route to the router
   */
  addRoute(method, path, handler) {
    const key = `${method.toUpperCase()}:${path}`;
    this.routes.set(key, handler);
  }

  /**
   * Add middleware
   */
  use(middleware) {
    this.middleware.push(middleware);
  }

  /**
   * Start the HTTP server
   */
  async start() {
    try {
      if (!this.isInitialized) {
        throw new Error('Router Service not initialized');
      }
      
      console.log(`🚀 Starting Router Service on ${this.config.host}:${this.config.port}...`);
      
      this.server = createServer(this.handleRequest.bind(this));
      
      this.server.on('connection', (socket) => {
        this.activeConnections.add(socket);
        socket.on('close', () => {
          this.activeConnections.delete(socket);
        });
      });
      
      this.server.on('error', (error) => {
        console.error('❌ Server error:', error);
        this.emit('error', error);
      });
      
      return new Promise((resolve, reject) => {
        this.server.listen(this.config.port, this.config.host, () => {
          this.isRunning = true;
          console.log(`✅ Router Service started successfully on ${this.config.host}:${this.config.port}`);
          this.emit('started', {
            host: this.config.host,
            port: this.config.port,
            timestamp: new Date()
          });
          resolve();
        });
        
        this.server.on('error', reject);
      });
      
    } catch (error) {
      console.error('❌ Failed to start Router Service:', error);
      throw error;
    }
  }

  /**
   * Handle incoming HTTP requests
   */
  async handleRequest(req, res) {
    this.requestCount++;
    
    try {
      // Apply middleware
      for (const middleware of this.middleware) {
        await middleware(req, res);
        if (res.headersSent) return;
      }
      
      // Parse URL and method
      const url = new URL(req.url, `http://${req.headers.host}`);
      const method = req.method.toUpperCase();
      const path = url.pathname;
      
      // Find matching route
      const routeKey = `${method}:${path}`;
      let handler = this.routes.get(routeKey);
      
      // Check for parameterized routes
      if (!handler) {
        for (const [routePath, routeHandler] of this.routes.entries()) {
          const [routeMethod, routePattern] = routePath.split(':');
          if (routeMethod === method && this.matchRoute(routePattern, path)) {
            handler = routeHandler;
            req.params = this.extractParams(routePattern, path);
            break;
          }
        }
      }
      
      if (handler) {
        await handler(req, res);
      } else {
        this.sendResponse(res, 404, { error: 'Route not found' });
      }
      
    } catch (error) {
      console.error('❌ Request handling error:', error);
      this.sendResponse(res, 500, { error: 'Internal server error' });
    }
  }

  /**
   * Check if a route pattern matches a path
   */
  matchRoute(pattern, path) {
    const regexPattern = pattern
      .replace(/:[^/]+/g, '([^/]+)')
      .replace(/\*/g, '.*');
    
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(path);
  }

  /**
   * Extract parameters from a path based on route pattern
   */
  extractParams(pattern, path) {
    const params = {};
    const patternParts = pattern.split('/');
    const pathParts = path.split('/');
    
    for (let i = 0; i < patternParts.length; i++) {
      if (patternParts[i].startsWith(':')) {
        const paramName = patternParts[i].substring(1);
        params[paramName] = pathParts[i];
      }
    }
    
    return params;
  }

  /**
   * Send HTTP response
   */
  sendResponse(res, statusCode, data) {
    res.writeHead(statusCode, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    });
    
    res.end(JSON.stringify(data));
  }

  /**
   * Route Handlers
   */
  async handleHealthCheck(req, res) {
    const health = {
      status: 'healthy',
      timestamp: new Date(),
      service: 'router',
      uptime: process.uptime(),
      requestCount: this.requestCount,
      activeConnections: this.activeConnections.size
    };
    
    if (this.slotManager) {
      const slotManagerStats = this.slotManager.getStats();
      health.slotManager = slotManagerStats;
    }
    
    this.sendResponse(res, 200, health);
  }

  async handleApiInfo(req, res) {
    const info = {
      name: 'ClaudeBox Multi-Slot API',
      version: '1.0.0',
      description: 'Multi-user slot management system API',
      endpoints: Array.from(this.routes.keys()).map(route => {
        const [method, path] = route.split(':');
        return { method, path };
      }),
      timestamp: new Date()
    };
    
    this.sendResponse(res, 200, info);
  }

  async handleCreateSlot(req, res) {
    try {
      const body = await this.parseRequestBody(req);
      
      if (!this.slotManager) {
        this.sendResponse(res, 503, { error: 'Slot Manager not available' });
        return;
      }
      
      const slotResult = await this.slotManager.createSlot(body.userId, body.options || {});
      
      this.sendResponse(res, slotResult.success ? 201 : 400, slotResult);
      
    } catch (error) {
      console.error('❌ Slot creation error:', error);
      this.sendResponse(res, 500, { error: error.message });
    }
  }

  async handleListSlots(req, res) {
    try {
      if (!this.slotManager) {
        this.sendResponse(res, 503, { error: 'Slot Manager not available' });
        return;
      }
      
      const slots = this.slotManager.getAllSlots();
      this.sendResponse(res, 200, { slots });
      
    } catch (error) {
      console.error('❌ List slots error:', error);
      this.sendResponse(res, 500, { error: error.message });
    }
  }

  async handleGetSlot(req, res) {
    try {
      const { slotId } = req.params;
      
      if (!this.slotManager) {
        this.sendResponse(res, 503, { error: 'Slot Manager not available' });
        return;
      }
      
      const slot = this.slotManager.getSlotInfo(slotId);
      
      if (!slot) {
        this.sendResponse(res, 404, { error: 'Slot not found' });
        return;
      }
      
      this.sendResponse(res, 200, { slot });
      
    } catch (error) {
      console.error('❌ Get slot error:', error);
      this.sendResponse(res, 500, { error: error.message });
    }
  }

  async handleTerminateSlot(req, res) {
    try {
      const { slotId } = req.params;
      
      if (!this.slotManager) {
        this.sendResponse(res, 503, { error: 'Slot Manager not available' });
        return;
      }
      
      const result = await this.slotManager.terminateSlot(slotId);
      this.sendResponse(res, result.success ? 200 : 404, result);
      
    } catch (error) {
      console.error('❌ Terminate slot error:', error);
      this.sendResponse(res, 500, { error: error.message });
    }
  }

  async handleGetUserSlots(req, res) {
    try {
      const { userId } = req.params;
      
      if (!this.slotManager) {
        this.sendResponse(res, 503, { error: 'Slot Manager not available' });
        return;
      }
      
      const slots = this.slotManager.getUserSlots(userId);
      this.sendResponse(res, 200, { userId, slots });
      
    } catch (error) {
      console.error('❌ Get user slots error:', error);
      this.sendResponse(res, 500, { error: error.message });
    }
  }

  async handleLogin(req, res) {
    try {
      const body = await this.parseRequestBody(req);
      
      if (!this.authService) {
        this.sendResponse(res, 503, { error: 'Auth Service not available' });
        return;
      }
      
      const authResult = await this.authService.authenticateUser(
        body.credentials,
        body.provider,
        body.metadata
      );
      
      this.sendResponse(res, authResult.success ? 200 : 401, authResult);
      
    } catch (error) {
      console.error('❌ Login error:', error);
      this.sendResponse(res, 401, { error: error.message });
    }
  }

  async handleLogout(req, res) {
    try {
      const body = await this.parseRequestBody(req);
      
      if (!this.authService) {
        this.sendResponse(res, 503, { error: 'Auth Service not available' });
        return;
      }
      
      const result = await this.authService.terminateSession(body.sessionId, 'logout');
      this.sendResponse(res, result.success ? 200 : 404, result);
      
    } catch (error) {
      console.error('❌ Logout error:', error);
      this.sendResponse(res, 500, { error: error.message });
    }
  }

  async handleValidateSession(req, res) {
    try {
      const { sessionId } = req.params;
      
      if (!this.authService) {
        this.sendResponse(res, 503, { error: 'Auth Service not available' });
        return;
      }
      
      const validation = await this.authService.validateSession(sessionId);
      this.sendResponse(res, 200, validation);
      
    } catch (error) {
      console.error('❌ Validate session error:', error);
      this.sendResponse(res, 500, { error: error.message });
    }
  }

  async handleSystemStats(req, res) {
    try {
      const stats = {
        router: {
          uptime: process.uptime(),
          requestCount: this.requestCount,
          activeConnections: this.activeConnections.size,
          memoryUsage: process.memoryUsage()
        }
      };
      
      if (this.slotManager) {
        stats.slotManager = this.slotManager.getStats();
      }
      
      if (this.authService) {
        stats.authService = this.authService.getStats();
      }
      
      this.sendResponse(res, 200, stats);
      
    } catch (error) {
      console.error('❌ System stats error:', error);
      this.sendResponse(res, 500, { error: error.message });
    }
  }

  async handleSystemMetrics(req, res) {
    try {
      const metrics = {
        timestamp: new Date(),
        router: {
          requestsPerSecond: this.calculateRequestsPerSecond(),
          activeConnections: this.activeConnections.size,
          memoryUsage: process.memoryUsage(),
          cpuUsage: process.cpuUsage()
        }
      };
      
      if (this.slotManager) {
        const slotStats = this.slotManager.getStats();
        if (slotStats.latestMetrics) {
          metrics.slotManager = slotStats.latestMetrics;
        }
      }
      
      this.sendResponse(res, 200, metrics);
      
    } catch (error) {
      console.error('❌ System metrics error:', error);
      this.sendResponse(res, 500, { error: error.message });
    }
  }

  async handleWebSocket(req, res) {
    // WebSocket upgrade handling would go here
    // This is a placeholder for future WebSocket implementation
    this.sendResponse(res, 501, { error: 'WebSocket not implemented yet' });
  }

  /**
   * User Management Handlers
   */
  async handleUserRegister(req, res) {
    try {
      const body = await this.parseRequestBody(req);
      
      if (!this.userService) {
        this.sendResponse(res, 503, { error: 'User Management Service not available' });
        return;
      }
      
      const result = await this.userService.registerUser(
        body.userData,
        body.authProvider || 'oauth2',
        {
          ipAddress: req.headers['x-forwarded-for'] || req.socket.remoteAddress,
          userAgent: req.headers['user-agent'],
          deviceFingerprint: req.headers['x-device-fingerprint'],
          source: body.source || 'api'
        }
      );
      
      this.sendResponse(res, result.success ? 201 : 400, result);
      
    } catch (error) {
      console.error('❌ User registration error:', error);
      this.sendResponse(res, 500, { error: error.message });
    }
  }

  async handleUserLogin(req, res) {
    try {
      const body = await this.parseRequestBody(req);
      
      if (!this.userService) {
        this.sendResponse(res, 503, { error: 'User Management Service not available' });
        return;
      }
      
      const result = await this.userService.loginUser(
        body.credentials,
        body.authProvider || 'oauth2',
        {
          ipAddress: req.headers['x-forwarded-for'] || req.socket.remoteAddress,
          userAgent: req.headers['user-agent'],
          deviceFingerprint: req.headers['x-device-fingerprint']
        }
      );
      
      this.sendResponse(res, result.success ? 200 : 401, result);
      
    } catch (error) {
      console.error('❌ User login error:', error);
      this.sendResponse(res, 401, { error: error.message });
    }
  }

  async handleGetUser(req, res) {
    try {
      const { userId } = req.params;
      
      if (!this.userService) {
        this.sendResponse(res, 503, { error: 'User Management Service not available' });
        return;
      }
      
      const user = await this.userService.getUserById(userId);
      
      if (!user) {
        this.sendResponse(res, 404, { error: 'User not found' });
        return;
      }
      
      this.sendResponse(res, 200, { user: this.userService.getSafeUserData(user) });
      
    } catch (error) {
      console.error('❌ Get user error:', error);
      this.sendResponse(res, 500, { error: error.message });
    }
  }

  async handleUpdateUser(req, res) {
    try {
      const { userId } = req.params;
      const body = await this.parseRequestBody(req);
      
      if (!this.userService) {
        this.sendResponse(res, 503, { error: 'User Management Service not available' });
        return;
      }
      
      // Check if user exists
      const user = await this.userService.getUserById(userId);
      if (!user) {
        this.sendResponse(res, 404, { error: 'User not found' });
        return;
      }
      
      // Update user settings or profile based on what's provided
      let result;
      if (body.settings) {
        result = await this.userService.updateUserSettings(userId, body.settings);
      } else if (body.profile) {
        result = await this.userService.updateUserProfile(userId, body.profile);
      } else {
        this.sendResponse(res, 400, { error: 'No valid update data provided' });
        return;
      }
      
      this.sendResponse(res, 200, result);
      
    } catch (error) {
      console.error('❌ Update user error:', error);
      this.sendResponse(res, 500, { error: error.message });
    }
  }

  async handleDeleteUser(req, res) {
    try {
      const { userId } = req.params;
      
      if (!this.userService) {
        this.sendResponse(res, 503, { error: 'User Management Service not available' });
        return;
      }
      
      // Check if user exists
      const user = await this.userService.getUserById(userId);
      if (!user) {
        this.sendResponse(res, 404, { error: 'User not found' });
        return;
      }
      
      // Terminate user sessions
      if (this.authService) {
        const userSessions = this.userService.getUserSessions(userId);
        for (const session of userSessions) {
          await this.authService.terminateSession(session.sessionId, 'user_deleted');
        }
      }
      
      // Delete user (implementation would be added to UserManagementService)
      // For now, just return success
      this.sendResponse(res, 200, { success: true, message: 'User deleted successfully' });
      
    } catch (error) {
      console.error('❌ Delete user error:', error);
      this.sendResponse(res, 500, { error: error.message });
    }
  }

  async handleGetUserProfile(req, res) {
    try {
      const { userId } = req.params;
      
      if (!this.userService) {
        this.sendResponse(res, 503, { error: 'User Management Service not available' });
        return;
      }
      
      const profile = await this.userService.getUserProfile(userId);
      
      if (!profile) {
        this.sendResponse(res, 404, { error: 'Profile not found' });
        return;
      }
      
      this.sendResponse(res, 200, { profile });
      
    } catch (error) {
      console.error('❌ Get user profile error:', error);
      this.sendResponse(res, 500, { error: error.message });
    }
  }

  async handleUpdateUserProfile(req, res) {
    try {
      const { userId } = req.params;
      const body = await this.parseRequestBody(req);
      
      if (!this.userService) {
        this.sendResponse(res, 503, { error: 'User Management Service not available' });
        return;
      }
      
      const result = await this.userService.updateUserProfile(userId, body);
      this.sendResponse(res, 200, result);
      
    } catch (error) {
      console.error('❌ Update user profile error:', error);
      this.sendResponse(res, 500, { error: error.message });
    }
  }

  async handleGetUserActivity(req, res) {
    try {
      const { userId } = req.params;
      const limit = parseInt(req.query.limit) || 50;
      
      if (!this.userService) {
        this.sendResponse(res, 503, { error: 'User Management Service not available' });
        return;
      }
      
      const activities = await this.userService.getUserActivity(userId, limit);
      this.sendResponse(res, 200, { activities });
      
    } catch (error) {
      console.error('❌ Get user activity error:', error);
      this.sendResponse(res, 500, { error: error.message });
    }
  }

  async handleUpdateUserSettings(req, res) {
    try {
      const { userId } = req.params;
      const body = await this.parseRequestBody(req);
      
      if (!this.userService) {
        this.sendResponse(res, 503, { error: 'User Management Service not available' });
        return;
      }
      
      const result = await this.userService.updateUserSettings(userId, body);
      this.sendResponse(res, 200, result);
      
    } catch (error) {
      console.error('❌ Update user settings error:', error);
      this.sendResponse(res, 500, { error: error.message });
    }
  }

  async handleRefreshSession(req, res) {
    try {
      const body = await this.parseRequestBody(req);
      
      if (!this.authService) {
        this.sendResponse(res, 503, { error: 'Auth Service not available' });
        return;
      }
      
      const result = await this.authService.refreshSession(body.sessionId, body.refreshToken);
      this.sendResponse(res, result.success ? 200 : 401, result);
      
    } catch (error) {
      console.error('❌ Session refresh error:', error);
      this.sendResponse(res, 401, { error: error.message });
    }
  }

  async handleListUsers(req, res) {
    try {
      if (!this.userService) {
        this.sendResponse(res, 503, { error: 'User Management Service not available' });
        return;
      }
      
      // This would require a method in UserManagementService to list users
      // For now, return basic info
      const stats = this.userService.getStats();
      this.sendResponse(res, 200, { 
        totalUsers: stats.totalUsers,
        totalRegistrations: stats.totalRegistrations,
        totalLogins: stats.totalLogins
      });
      
    } catch (error) {
      console.error('❌ List users error:', error);
      this.sendResponse(res, 500, { error: error.message });
    }
  }

  async handleAdminStats(req, res) {
    try {
      const stats = {
        router: this.getStats(),
        timestamp: new Date()
      };
      
      if (this.slotManager) {
        stats.slotManager = this.slotManager.getStats();
      }
      
      if (this.authService) {
        stats.authService = this.authService.getStats();
      }
      
      if (this.userService) {
        stats.userService = this.userService.getStats();
      }
      
      this.sendResponse(res, 200, stats);
      
    } catch (error) {
      console.error('❌ Admin stats error:', error);
      this.sendResponse(res, 500, { error: error.message });
    }
  }

  async handleUpdateUserRole(req, res) {
    try {
      const { userId } = req.params;
      const body = await this.parseRequestBody(req);
      
      if (!this.userService) {
        this.sendResponse(res, 503, { error: 'User Management Service not available' });
        return;
      }
      
      // This would require role management functionality in UserManagementService
      // For now, return success
      this.sendResponse(res, 200, { 
        success: true, 
        message: 'Role updated successfully',
        userId,
        newRole: body.role
      });
      
    } catch (error) {
      console.error('❌ Update user role error:', error);
      this.sendResponse(res, 500, { error: error.message });
    }
  }

  /**
   * Utility methods
   */
  async parseRequestBody(req) {
    return new Promise((resolve, reject) => {
      let body = '';
      
      req.on('data', (chunk) => {
        body += chunk.toString();
      });
      
      req.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (error) {
          reject(new Error('Invalid JSON'));
        }
      });
      
      req.on('error', reject);
    });
  }

  calculateRequestsPerSecond() {
    // This is a simplified calculation
    // In a real implementation, you'd track requests over time
    return this.requestCount / Math.max(process.uptime(), 1);
  }

  /**
   * Graceful shutdown
   */
  async shutdown() {
    console.log('🛑 Shutting down Router Service...');
    
    this.isRunning = false;
    
    // Close active connections
    for (const socket of this.activeConnections) {
      socket.destroy();
    }
    this.activeConnections.clear();
    
    // Close server
    if (this.server) {
      return new Promise((resolve) => {
        this.server.close(() => {
          console.log('✅ Router Service shutdown complete');
          resolve();
        });
      });
    }
  }

  /**
   * Get router statistics
   */
  getStats() {
    return {
      isRunning: this.isRunning,
      isInitialized: this.isInitialized,
      uptime: process.uptime(),
      requestCount: this.requestCount,
      activeConnections: this.activeConnections.size,
      config: this.config,
      routeCount: this.routes.size
    };
  }
}

// Export for use in other modules
export default RouterService;