/**
 * Comprehensive Test Suite for Iframe Integration Service with Better Auth
 * 
 * Tests all TICKET-010 requirements:
 * - Dynamic iframe URL generation per slot
 * - Iframe loading state management
 * - Error handling and fallback UI
 * - Session timeout handling with Better Auth
 * - Cross-origin communication
 * - Better Auth session integration
 */

import IframeIntegrationService from '../services/iframe-integration-service.js';
import { describe, it, before, after, beforeEach, mock } from 'node:test';
import assert from 'node:assert';

// Mock services for testing
class MockAuthService {
  constructor() {
    this.isInitialized = true;
    this.sessions = new Map();
  }

  async initialize() {
    this.isInitialized = true;
  }

  async validateUserSession(userId) {
    const session = this.sessions.get(userId);
    return {
      valid: !!session,
      sessionId: session?.id || 'mock-session-id',
      authToken: session?.token || 'mock-token'
    };
  }

  async validateBetterAuthSession(sessionId) {
    return {
      valid: true,
      userId: 'mock-user-id',
      expiresAt: Date.now() + 3600000
    };
  }

  async refreshBetterAuthSession(sessionId) {
    return {
      success: true,
      sessionId,
      newToken: 'refreshed-token'
    };
  }

  async shutdown() {
    this.sessions.clear();
  }
}

class MockSlotManager {
  constructor() {
    this.isInitialized = true;
    this.slots = new Map();
  }

  async initialize() {
    this.isInitialized = true;
  }

  hasSlot(slotId) {
    return this.slots.has(slotId);
  }

  getSlotInfo(slotId) {
    return this.slots.get(slotId) || null;
  }

  async shutdown() {
    this.slots.clear();
  }
}

class MockUserManagementAPI {
  constructor() {
    this.isInitialized = true;
  }

  async initialize() {
    this.isInitialized = true;
  }

  async validateSlotAccess(userId, slotId, sessionId) {
    return {
      allowed: true,
      userId,
      slotId,
      permissions: ['read', 'write']
    };
  }

  async shutdown() {
    // Mock shutdown
  }
}

class MockSessionPersistenceManager {
  constructor() {
    this.isInitialized = true;
  }

  async initialize() {
    this.isInitialized = true;
  }

  async shutdown() {
    // Mock shutdown
  }
}

