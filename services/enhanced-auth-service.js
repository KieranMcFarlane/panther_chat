/**
 * Enhanced Authentication Service
 * 
 * Provides comprehensive authentication, authorization, and session management
 * with Better Auth MCP integration, role-based access control, and security features
 * Implements TICKET-005 acceptance criteria
 */

import { EventEmitter } from 'events';
import crypto from 'crypto';
import BetterAuthService from './better-auth-integration.js';

class EnhancedAuthService extends EventEmitter {
  constructor(config = {}) {
    super();
    
    // Configuration with defaults
    this.config = {
      sessionTimeout: config.sessionTimeout || parseInt(process.env.AUTH_SESSION_TIMEOUT) || 3600000, // 1 hour
      refreshTokenTimeout: config.refreshTokenTimeout || parseInt(process.env.REFRESH_TOKEN_TIMEOUT) || 604800000, // 7 days
      maxConcurrentSessions: config.maxConcurrentSessions || parseInt(process.env.MAX_CONCURRENT_SESSIONS) || 5,
      enableRateLimiting: config.enableRateLimiting !== false,
      rateLimitWindow: config.rateLimitWindow || 900000, // 15 minutes
      rateLimitMaxAttempts: config.rateLimitMaxAttempts || 5,
      enableIPTracking: config.enableIPTracking !== false,
      enableDeviceFingerprinting: config.enableDeviceFingerprinting !== false,
      securityLogRetention: config.securityLogRetention || 30, // days
      betterAuthMcpUrl: config.betterAuthMcpUrl || process.env.BETTER_AUTH_MCP_URL || 'https://mcp.chonkie.ai/better-auth/better-auth-builder/mcp',
      ...config
    };
    
    this.betterAuthService = new BetterAuthService();
    this.userSessions = new Map(); // userId -> Set of sessionIds
    this.sessionData = new Map(); // sessionId -> session info
    this.rateLimiters = new Map(); // ip -> rate limit data
    this.deviceFingerprints = new Map(); // fingerprint -> userId
    this.securityLogs = [];
    this.isInitialized = false;
    
    // Role-based access control
    this.roles = {
      ADMIN: {
        permissions: ['*', 'manage_users', 'manage_sessions', 'manage_system', 'view_logs'],
        priority: 100
      },
      OPERATOR: {
        permissions: ['create_sessions', 'manage_own_sessions', 'view_system_status'],
        priority: 50
      },
      USER: {
        permissions: ['create_sessions', 'manage_own_sessions'],
        priority: 10
      },
      GUEST: {
        permissions: ['view_public'],
        priority: 1
      }
    };
    
    // Predefined authentication providers configuration
    this.authProviders = {
      oauth2: {
        google: {
          enabled: true,
          scopes: ['email', 'profile'],
          client_id: process.env.GOOGLE_CLIENT_ID,
          redirect_uri: process.env.GOOGLE_REDIRECT_URI
        },
        github: {
          enabled: true,
          scopes: ['user:email', 'read:user'],
          client_id: process.env.GITHUB_CLIENT_ID,
          redirect_uri: process.env.GITHUB_REDIRECT_URI
        }
      },
      openid: {
        enabled: true,
        providers: ['google', 'microsoft', 'auth0']
      },
      saml: {
        enabled: true,
        providers: ['azure-ad', 'okta', 'keycloak']
      },
      local: {
        enabled: true,
        require_mfa: process.env.LOCAL_AUTH_MFA === 'true'
      }
    };
    
    console.log('🔐 Enhanced Authentication Service initialized with config:', {
      sessionTimeout: this.config.sessionTimeout,
      refreshTokenTimeout: this.config.refreshTokenTimeout,
      maxConcurrentSessions: this.config.maxConcurrentSessions,
      enableRateLimiting: this.config.enableRateLimiting,
      enableIPTracking: this.config.enableIPTracking,
      enableDeviceFingerprinting: this.config.enableDeviceFingerprinting
    });
  }
  
