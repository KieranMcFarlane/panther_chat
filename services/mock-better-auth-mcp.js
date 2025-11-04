/**
 * Better Auth MCP Mock Service for Testing
 * 
 * This mock service simulates the Better Auth MCP server for development and testing
 * when the real server is not available. This allows us to validate the integration logic.
 */

class MockBetterAuthMCPService {
  constructor() {
    this.sessions = new Map();
    this.users = new Map();
    this.providers = new Map();
    this.configurations = new Map();
    
    // Initialize mock providers
    this.initializeMockProviders();
  }

  initializeMockProviders() {
    const providers = [
      {
        id: 'oauth2',
        name: 'OAuth 2.0',
        description: 'Standard OAuth 2.0 authentication',
        supported: true
      },
      {
        id: 'oidc',
        name: 'OpenID Connect',
        description: 'OpenID Connect authentication',
        supported: true
      },
      {
        id: 'saml',
        name: 'SAML 2.0',
        description: 'SAML 2.0 authentication',
        supported: true
      },
      {
        id: 'claude_pro',
        name: 'Claude Pro',
        description: 'Claude Pro subscription authentication',
        supported: true
      },
      {
        id: 'api_key',
        name: 'API Key',
        description: 'API key authentication',
        supported: true
      }
    ];

    providers.forEach(provider => {
      this.providers.set(provider.id, provider);
    });
  }

  async health() {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: '1.0.0-mock'
    };
  }

  async authenticate({ provider, credentials, metadata }) {
    // Simulate authentication delay
    await new Promise(resolve => setTimeout(resolve, 100));

    if (!this.providers.has(provider)) {
      throw new Error(`Unsupported provider: ${provider}`);
    }

    // Simulate authentication failure for specific credentials
    if (credentials.email === 'invalid@test.com' || credentials.password === 'wrongpass') {
      throw new Error('Invalid credentials');
    }

    // Mock user creation/validation
    const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const user = {
      id: userId,
      email: credentials.email || `${userId}@example.com`,
      provider,
      metadata: {
        ...metadata,
        authenticatedAt: new Date().toISOString()
      }
    };

    this.users.set(userId, user);

    return {
      success: true,
      userId,
      user,
      authData: {
        accessToken: `mock_access_token_${userId}`,
        refreshToken: `mock_refresh_token_${userId}`,
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
        tokenType: 'Bearer'
      },
      message: 'Authentication successful'
    };
  }

  async createSession({ userId, authData, metadata }) {
    if (!this.users.has(userId)) {
      throw new Error('User not found');
    }

    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const session = {
      id: sessionId,
      userId,
      authData,
      metadata: {
        ...metadata,
        createdAt: new Date().toISOString(),
        platform: 'claudebox-multi-slot'
      },
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
      isActive: true
    };

    this.sessions.set(sessionId, session);
    return session;
  }

  async validateSession({ sessionId }) {
    const session = this.sessions.get(sessionId);
    
    if (!session) {
      return { valid: false, error: 'Session not found' };
    }

    if (new Date(session.expiresAt) < new Date()) {
      this.sessions.delete(sessionId);
      return { valid: false, error: 'Session expired' };
    }

    if (!session.isActive) {
      return { valid: false, error: 'Session inactive' };
    }

    return {
      valid: true,
      session: {
        id: session.id,
        userId: session.userId,
        expiresAt: session.expiresAt,
        isActive: session.isActive
      }
    };
  }

  async refreshSession({ sessionId }) {
    const validationResult = await this.validateSession({ sessionId });
    
    if (!validationResult.valid) {
      throw new Error('Cannot refresh invalid session');
    }

    const session = this.sessions.get(sessionId);
    session.expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    
    return {
      success: true,
      session: {
        id: session.id,
        userId: session.userId,
        expiresAt: session.expiresAt,
        isActive: session.isActive
      },
      newAccessToken: `mock_refreshed_access_token_${session.id}`,
      message: 'Session refreshed successfully'
    };
  }

  async configureProvider({ provider, config, metadata }) {
    if (!this.providers.has(provider)) {
      throw new Error(`Provider not supported: ${provider}`);
    }

    const configId = `${provider}_${Date.now()}`;
    this.configurations.set(configId, {
      id: configId,
      provider,
      config,
      metadata,
      createdAt: new Date().toISOString()
    });

    return {
      success: true,
      configId,
      message: `Provider ${provider} configured successfully`
    };
  }

  async getProviders({}) {
    return Array.from(this.providers.values()).map(provider => ({
      id: provider.id,
      name: provider.name,
      description: provider.description,
      supported: provider.supported
    }));
  }

  async invalidateSession({ sessionId }) {
    const session = this.sessions.get(sessionId);
    
    if (!session) {
      return { success: false, error: 'Session not found' };
    }

    session.isActive = false;
    this.sessions.delete(sessionId);
    
    return { success: true, message: 'Session invalidated successfully' };
  }

  async getSessionInfo({ sessionId }) {
    const session = this.sessions.get(sessionId);
    
    if (!session) {
      throw new Error('Session not found');
    }

    const user = this.users.get(session.userId);
    
    return {
      session: {
        id: session.id,
        userId: session.userId,
        expiresAt: session.expiresAt,
        isActive: session.isActive,
        createdAt: session.createdAt
      },
      user: {
        id: user.id,
        email: user.email,
        provider: user.provider
      },
      metadata: session.metadata
    };
  }

  // Mock security features
  async configureSecurity({ features }) {
    return {
      success: true,
      configured: features,
      message: 'Security features configured successfully'
    };
  }

  // Statistics for testing
  getStats() {
    return {
      totalUsers: this.users.size,
      activeSessions: Array.from(this.sessions.values()).filter(s => s.isActive).length,
      totalSessions: this.sessions.size,
      configuredProviders: this.configurations.size
    };
  }
}

export default MockBetterAuthMCPService;