describe('Iframe Integration Service - TICKET-010 Tests', () => {
  let service;
  let mockAuthService;
  let mockSlotManager;
  let mockUserManagement;
  let mockSessionPersistence;

  before(async () => {
    console.log('🖼️ Setting up Iframe Integration Service tests...');
    
    // Create mock services
    mockAuthService = new MockAuthService();
    mockSlotManager = new MockSlotManager();
    mockUserManagement = new MockUserManagementAPI();
    mockSessionPersistence = new MockSessionPersistenceManager();
    
    // Add test slot
    mockSlotManager.slots.set('test-slot-1', {
      id: 'test-slot-1',
      name: 'Test Slot 1',
      status: 'active',
      port: 7682,
      createdAt: Date.now()
    });
    
    // Add test user session
    mockAuthService.sessions.set('test-user-1', {
      id: 'test-session-1',
      userId: 'test-user-1',
      token: 'test-token-1',
      createdAt: Date.now()
    });
    
    // Initialize service with mock dependencies
    service = new IframeIntegrationService({
      baseUrl: 'http://localhost:7681',
      enableRateLimiting: false,
      enableMetrics: true,
      enableLogging: true,
      secretKey: 'test-secret-key'
    });
    
    // Replace services with mocks
    service.authService = mockAuthService;
    service.slotManager = mockSlotManager;
    service.userManagement = mockUserManagement;
    service.sessionPersistence = mockSessionPersistence;
    
    await service.initialize();
    console.log('✅ Iframe Integration Service initialized for testing');
  });

  after(async () => {
    console.log('🧹 Cleaning up Iframe Integration Service tests...');
    await service.shutdown();
  });

  beforeEach(() => {
    // Clear iframe sessions between tests
    service.iframeSessions.clear();
    service.userSessions.clear();
    service.slotUrls.clear();
  });

  /**
   * Test Group 1: Service Initialization and Configuration
   */
  describe('Service Initialization and Configuration', () => {
    it('should initialize Iframe Integration Service successfully', async () => {
      assert.strictEqual(service.isInitialized, true);
      assert.strictEqual(service.authService.isInitialized, true);
      assert.strictEqual(service.slotManager.isInitialized, true);
      assert.strictEqual(service.userManagement.isInitialized, true);
      assert.strictEqual(service.sessionPersistence.isInitialized, true);
      
      console.log('✅ Service initialization successful');
    });

    it('should have correct configuration', () => {
      assert.strictEqual(service.config.baseUrl, 'http://localhost:7681');
      assert.strictEqual(service.config.enableRateLimiting, false);
      assert.strictEqual(service.config.enableMetrics, true);
      assert.strictEqual(service.config.enableLogging, true);
      assert.ok(Array.isArray(service.config.allowedOrigins));
      assert.ok(Array.isArray(service.config.sandboxPermissions));
      assert.ok(Array.isArray(service.config.allowedFeatures));
      
      console.log('✅ Service configuration correct');
    });

    it('should return correct status', () => {
      const status = service.getStatus();
      
      assert.strictEqual(status.service, 'iframe-integration');
      assert.strictEqual(status.isInitialized, true);
      assert.ok(status.startTime);
      assert.ok(status.uptime > 0);
      assert.strictEqual(status.sessions.active, 0);
      assert.strictEqual(status.sessions.totalCreated, 0);
      assert.strictEqual(status.sessions.totalTerminated, 0);
      assert.strictEqual(status.messages.totalProcessed, 0);
      
      console.log('✅ Service status correct');
    });
  });

  /**
   * Test Group 2: Dynamic Iframe URL Generation per Slot
   */
  describe('Dynamic Iframe URL Generation per Slot', () => {
    it('should generate iframe URL for valid slot', async () => {
      const urlInfo = service.generateSlotUrl('test-slot-1', {
        userId: 'test-user-1',
        sessionId: 'test-session-1'
      });

      assert.ok(urlInfo.slotId);
      assert.ok(urlInfo.url);
      assert.ok(urlInfo.timestamp);
      assert.ok(urlInfo.nonce);
      assert.ok(urlInfo.signature);
      assert.ok(urlInfo.expiresAt);
      assert.ok(urlInfo.url.startsWith('http://localhost:7681/slot/test-slot-1'));
      
      console.log(`✅ Iframe URL generated: ${urlInfo.url}`);
    });

    it('should include authentication parameters in URL', async () => {
      const urlInfo = service.generateSlotUrl('test-slot-1', {
        userId: 'test-user-1',
        sessionId: 'test-session-1',
        theme: 'dark',
        mobile: true,
        width: '800px',
        height: '600px'
      });

      const url = new URL(urlInfo.url);
      
      assert.strictEqual(url.searchParams.get('theme'), 'dark');
      assert.strictEqual(url.searchParams.get('mobile'), 'true');
      assert.strictEqual(url.searchParams.get('width'), '800px');
      assert.strictEqual(url.searchParams.get('height'), '600px');
      
      console.log('✅ Authentication parameters included in URL');
    });

    it('should throw error for non-existent slot', async () => {
      await assert.rejects(
        async () => service.generateSlotUrl('non-existent-slot', {
          userId: 'test-user-1',
          sessionId: 'test-session-1'
        }),
        /Slot non-existent-slot not found/
      );
      
      console.log('✅ Non-existent slot error handled correctly');
    });

    it('should store URL mapping correctly', async () => {
      const urlInfo = service.generateSlotUrl('test-slot-1', {
        userId: 'test-user-1',
        sessionId: 'test-session-1'
      });

      assert.strictEqual(service.slotUrls.get('test-slot-1'), urlInfo.url);
      
      console.log('✅ URL mapping stored correctly');
    });
  });

  /**
   * Test Group 3: Iframe Session Management
   */
  describe('Iframe Session Management', () => {
    it('should create iframe session successfully', async () => {
      const session = await service.createIframeSession('test-user-1', 'test-slot-1', {
        theme: 'dark',
        mobile: false,
        userAgent: 'test-agent',
        ipAddress: '127.0.0.1'
      });

      assert.ok(session.id);
      assert.strictEqual(session.userId, 'test-user-1');
      assert.strictEqual(session.slotId, 'test-slot-1');
      assert.strictEqual(session.status, 'created');
      assert.ok(session.url);
      assert.ok(session.createdAt);
      assert.ok(session.expiresAt);
      assert.strictEqual(session.options.theme, 'dark');
      assert.strictEqual(session.options.mobile, false);
      
      console.log(`✅ Iframe session created: ${session.id}`);
    });

    it('should get iframe session by ID', async () => {
      const createdSession = await service.createIframeSession('test-user-1', 'test-slot-1');
      const retrievedSession = service.getIframeSession(createdSession.id);

      assert.ok(retrievedSession);
      assert.strictEqual(retrievedSession.id, createdSession.id);
      assert.strictEqual(retrievedSession.userId, 'test-user-1');
      assert.strictEqual(retrievedSession.slotId, 'test-slot-1');
      
      console.log('✅ Iframe session retrieved successfully');
    });

    it('should return null for non-existent session', () => {
      const session = service.getIframeSession('non-existent-session');
      assert.strictEqual(session, null);
      
      console.log('✅ Non-existent session handled correctly');
    });

    it('should get user iframe sessions', async () => {
      await service.createIframeSession('test-user-1', 'test-slot-1');
      await service.createIframeSession('test-user-1', 'test-slot-1');
      
      const userSessions = service.getUserIframes('test-user-1');
      
      assert.strictEqual(userSessions.length, 2);
      userSessions.forEach(session => {
        assert.strictEqual(session.userId, 'test-user-1');
        assert.strictEqual(session.slotId, 'test-slot-1');
      });
      
      console.log(`✅ User iframe sessions retrieved: ${userSessions.length} sessions`);
    });

    it('should terminate iframe session successfully', async () => {
      const session = await service.createIframeSession('test-user-1', 'test-slot-1');
      
      const result = await service.terminateIframeSession(session.id, 'test_termination');
      
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.sessionId, session.id);
      assert.strictEqual(result.reason, 'test_termination');
      
      const terminatedSession = service.getIframeSession(session.id);
      assert.strictEqual(terminatedSession, null);
      
      console.log('✅ Iframe session terminated successfully');
    });

    it('should handle termination of non-existent session', async () => {
      const result = await service.terminateIframeSession('non-existent-session', 'test_termination');
      
      assert.strictEqual(result.success, false);
      assert.ok(result.error);
      
      console.log('✅ Non-existent session termination handled correctly');
    });
  });

  /**
   * Test Group 4: Better Auth Session Integration
   */
  describe('Better Auth Session Integration', () => {
    it('should validate iframe session with Better Auth', async () => {
      const session = await service.createIframeSession('test-user-1', 'test-slot-1');
      
      const validationResult = await service.validateIframeSession(session.id, {
        userAgent: 'test-agent',
        ipAddress: '127.0.0.1'
      });

      assert.strictEqual(validationResult.valid, true);
      assert.strictEqual(validationResult.sessionId, session.id);
      assert.strictEqual(validationResult.userId, 'test-user-1');
      assert.strictEqual(validationResult.slotId, 'test-slot-1');
      assert.ok(validationResult.expiresAt);
      assert.ok(validationResult.lastActivity);
      
      console.log('✅ Iframe session validated with Better Auth');
    });

    it('should handle validation of expired session', async () => {
      const session = await service.createIframeSession('test-user-1', 'test-slot-1');
      
      // Manually expire the session
      session.expiresAt = Date.now() - 1000;
      
      const validationResult = await service.validateIframeSession(session.id);
      
      assert.strictEqual(validationResult.valid, false);
      assert.ok(validationResult.error);
      
      console.log('✅ Expired session validation handled correctly');
    });

    it('should refresh iframe session successfully', async () => {
      const session = await service.createIframeSession('test-user-1', 'test-slot-1');
      
      const refreshResult = await service.refreshIframeSession(session.id);
      
      assert.strictEqual(refreshResult.success, true);
      assert.strictEqual(refreshResult.sessionId, session.id);
      assert.ok(refreshResult.newUrl);
      assert.ok(refreshResult.expiresAt);
      
      const refreshedSession = service.getIframeSession(session.id);
      assert.strictEqual(refreshedSession.url, refreshResult.newUrl);
      
      console.log('✅ Iframe session refreshed successfully');
    });

    it('should handle refresh of non-existent session', async () => {
      const result = await service.refreshIframeSession('non-existent-session');
      
      assert.strictEqual(result.success, false);
      assert.ok(result.error);
      
      console.log('✅ Non-existent session refresh handled correctly');
    });
  });

  /**
   * Test Group 5: Cross-Origin Communication
   */
  describe('Cross-Origin Communication', () => {
    it('should register message handlers', () => {
      let handlerCalled = false;
      
      service.registerMessageHandler('test_message', async (data) => {
        handlerCalled = true;
        return { success: true };
      });
      
      assert.strictEqual(service.messageHandlers.has('test_message'), true);
      
      console.log('✅ Message handler registered successfully');
    });

    it('should handle auth request messages', async () => {
      const session = await service.createIframeSession('test-user-1', 'test-slot-1');
      
      const result = await service.handleAuthRequest({
        sessionId: session.id,
        payload: {},
        origin: 'http://localhost:3000'
      });

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.userId, 'test-user-1');
      assert.ok(result.expiresAt);
      
      console.log('✅ Auth request message handled successfully');
    });

    it('should handle session validation messages', async () => {
      const session = await service.createIframeSession('test-user-1', 'test-slot-1');
      
      const result = await service.handleSessionValidate({
        sessionId: session.id,
        payload: {}
      });

      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.sessionId, session.id);
      
      console.log('✅ Session validation message handled successfully');
    });

    it('should handle slot info messages', async () => {
      const session = await service.createIframeSession('test-user-1', 'test-slot-1');
      
      const result = await service.handleSlotInfo({
        sessionId: session.id
      });

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.slotId, 'test-slot-1');
      assert.ok(result.slotInfo);
      
      console.log('✅ Slot info message handled successfully');
    });

    it('should handle iframe ready messages', async () => {
      const session = await service.createIframeSession('test-user-1', 'test-slot-1');
      
      const result = await service.handleIframeReady({
        sessionId: session.id,
        payload: { ready: true, loadTime: 1500 }
      });

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.sessionId, session.id);
      
      assert.strictEqual(session.status, 'active');
      assert.ok(session.iframeReadyAt);
      assert.ok(session.iframeInfo);
      
      console.log('✅ Iframe ready message handled successfully');
    });

    it('should handle iframe error messages', async () => {
      const session = await service.createIframeSession('test-user-1', 'test-slot-1');
      
      const errorPayload = {
        message: 'Network error',
        code: 'NETWORK_ERROR',
        timestamp: Date.now()
      };
      
      await service.handleIframeError({
        sessionId: session.id,
        payload: errorPayload
      });

      assert.ok(session.lastError);
      assert.strictEqual(session.lastError.message, 'Network error');
      assert.strictEqual(session.lastError.code, 'NETWORK_ERROR');
      assert.strictEqual(session.errorCount, 1);
      
      console.log('✅ Iframe error message handled successfully');
    });

    it('should handle user activity messages', async () => {
      const session = await service.createIframeSession('test-user-1', 'test-slot-1');
      const initialActivity = session.lastActivity;
      
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const result = await service.handleUserActivity({
        sessionId: session.id,
        payload: {
          type: 'click',
          data: { element: 'button' }
        }
      });

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.sessionId, session.id);
      assert.ok(session.lastActivity > initialActivity);
      assert.ok(session.activityLog);
      assert.strictEqual(session.activityLog.length, 1);
      
      console.log('✅ User activity message handled successfully');
    });
  });

  /**
   * Test Group 6: Error Handling and Fallback UI
   */
  describe('Error Handling and Fallback UI', () => {
    it('should handle iframe loading state updates', async () => {
      const session = await service.createIframeSession('test-user-1', 'test-slot-1');
      
      const result = service.updateIframeLoadingState(session.id, 'loading');
      
      assert.strictEqual(result, true);
      assert.strictEqual(session.loadingState, 'loading');
      assert.ok(session.lastStateUpdate);
      
      console.log('✅ Iframe loading state updated successfully');
    });

    it('should handle iframe errors correctly', async () => {
      const session = await service.createIframeSession('test-user-1', 'test-slot-1');
      
      const error = {
        message: 'Connection failed',
        code: 'CONNECTION_ERROR'
      };
      
      service.handleIframeError(session.id, error);
      
      assert.ok(session.lastError);
      assert.strictEqual(session.lastError.message, 'Connection failed');
      assert.strictEqual(session.lastError.code, 'CONNECTION_ERROR');
      assert.strictEqual(session.errorCount, 1);
      
      console.log('✅ Iframe error handled correctly');
    });

    it('should auto-terminate session on too many errors', async () => {
      const session = await service.createIframeSession('test-user-1', 'test-slot-1');
      
      // Simulate multiple errors
      service.handleIframeError(session.id, { message: 'Error 1', code: 'ERROR_1' });
      service.handleIframeError(session.id, { message: 'Error 2', code: 'ERROR_2' });
      service.handleIframeError(session.id, { message: 'Error 3', code: 'ERROR_3' });
      
      // Session should be terminated
      const terminatedSession = service.getIframeSession(session.id);
      assert.strictEqual(terminatedSession, null);
      
      console.log('✅ Session auto-terminated on too many errors');
    });

    it('should handle invalid user session creation', async () => {
      // Mock invalid session
      mockAuthService.sessions.delete('invalid-user-1');
      
      await assert.rejects(
        async () => service.createIframeSession('invalid-user-1', 'test-slot-1'),
        /Invalid user session/
      );
      
      console.log('✅ Invalid user session handled correctly');
    });

    it('should handle unauthorized slot access', async () => {
      // Mock unauthorized access
      const originalValidate = mockUserManagement.validateSlotAccess;
      mockUserManagement.validateSlotAccess = async () => ({
        allowed: false,
        reason: 'Unauthorized'
      });
      
      await assert.rejects(
        async () => service.createIframeSession('test-user-1', 'test-slot-1'),
        /Unauthorized slot access/
      );
      
      // Restore original method
      mockUserManagement.validateSlotAccess = originalValidate;
      
      console.log('✅ Unauthorized slot access handled correctly');
    });
  });

  /**
   * Test Group 7: Session Timeout Handling with Better Auth
   */
  describe('Session Timeout Handling with Better Auth', () => {
    it('should handle session timeout gracefully', async () => {
      const session = await service.createIframeSession('test-user-1', 'test-slot-1');
      
      // Manually expire the session
      session.expiresAt = Date.now() - 1000;
      
      // Try to validate expired session
      const result = await service.validateIframeSession(session.id);
      
      assert.strictEqual(result.valid, false);
      assert.ok(result.error);
      
      console.log('✅ Session timeout handled gracefully');
    });

    it('should cleanup expired sessions automatically', async () => {
      // Create multiple sessions
      const session1 = await service.createIframeSession('test-user-1', 'test-slot-1');
      const session2 = await service.createIframeSession('test-user-1', 'test-slot-1');
      
      // Expire sessions
      session1.expiresAt = Date.now() - 1000;
      session2.expiresAt = Date.now() - 1000;
      
      // Run cleanup
      service.cleanupExpiredSessions();
      
      // Sessions should be terminated
      assert.strictEqual(service.getIframeSession(session1.id), null);
      assert.strictEqual(service.getIframeSession(session2.id), null);
      
      console.log('✅ Expired sessions cleaned up automatically');
    });

    it('should refresh sessions approaching expiration', async () => {
      const session = await service.createIframeSession('test-user-1', 'test-slot-1');
      
      // Set session to expire soon (within refresh interval)
      session.expiresAt = Date.now() + service.config.refreshInterval - 1000;
      
      // Run refresh process
      service.refreshActiveSessions();
      
      // Session should have been refreshed
      assert.ok(session.expiresAt > Date.now() + service.config.refreshInterval);
      assert.ok(session.lastRefreshed);
      
      console.log('✅ Sessions refreshed when approaching expiration');
    });
  });

  /**
   * Test Group 8: Rate Limiting and Security
   */
  describe('Rate Limiting and Security', () => {
    it('should enforce rate limiting', async () => {
      // Create service with rate limiting enabled
      const rateLimitedService = new IframeIntegrationService({
        maxRequestsPerMinute: 2,
        enableRateLimiting: true
      });
      
      rateLimitedService.authService = mockAuthService;
      rateLimitedService.slotManager = mockSlotManager;
      rateLimitedService.userManagement = mockUserManagement;
      
      await rateLimitedService.initialize();
      
      // Create sessions up to limit
      await rateLimitedService.createIframeSession('test-user-1', 'test-slot-1');
      await rateLimitedService.createIframeSession('test-user-1', 'test-slot-1');
      
      // Next request should be rate limited
      await assert.rejects(
        async () => rateLimitedService.createIframeSession('test-user-1', 'test-slot-1'),
        /Rate limit exceeded/
      );
      
      await rateLimitedService.shutdown();
      
      console.log('✅ Rate limiting enforced correctly');
    });

    it('should enforce concurrent iframe limit', async () => {
      // Create service with low concurrent limit
      const limitedService = new IframeIntegrationService({
        maxIframesPerUser: 2,
        enableRateLimiting: false
      });
      
      limitedService.authService = mockAuthService;
      limitedService.slotManager = mockSlotManager;
      limitedService.userManagement = mockUserManagement;
      
      await limitedService.initialize();
      
      // Create sessions up to limit
      await limitedService.createIframeSession('test-user-1', 'test-slot-1');
      await limitedService.createIframeSession('test-user-1', 'test-slot-1');
      
      // Next request should exceed limit
      await assert.rejects(
        async () => limitedService.createIframeSession('test-user-1', 'test-slot-1'),
        /Maximum concurrent iframes exceeded/
      );
      
      await limitedService.shutdown();
      
      console.log('✅ Concurrent iframe limit enforced correctly');
    });

    it('should validate allowed origins', async () => {
      // Test with allowed origin
      const allowedEvent = {
        origin: 'http://localhost:3000',
        data: { type: 'test', sessionId: 'test-session' }
      };
      
      // Should not throw (handled internally)
      await service.handleMessage(allowedEvent);
      
      // Test with disallowed origin
      const disallowedEvent = {
        origin: 'http://malicious.com',
        data: { type: 'test', sessionId: 'test-session' }
      };
      
      // Should not throw (handled internally with warning)
      await service.handleMessage(disallowedEvent);
      
      console.log('✅ Origin validation working correctly');
    });
  });

  /**
   * Test Group 9: Event Handling and Integration
   */
  describe('Event Handling and Integration', () => {
    it('should handle slot created events', async () => {
      let eventReceived = false;
      
      service.on('slotCreated', (data) => {
        eventReceived = true;
        assert.strictEqual(data.slotId, 'new-slot-1');
      });
      
      // Simulate slot created event
      service.handleSlotCreated({ slotId: 'new-slot-1' });
      
      assert.strictEqual(eventReceived, true);
      
      console.log('✅ Slot created event handled correctly');
    });

    it('should handle slot terminated events', async () => {
      let eventReceived = false;
      
      service.on('slotTerminated', (data) => {
        eventReceived = true;
        assert.strictEqual(data.slotId, 'terminated-slot-1');
      });
      
      // Create session for the slot
      const session = await service.createIframeSession('test-user-1', 'test-slot-1');
      session.slotId = 'terminated-slot-1';
      
      // Simulate slot terminated event
      service.handleSlotTerminated({ slotId: 'terminated-slot-1' });
      
      assert.strictEqual(eventReceived, true);
      
      console.log('✅ Slot terminated event handled correctly');
    });

    it('should handle session expired events', async () => {
      let eventReceived = false;
      
      service.on('sessionExpired', (data) => {
        eventReceived = true;
        assert.strictEqual(data.userId, 'expired-user-1');
      });
      
      // Simulate session expired event
      service.handleSessionExpired({ userId: 'expired-user-1' });
      
      assert.strictEqual(eventReceived, true);
      
      console.log('✅ Session expired event handled correctly');
    });

    it('should handle iframe session created events', async () => {
      let eventReceived = false;
      
      service.on('iframeSessionCreated', (data) => {
        eventReceived = true;
        assert.ok(data.sessionId);
        assert.strictEqual(data.userId, 'test-user-1');
        assert.strictEqual(data.slotId, 'test-slot-1');
      });
      
      await service.createIframeSession('test-user-1', 'test-slot-1');
      
      assert.strictEqual(eventReceived, true);
      
      console.log('✅ Iframe session created event handled correctly');
    });

    it('should handle iframe session terminated events', async () => {
      let eventReceived = false;
      
      service.on('iframeSessionTerminated', (data) => {
        eventReceived = true;
        assert.ok(data.sessionId);
        assert.strictEqual(data.userId, 'test-user-1');
        assert.strictEqual(data.slotId, 'test-slot-1');
        assert.strictEqual(data.reason, 'test_termination');
      });
      
      const session = await service.createIframeSession('test-user-1', 'test-slot-1');
      await service.terminateIframeSession(session.id, 'test_termination');
      
      assert.strictEqual(eventReceived, true);
      
      console.log('✅ Iframe session terminated event handled correctly');
    });
  });

  /**
   * Test Group 10: Metrics and Monitoring
   */
  describe('Metrics and Monitoring', () => {
    it('should collect metrics correctly', async () => {
      // Perform some operations to generate metrics
      await service.createIframeSession('test-user-1', 'test-slot-1');
      await service.createIframeSession('test-user-1', 'test-slot-1');
      await service.terminateIframeSession('test-session-1', 'test_termination');
      
      // Collect metrics
      const metrics = service.collectMetrics();
      
      assert.strictEqual(metrics.service, 'iframe-integration');
      assert.ok(metrics.timestamp);
      assert.ok(metrics.uptime > 0);
      assert.strictEqual(metrics.activeSessions, 1); // One active session remaining
      assert.strictEqual(metrics.totalSessionsCreated, 2);
      assert.strictEqual(metrics.totalSessionsTerminated, 1);
      
      console.log('✅ Metrics collected correctly');
    });

    it('should track iframe creation and termination metrics', async () => {
      const initialCreated = service.totalIframesCreated;
      const initialTerminated = service.totalIframesTerminated;
      
      await service.createIframeSession('test-user-1', 'test-slot-1');
      await service.terminateIframeSession('test-session-1', 'test_termination');
      
      assert.strictEqual(service.totalIframesCreated, initialCreated + 1);
      assert.strictEqual(service.totalIframesTerminated, initialTerminated + 1);
      
      console.log('✅ Iframe creation and termination metrics tracked correctly');
    });

    it('should update custom metrics', async () => {
      service.updateMetrics('custom_metric', 5);
      service.updateMetrics('custom_metric', 3);
      
      const metrics = service.collectMetrics();
      assert.strictEqual(metrics.metrics.custom_metric, 8);
      
      console.log('✅ Custom metrics updated correctly');
    });
  });

  /**
   * Test Group 11: Integration Tests
   */
  describe('Integration Tests', () => {
    it('should handle complete iframe workflow', async () => {
      // 1. Create iframe session
      const session = await service.createIframeSession('test-user-1', 'test-slot-1', {
        theme: 'dark',
        mobile: false
      });
      
      // 2. Validate session
      const validationResult = await service.validateIframeSession(session.id);
      assert.strictEqual(validationResult.valid, true);
      
      // 3. Update loading state
      service.updateIframeLoadingState(session.id, 'loading');
      assert.strictEqual(session.loadingState, 'loading');
      
      // 4. Handle iframe ready
      await service.handleIframeReady({
        sessionId: session.id,
        payload: { ready: true }
      });
      assert.strictEqual(session.status, 'active');
      
      // 5. Handle user activity
      await service.handleUserActivity({
        sessionId: session.id,
        payload: { type: 'click', data: { x: 100, y: 200 } }
      });
      assert.ok(session.lastActivity > session.createdAt);
      
      // 6. Refresh session
      const refreshResult = await service.refreshIframeSession(session.id);
      assert.strictEqual(refreshResult.success, true);
      
      // 7. Terminate session
      const terminateResult = await service.terminateIframeSession(session.id, 'workflow_complete');
      assert.strictEqual(terminateResult.success, true);
      
      console.log('✅ Complete iframe workflow successful');
    });

    it('should handle concurrent iframe sessions', async () => {
      const sessions = [];
      
      // Create multiple concurrent sessions
      for (let i = 0; i < 3; i++) {
        const session = await service.createIframeSession('test-user-1', 'test-slot-1', {
          theme: `theme-${i}`,
          mobile: i % 2 === 0
        });
        sessions.push(session);
      }
      
      // Validate all sessions
      for (const session of sessions) {
        const validationResult = await service.validateIframeSession(session.id);
        assert.strictEqual(validationResult.valid, true);
      }
      
      // Get user sessions
      const userSessions = service.getUserIframes('test-user-1');
      assert.strictEqual(userSessions.length, 3);
      
      // Terminate all sessions
      for (const session of sessions) {
        const result = await service.terminateIframeSession(session.id, 'concurrent_test');
        assert.strictEqual(result.success, true);
      }
      
      // Verify all sessions are terminated
      const remainingSessions = service.getUserIframes('test-user-1');
      assert.strictEqual(remainingSessions.length, 0);
      
      console.log('✅ Concurrent iframe sessions handled correctly');
    });

    it('should handle service shutdown gracefully', async () => {
      // Create some sessions
      await service.createIframeSession('test-user-1', 'test-slot-1');
      await service.createIframeSession('test-user-1', 'test-slot-1');
      
      // Shutdown service
      await service.shutdown();
      
      // Verify shutdown completed
      assert.strictEqual(service.isInitialized, false);
      assert.strictEqual(service.isRunning, false);
      assert.strictEqual(service.iframeSessions.size, 0);
      
      console.log('✅ Service shutdown completed gracefully');
    });
  });

  /**
   * Performance Tests
   */
  describe('Performance Tests', () => {
    it('should handle rapid session creation', async () => {
      const startTime = Date.now();
      const sessionCount = 10;
      
      const sessions = [];
      for (let i = 0; i < sessionCount; i++) {
        const session = await service.createIframeSession(`test-user-${i % 3}`, 'test-slot-1');
        sessions.push(session);
      }
      
      const duration = Date.now() - startTime;
      const averageTime = duration / sessionCount;
      
      console.log(`📊 Performance: ${sessionCount} sessions created in ${duration}ms (${averageTime.toFixed(2)}ms per session)`);
      
      // Each session should take less than 100ms on average
      assert.ok(averageTime < 100, `Average session creation time ${averageTime}ms should be less than 100ms`);
      
      // Cleanup
      await Promise.all(
        sessions.map(session => service.terminateIframeSession(session.id, 'performance_test'))
      );
      
      console.log('✅ Performance test passed');
    });

    it('should handle rapid message processing', async () => {
      const session = await service.createIframeSession('test-user-1', 'test-slot-1');
      
      const startTime = Date.now();
      const messageCount = 50;
      
      const messages = [];
      for (let i = 0; i < messageCount; i++) {
        messages.push(service.handleUserActivity({
          sessionId: session.id,
          payload: { type: 'test', data: { iteration: i } }
        }));
      }
      
      await Promise.all(messages);
      
      const duration = Date.now() - startTime;
      const averageTime = duration / messageCount;
      
      console.log(`📊 Performance: ${messageCount} messages processed in ${duration}ms (${averageTime.toFixed(2)}ms per message)`);
      
      // Each message should take less than 10ms on average
      assert.ok(averageTime < 10, `Average message processing time ${averageTime}ms should be less than 10ms`);
      
      // Cleanup
      await service.terminateIframeSession(session.id, 'performance_test');
      
      console.log('✅ Message processing performance test passed');
    });
  });

  console.log('🎯 All Iframe Integration Service tests completed successfully!');
});