  async initialize() {
    try {
      console.log('🔧 Initializing Enhanced Authentication Service...');
      
      // Initialize Better Auth MCP integration
      const betterAuthInitialized = await this.betterAuthService.initialize();
      if (!betterAuthInitialized) {
        throw new Error('Failed to initialize Better Auth MCP integration');
      }
      
      // Configure available authentication providers
      await this.configureProviders();
      
      // Start security monitoring
      this.startSecurityMonitoring();
      
      this.isInitialized = true;
      console.log('✅ Enhanced Authentication Service initialized successfully');
      
      this.emit('initialized', { success: true });
      return true;
      
    } catch (error) {
      console.error('❌ Failed to initialize Enhanced Authentication Service:', error);
      this.emit('initialized', { success: false, error: error.message });
      return false;
    }
  }
  
  async configureProviders() {
    try {
      console.log('🔧 Configuring authentication providers...');
      
      let configuredCount = 0;
      
      // Configure OAuth2 providers
      for (const [provider, config] of Object.entries(this.authProviders.oauth2)) {
        if (config.enabled && config.client_id) {
          try {
            await this.betterAuthService.configureProvider(`oauth2:${provider}`, {
              client_id: config.client_id,
              redirect_uri: config.redirect_uri,
              scopes: config.scopes
            });
            console.log(`✅ Configured OAuth2 provider: ${provider}`);
            configuredCount++;
          } catch (error) {
            console.warn(`⚠️ Failed to configure OAuth2 provider ${provider}:`, error.message);
          }
        }
      }
      
      // Configure SAML providers (may not be supported in mock mode)
      for (const provider of this.authProviders.saml.providers) {
        try {
          await this.betterAuthService.configureProvider(`saml:${provider}`, {
            enabled: true,
            metadata_url: process.env[`${provider.toUpperCase()}_METADATA_URL`]
          });
          console.log(`✅ Configured SAML provider: ${provider}`);
          configuredCount++;
        } catch (error) {
          console.warn(`⚠️ Failed to configure SAML provider ${provider}:`, error.message);
          // In development/mock mode, this is expected
          if (process.env.NODE_ENV === 'development' || process.env.TEST_MODE) {
            console.log(`🧪 Development mode - SAML provider ${provider} will use fallback`);
          }
        }
      }
      
      if (configuredCount === 0) {
        console.warn('⚠️ No authentication providers could be configured');
      } else {
        console.log(`✅ Authentication providers configured (${configuredCount} successful)`);
      }
      
    } catch (error) {
      console.error('❌ Failed to configure providers:', error);
      // Don't throw error in development mode - allow service to start with limited providers
      if (process.env.NODE_ENV === 'development' || process.env.TEST_MODE) {
        console.log('🧪 Development mode - continuing with limited provider configuration');
        return;
      }
      throw error;
    }
  }
  
