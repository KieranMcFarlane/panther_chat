/**
 * Better Auth MCP Integration Service
 * 
 * This service integrates the Better Auth MCP server for enhanced authentication
 * capabilities including OAuth2, OpenID Connect, and SAML providers.
 * 
 * Based on TICKET-001 requirements for Better Auth MCP Integration
 */

import MockBetterAuthMCPService from './mock-better-auth-mcp.js';

class BetterAuthService {
  constructor() {
    this.mcpClient = null;
    this.authCache = new Map();
    this.sessionCache = new Map();
    this.baseUrl = 'https://mcp.chonkie.ai/better-auth/better-auth-builder/mcp';
    this.mockService = null;
    this.useMock = false;
  }

  /**
   * Initialize the Better Auth MCP client
   */
  async initialize() {
    try {
      // Test connection to Better Auth MCP server
      const response = await fetch(`${this.baseUrl}/health`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Better Auth MCP server not available: ${response.status}`);
      }

      const health = await response.json();
      console.log('Better Auth MCP server connected:', health);
      
      this.mcpClient = {
        call: this.callMCPEndpoint.bind(this)
      };
      
      return true;
    } catch (error) {
      console.warn('Better Auth MCP server not available, using mock service:', error.message);
      
      // Fall back to mock service
      this.mockService = new MockBetterAuthMCPService();
      this.useMock = true;
      
      // Initialize mock service
      const mockHealth = await this.mockService.health();
      console.log('Mock Better Auth MCP service initialized:', mockHealth);
      
      return true;
    }
  }

  /**
   * Call Better Auth MCP endpoints
   */
  async callMCPEndpoint(method, params) {
    if (this.useMock && this.mockService) {
      return await this.callMockEndpoint(method, params);
    }

    if (!this.mcpClient) {
      throw new Error('Better Auth MCP client not initialized');
    }

    try {
      const response = await fetch(`${this.baseUrl}/${method}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        throw new Error(`MCP call failed: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`MCP call error for ${method}:`, error);
      throw error;
    }
  }

  /**
   * Call mock Better Auth MCP endpoints
   */
  async callMockEndpoint(method, params) {
    if (!this.mockService) {
      throw new Error('Mock Better Auth MCP service not initialized');
    }

    try {
      switch (method) {
        case 'authenticate':
          return await this.mockService.authenticate(params);
        case 'create_session':
          return await this.mockService.createSession(params);
        case 'validate_session':
          return await this.mockService.validateSession(params);
        case 'refresh_session':
          return await this.mockService.refreshSession(params);
        case 'configure_provider':
          return await this.mockService.configureProvider(params);
        case 'get_providers':
          return await this.mockService.getProviders(params);
        case 'invalidate_session':
          return await this.mockService.invalidateSession(params);
        case 'get_session_info':
          return await this.mockService.getSessionInfo(params);
        default:
          throw new Error(`Mock method ${method} not implemented`);
      }
    } catch (error) {
      console.error(`Mock MCP call error for ${method}:`, error);
      throw error;
    }
  }

  /**
   * Authenticate user with specified provider
   */
  async authenticateUser(credentials, provider) {
    try {
      const authResult = await this.callMCPEndpoint('authenticate', {
        provider,
        credentials,
        metadata: {
          platform: 'claudebox-multi-slot',
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        }
      });

      // Cache authentication result
      this.authCache.set(authResult.userId, authResult);

      return authResult;
    } catch (error) {
      console.error('Authentication failed:', error);
      throw new Error(`Authentication failed for provider ${provider}: ${error.message}`);
    }
  }

  /**
   * Create user session
   */
  async createSession(userId, authData) {
    try {
      const session = await this.callMCPEndpoint('create_session', {
        userId,
        authData,
        metadata: {
          platform: 'claudebox-multi-slot',
          version: '1.0.0',
          created: new Date().toISOString()
        }
      });

      // Cache session
      this.sessionCache.set(session.id, session);

      return session;
    } catch (error) {
      console.error('Session creation failed:', error);
      throw new Error(`Session creation failed: ${error.message}`);
    }
  }

  /**
   * Validate existing session
   */
  async validateSession(sessionId) {
    try {
      // Check cache first
      if (this.sessionCache.has(sessionId)) {
        const cachedSession = this.sessionCache.get(sessionId);
        // Validate cached session with server
        const validationResult = await this.callMCPEndpoint('validate_session', { sessionId });
        if (validationResult.valid) {
          // Update cache with fresh data
          this.sessionCache.set(sessionId, { ...cachedSession, ...validationResult });
          return validationResult;
        } else {
          // Remove invalid session from cache
          this.sessionCache.delete(sessionId);
        }
      }

      // Validate with server
      const session = await this.callMCPEndpoint('validate_session', { sessionId });
      if (session.valid) {
        this.sessionCache.set(sessionId, session);
      }

      return session;
    } catch (error) {
      console.error('Session validation failed:', error);
      return { valid: false, error: error.message };
    }
  }

  /**
   * Refresh session
   */
  async refreshSession(sessionId) {
    try {
      const refreshedSession = await this.callMCPEndpoint('refresh_session', { sessionId });
      
      // Update cache
      this.sessionCache.set(sessionId, refreshedSession);
      
      return refreshedSession;
    } catch (error) {
      console.error('Session refresh failed:', error);
      throw new Error(`Session refresh failed: ${error.message}`);
    }
  }

  /**
   * Configure authentication provider
   */
  async configureProvider(provider, config) {
    try {
      const result = await this.callMCPEndpoint('configure_provider', {
        provider,
        config,
        metadata: {
          platform: 'claudebox-multi-slot',
          timestamp: new Date().toISOString()
        }
      });

      console.log(`Provider ${provider} configured successfully`);
      return result;
    } catch (error) {
      console.error(`Provider configuration failed for ${provider}:`, error);
      throw new Error(`Provider configuration failed: ${error.message}`);
    }
  }

  /**
   * Get available authentication providers
   */
  async getAvailableProviders() {
    try {
      const providers = await this.callMCPEndpoint('get_providers', {});
      return providers;
    } catch (error) {
      console.error('Failed to get available providers:', error);
      throw new Error(`Failed to get providers: ${error.message}`);
    }
  }

  /**
   * Invalidate session (logout)
   */
  async invalidateSession(sessionId) {
    try {
      await this.callMCPEndpoint('invalidate_session', { sessionId });
      
      // Remove from cache
      this.sessionCache.delete(sessionId);
      
      return { success: true };
    } catch (error) {
      console.error('Session invalidation failed:', error);
      throw new Error(`Session invalidation failed: ${error.message}`);
    }
  }

  /**
   * Get session info
   */
  async getSessionInfo(sessionId) {
    try {
      const sessionInfo = await this.callMCPEndpoint('get_session_info', { sessionId });
      return sessionInfo;
    } catch (error) {
      console.error('Failed to get session info:', error);
      throw new Error(`Failed to get session info: ${error.message}`);
    }
  }

  /**
   * Clear caches
   */
  clearCache() {
    this.authCache.clear();
    this.sessionCache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      authCacheSize: this.authCache.size,
      sessionCacheSize: this.sessionCache.size,
      totalCachedEntries: this.authCache.size + this.sessionCache.size
    };
  }
}

// Export for use in other modules
export default BetterAuthService;