  async authenticateUser(credentials, provider, options = {}) {
    try {
      if (!this.isInitialized) {
        throw new Error('Enhanced Authentication Service not initialized');
      }
      
      const { ipAddress, userAgent, deviceFingerprint } = options;
      
      // Rate limiting check
      if (this.config.enableRateLimiting && ipAddress) {
        await this.checkRateLimit(ipAddress);
      }
      
      // Device fingerprinting check
      if (this.config.enableDeviceFingerprinting && deviceFingerprint) {
        const existingUserId = this.deviceFingerprints.get(deviceFingerprint);
        if (existingUserId) {
          console.log(`🔍 Device fingerprint recognized for user ${existingUserId}`);
        }
      }
      
      console.log(`🔐 Authenticating user with provider: ${provider}`);
      
      // Authenticate with Better Auth
      let authResult;
      try {
        authResult = await this.betterAuthService.authenticateUser(credentials, provider);
      } catch (error) {
        await this.logSecurityEvent('authentication_failed', {
          provider,
          ipAddress,
          userAgent,
          reason: error.message || 'Invalid credentials'
        });
        throw error;
      }
      
      if (!authResult.success) {
        await this.logSecurityEvent('authentication_failed', {
          provider,
          ipAddress,
          userAgent,
          reason: authResult.error || 'Invalid credentials'
        });
        throw new Error(authResult.error || 'Authentication failed');
      }
      
      // Check if user has existing sessions
      const existingSessions = this.userSessions.get(authResult.userId) || new Set();
      if (existingSessions.size >= this.config.maxConcurrentSessions) {
        // Terminate oldest session
        const oldestSessionId = Array.from(existingSessions)[0];
        await this.terminateSession(oldestSessionId, 'session_limit_exceeded');
      }
      
      // Create session in Better Auth first to get the proper session ID
      const betterAuthSession = await this.betterAuthService.createSession(
        authResult.userId,
        {
          provider,
          ipAddress,
          userAgent,
          deviceFingerprint,
          metadata: {
            ...authResult.metadata,
            loginMethod: provider,
            securityLevel: this.calculateSecurityLevel(provider, options)
          }
        }
      );
      
      // Create enhanced session using the session ID from Better Auth
      const sessionData = {
        sessionId: betterAuthSession.id,
        userId: authResult.userId,
        provider,
        role: authResult.role || 'USER',
        permissions: this.getRolePermissions(authResult.role || 'USER'),
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + this.config.sessionTimeout),
        refreshToken: this.generateRefreshToken(),
        refreshTokenExpiresAt: new Date(Date.now() + this.config.refreshTokenTimeout),
        ipAddress,
        userAgent,
        deviceFingerprint,
        metadata: {
          ...authResult.metadata,
          loginMethod: provider,
          securityLevel: this.calculateSecurityLevel(provider, options)
        }
      };
      
      // Store session data
      this.sessionData.set(sessionData.sessionId, sessionData);
      
      // Update user sessions
      if (!this.userSessions.has(authResult.userId)) {
        this.userSessions.set(authResult.userId, new Set());
      }
      this.userSessions.get(authResult.userId).add(sessionData.sessionId);
      
      // Store device fingerprint
      if (this.config.enableDeviceFingerprinting && deviceFingerprint) {
        this.deviceFingerprints.set(deviceFingerprint, authResult.userId);
      }
      
      // Log successful authentication
      await this.logSecurityEvent('authentication_success', {
        userId: authResult.userId,
        provider,
        sessionId: sessionData.sessionId,
        ipAddress,
        userAgent,
        role: sessionData.role
      });
      
      console.log(`✅ User ${authResult.userId} authenticated successfully with session ${sessionData.sessionId}`);
      
      this.emit('userAuthenticated', {
        userId: authResult.userId,
        sessionId: sessionData.sessionId,
        role: sessionData.role,
        provider
      });
      
      return {
        success: true,
        sessionId: sessionData.sessionId,
        userId: authResult.userId,
        role: sessionData.role,
        permissions: sessionData.permissions,
        expiresAt: sessionData.expiresAt,
        refreshToken: sessionData.refreshToken,
        metadata: sessionData.metadata
      };
      
    } catch (error) {
      console.error('❌ Authentication failed:', error);
      this.emit('authenticationError', { provider, error: error.message });
      throw error;
    }
  }
  
  async validateSession(sessionId) {
    try {
      if (!this.isInitialized) {
        throw new Error('Enhanced Authentication Service not initialized');
      }
      
      const session = this.sessionData.get(sessionId);
      if (!session) {
        return { valid: false, reason: 'session_not_found' };
      }
      
      // Check session expiration
      if (new Date() > session.expiresAt) {
        await this.terminateSession(sessionId, 'expired');
        return { valid: false, reason: 'session_expired' };
      }
      
      // Validate with Better Auth
      const betterAuthValidation = await this.betterAuthService.validateSession(sessionId);
      if (!betterAuthValidation.valid) {
        await this.terminateSession(sessionId, 'invalid');
        return { valid: false, reason: 'invalid_session' };
      }
      
      // Check rate limiting
      if (this.config.enableRateLimiting && session.ipAddress) {
        await this.checkRateLimit(session.ipAddress);
      }
      
      // Update session activity
      session.lastActivity = new Date();
      
      return {
        valid: true,
        userId: session.userId,
        role: session.role,
        permissions: session.permissions,
        expiresAt: session.expiresAt,
        metadata: session.metadata
      };
      
    } catch (error) {
      console.error('❌ Session validation failed:', error);
      return { valid: false, reason: error.message };
    }
  }
  
  async refreshSession(sessionId, refreshToken) {
    try {
      if (!this.isInitialized) {
        throw new Error('Enhanced Authentication Service not initialized');
      }
      
      const session = this.sessionData.get(sessionId);
      if (!session) {
        throw new Error('Session not found');
      }
      
      // Validate refresh token
      if (session.refreshToken !== refreshToken) {
        await this.logSecurityEvent('invalid_refresh_token', {
          sessionId,
          ipAddress: session.ipAddress
        });
        throw new Error('Invalid refresh token');
      }
      
      // Check refresh token expiration
      if (new Date() > session.refreshTokenExpiresAt) {
        await this.terminateSession(sessionId, 'refresh_token_expired');
        throw new Error('Refresh token expired');
      }
      
      // Refresh with Better Auth
      const refreshedSession = await this.betterAuthService.refreshSession(sessionId);
      
      // Update session data
      session.expiresAt = new Date(Date.now() + this.config.sessionTimeout);
      session.refreshToken = this.generateRefreshToken();
      session.refreshTokenExpiresAt = new Date(Date.now() + this.config.refreshTokenTimeout);
      session.lastActivity = new Date();
      
      await this.logSecurityEvent('session_refreshed', {
        sessionId,
        userId: session.userId
      });
      
      console.log(`✅ Session ${sessionId} refreshed successfully`);
      
      return {
        success: true,
        sessionId,
        expiresAt: session.expiresAt,
        refreshToken: session.refreshToken,
        refreshTokenExpiresAt: session.refreshTokenExpiresAt
      };
      
    } catch (error) {
      console.error('❌ Session refresh failed:', error);
      throw error;
    }
  }
  
  async terminateSession(sessionId, reason = 'manual') {
    try {
      const session = this.sessionData.get(sessionId);
      if (!session) {
        return false;
      }
      
      console.log(`🔧 Terminating session ${sessionId} (${reason})`);
      
      // Invalidate session in Better Auth
      await this.betterAuthService.invalidateSession(sessionId);
      
      // Remove from user sessions
      const userSessions = this.userSessions.get(session.userId);
      if (userSessions) {
        userSessions.delete(sessionId);
        if (userSessions.size === 0) {
          this.userSessions.delete(session.userId);
        }
      }
      
      // Remove session data
      this.sessionData.delete(sessionId);
      
      // Log security event
      await this.logSecurityEvent('session_terminated', {
        sessionId,
        userId: session.userId,
        reason,
        ipAddress: session.ipAddress
      });
      
      console.log(`✅ Session ${sessionId} terminated successfully`);
      
      this.emit('sessionTerminated', { sessionId, userId: session.userId, reason });
      
      return true;
      
    } catch (error) {
      console.error(`❌ Failed to terminate session ${sessionId}:`, error);
      throw error;
    }
  }
  
  async checkRateLimit(ipAddress) {
    const now = Date.now();
    const rateLimitData = this.rateLimiters.get(ipAddress) || {
      attempts: 0,
      resetTime: now + this.config.rateLimitWindow,
      blocked: false
    };
    
    // Reset rate limit if window has passed
    if (now > rateLimitData.resetTime) {
      rateLimitData.attempts = 0;
      rateLimitData.resetTime = now + this.config.rateLimitWindow;
      rateLimitData.blocked = false;
    }
    
    // Check if blocked
    if (rateLimitData.blocked) {
      throw new Error('Rate limit exceeded. Please try again later.');
    }
    
    // Increment attempts
    rateLimitData.attempts++;
    
    // Check if limit exceeded
    if (rateLimitData.attempts > this.config.rateLimitMaxAttempts) {
      rateLimitData.blocked = true;
      this.rateLimiters.set(ipAddress, rateLimitData);
      
      await this.logSecurityEvent('rate_limit_exceeded', {
        ipAddress,
        attempts: rateLimitData.attempts
      });
      
      throw new Error('Rate limit exceeded. Please try again later.');
    }
    
    this.rateLimiters.set(ipAddress, rateLimitData);
  }
  
  getRolePermissions(role) {
    const roleConfig = this.roles[role] || this.roles.USER;
    return roleConfig.permissions;
  }
  
  hasPermission(userId, permission) {
    const userSessions = this.userSessions.get(userId);
    if (!userSessions || userSessions.size === 0) {
      return false;
    }
    
    // Get the most recent session
    const sessionId = Array.from(userSessions)[userSessions.size - 1];
    const session = this.sessionData.get(sessionId);
    
    if (!session) {
      return false;
    }
    
    return session.permissions.includes('*') || session.permissions.includes(permission);
  }
  
  async logSecurityEvent(eventType, data) {
    const event = {
      timestamp: new Date(),
      eventType,
      data,
      id: this.generateEventId()
    };
    
    this.securityLogs.push(event);
    
    // Keep only recent logs (based on retention period)
    const cutoffTime = new Date(Date.now() - (this.config.securityLogRetention * 24 * 60 * 60 * 1000));
    this.securityLogs = this.securityLogs.filter(log => log.timestamp > cutoffTime);
    
    this.emit('securityEvent', event);
  }
  
  startSecurityMonitoring() {
    // Clean up expired rate limiters periodically
    setInterval(() => {
      const now = Date.now();
      for (const [ip, data] of this.rateLimiters.entries()) {
        if (now > data.resetTime) {
          this.rateLimiters.delete(ip);
        }
      }
    }, 60000); // Clean up every minute
    
    // Clean up expired sessions periodically
    setInterval(() => {
      this.cleanupExpiredSessions();
    }, 300000); // Clean up every 5 minutes
    
    console.log('🔒 Security monitoring started');
  }
  
  cleanupExpiredSessions() {
    const now = new Date();
    const expiredSessions = [];
    
    for (const [sessionId, session] of this.sessionData.entries()) {
      if (now > session.expiresAt) {
        expiredSessions.push(sessionId);
      }
    }
    
    for (const sessionId of expiredSessions) {
      // Synchronous cleanup for immediate removal
      this.sessionData.delete(sessionId);
      
      // Also remove from user sessions
      for (const [userId, sessions] of this.userSessions.entries()) {
        if (sessions.has(sessionId)) {
          sessions.delete(sessionId);
          if (sessions.size === 0) {
            this.userSessions.delete(userId);
          }
        }
      }
      
      // Log the cleanup
      console.log(`🧹 Cleaned up expired session ${sessionId}`);
    }
    
    if (expiredSessions.length > 0) {
      console.log(`🧹 Cleaned up ${expiredSessions.length} expired sessions`);
    }
  }
  
  calculateSecurityLevel(provider, options) {
    let level = 'basic';
    
    // OAuth2/OIDC providers get higher security level
    if (provider.startsWith('oauth2:') || provider.startsWith('openid:')) {
      level = 'high';
    }
    
    // SAML providers get highest security level
    if (provider.startsWith('saml:')) {
      level = 'enterprise';
    }
    
    // Device fingerprinting increases security level
    if (options.deviceFingerprint) {
      level = level === 'enterprise' ? 'enterprise_plus' : 'enhanced';
    }
    
    return level;
  }
  
  generateSessionId() {
    return `sess_${crypto.randomBytes(32).toString('hex')}`;
  }
  
  generateRefreshToken() {
    return `refresh_${crypto.randomBytes(32).toString('hex')}`;
  }
  
  generateEventId() {
    return `event_${crypto.randomBytes(16).toString('hex')}`;
  }
  
  // Helper methods
  getUserSessions(userId) {
    const sessionIds = this.userSessions.get(userId) || new Set();
    return Array.from(sessionIds).map(sessionId => ({
      sessionId,
      ...this.sessionData.get(sessionId)
    }));
  }
  
  getSessionInfo(sessionId) {
    return this.sessionData.get(sessionId);
  }
  
  getStats() {
    return {
      totalSessions: this.sessionData.size,
      activeUsers: this.userSessions.size,
      rateLimitedIPs: this.rateLimiters.size,
      securityLogCount: this.securityLogs.length,
      configuredProviders: Object.keys(this.authProviders).length,
      availableRoles: Object.keys(this.roles)
    };
  }
  
  getSecurityLogs(limit = 100) {
    return this.securityLogs.slice(-limit);
  }
  
  async shutdown() {
    console.log('🛑 Shutting down Enhanced Authentication Service...');
    
    // Terminate all sessions
    const terminatePromises = Array.from(this.sessionData.keys()).map(sessionId => 
      this.terminateSession(sessionId, 'shutdown').catch(error => {
        console.error(`❌ Error terminating session ${sessionId}:`, error);
      })
    );
    
    await Promise.all(terminatePromises);
    
    // Clear caches
    this.userSessions.clear();
    this.sessionData.clear();
    this.rateLimiters.clear();
    this.deviceFingerprints.clear();
    this.securityLogs = [];
    
    this.isInitialized = false;
    console.log('✅ Enhanced Authentication Service shutdown complete');
  }
}

export default EnhancedAuthService;