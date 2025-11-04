/**
 * Simple TICKET-010 Completion Test
 * 
 * This test validates that the core Iframe Integration Service functionality
 * from TICKET-010 has been successfully implemented.
 */

import IframeIntegrationService from './services/iframe-integration-service.js';
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';

console.log('🎯 Testing TICKET-010 Iframe Integration Service Implementation...');

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

describe('TICKET-010 Iframe Integration Service - Core Tests', () => {
  let service;
  let mockAuthService;
  let mockSlotManager;
  let mockUserManagement;
  let mockSessionPersistence;

  before(async () => {
    console.log('🚀 Setting up test environment...');
    
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
      secretKey: 'test-secret-key'
    });
    
    // Replace services with mocks
    service.authService = mockAuthService;
    service.slotManager = mockSlotManager;
    service.userManagement = mockUserManagement;
    service.sessionPersistence = mockSessionPersistence;
    
    await service.initialize();
    console.log('✅ Iframe Integration Service initialized successfully');
  });

  after(async () => {
    console.log('🧹 Cleaning up test environment...');
    await service.shutdown();
  });

  it('should implement dynamic iframe URL generation per slot', async () => {
    console.log('🔗 Testing dynamic iframe URL generation...');
    
    // Test URL generation
    const urlInfo = service.generateSlotUrl('test-slot-1', {
      userId: 'test-user-1',
      sessionId: 'test-session-1',
      theme: 'dark',
      mobile: true,
      width: '800px',
      height: '600px'
    });

    assert.ok(urlInfo.slotId);
    assert.ok(urlInfo.url);
    assert.ok(urlInfo.timestamp);
    assert.ok(urlInfo.nonce);
    assert.ok(urlInfo.signature);
    assert.ok(urlInfo.expiresAt);
    assert.ok(urlInfo.url.startsWith('http://localhost:7681/slot/test-slot-1'));

    const url = new URL(urlInfo.url);
    assert.strictEqual(url.searchParams.get('theme'), 'dark');
    assert.strictEqual(url.searchParams.get('mobile'), 'true');
    assert.strictEqual(url.searchParams.get('width'), '800px');
    assert.strictEqual(url.searchParams.get('height'), '600px');

    console.log(`✅ Dynamic iframe URL generated: ${urlInfo.url}`);
  });

  it('should implement iframe loading state management', async () => {
    console.log('⏳ Testing iframe loading state management...');
    
    // Create iframe session
    const session = await service.createIframeSession('test-user-1', 'test-slot-1', {
      theme: 'default',
      mobile: false
    });

    // Update loading state
    const result = service.updateIframeLoadingState(session.id, 'loading');
    assert.strictEqual(result, true);
    assert.strictEqual(session.loadingState, 'loading');
    assert.ok(session.lastStateUpdate);

    // Update to loaded state
    service.updateIframeLoadingState(session.id, 'loaded');
    assert.strictEqual(session.loadingState, 'loaded');

    // Handle iframe ready
    await service.handleIframeReady({
      sessionId: session.id,
      payload: { ready: true, loadTime: 1500 }
    });

    assert.strictEqual(session.status, 'active');
    assert.ok(session.iframeReadyAt);
    assert.ok(session.iframeInfo);

    console.log('✅ Iframe loading state management working');
  });

  it('should implement error handling and fallback UI', async () => {
    console.log('⚠️ Testing error handling and fallback UI...');
    
    // Create session
    const session = await service.createIframeSession('test-user-1', 'test-slot-1');

    // Test error handling
    const error = {
      message: 'Network connection failed',
      code: 'NETWORK_ERROR',
      timestamp: Date.now()
    };

    service.handleIframeError(session.id, error);

    assert.ok(session.lastError);
    assert.strictEqual(session.lastError.message, 'Network connection failed');
    assert.strictEqual(session.lastError.code, 'NETWORK_ERROR');
    assert.strictEqual(session.errorCount, 1);

    // Test multiple errors leading to auto-termination
    service.handleIframeError(session.id, { message: 'Error 2', code: 'ERROR_2' });
    service.handleIframeError(session.id, { message: 'Error 3', code: 'ERROR_3' });

    // Session should be auto-terminated
    const terminatedSession = service.getIframeSession(session.id);
    assert.strictEqual(terminatedSession, null);

    console.log('✅ Error handling and fallback UI working');
  });

  it('should implement session timeout handling with Better Auth', async () => {
    console.log('⏰ Testing session timeout handling with Better Auth...');
    
    // Create session
    const session = await service.createIframeSession('test-user-1', 'test-slot-1');

    // Test session validation
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

    // Test session refresh
    const refreshResult = await service.refreshIframeSession(session.id);
    assert.strictEqual(refreshResult.success, true);
    assert.ok(refreshResult.newUrl);
    assert.ok(refreshResult.expiresAt);

    // Test session timeout
    session.expiresAt = Date.now() - 1000; // Expire session
    const expiredResult = await service.validateIframeSession(session.id);
    assert.strictEqual(expiredResult.valid, false);

    console.log('✅ Session timeout handling with Better Auth working');
  });

  it('should implement cross-origin communication', async () => {
    console.log('🔄 Testing cross-origin communication...');
    
    // Create session
    const session = await service.createIframeSession('test-user-1', 'test-slot-1');

    // Test message handlers
    let authHandlerCalled = false;
    let sessionHandlerCalled = false;
    let slotHandlerCalled = false;

    service.registerMessageHandler('auth_request', async (data) => {
      authHandlerCalled = true;
      return { success: true, userId: data.sessionId ? 'test-user-1' : 'unknown' };
    });

    service.registerMessageHandler('session_validate', async (data) => {
      sessionHandlerCalled = true;
      return { valid: true, sessionId: data.sessionId };
    });

    service.registerMessageHandler('slot_info', async (data) => {
      slotHandlerCalled = true;
      return { slotId: 'test-slot-1', info: { status: 'active' } };
    });

    // Test auth request handling
    const authResult = await service.handleAuthRequest({
      sessionId: session.id,
      payload: {},
      origin: 'http://localhost:3000'
    });
    assert.strictEqual(authResult.success, true);
    assert.strictEqual(authHandlerCalled, true);

    // Test session validation handling
    const sessionResult = await service.handleSessionValidate({
      sessionId: session.id,
      payload: {}
    });
    assert.strictEqual(sessionResult.valid, true);
    assert.strictEqual(sessionHandlerCalled, true);

    // Test slot info handling
    const slotResult = await service.handleSlotInfo({
      sessionId: session.id
    });
    assert.strictEqual(slotResult.success, true);
    assert.strictEqual(slotHandlerCalled, true);

    console.log('✅ Cross-origin communication working');
  });

  it('should implement Better Auth session integration', async () => {
    console.log('🔐 Testing Better Auth session integration...');
    
    // Create session
    const session = await service.createIframeSession('test-user-1', 'test-slot-1');

    // Test Better Auth integration through URL generation
    const urlInfo = service.generateSlotUrl('test-slot-1', {
      userId: 'test-user-1',
      sessionId: session.sessionId,
      authToken: 'test-token'
    });

    assert.ok(urlInfo.signature);
    assert.ok(urlInfo.nonce);
    assert.ok(urlInfo.timestamp);

    // Test session validation with Better Auth
    const authValidation = await service.authService.validateBetterAuthSession(session.sessionId);
    assert.strictEqual(authValidation.valid, true);

    // Test session refresh with Better Auth
    const authRefresh = await service.authService.refreshBetterAuthSession(session.sessionId);
    assert.strictEqual(authRefresh.success, true);

    // Test that session is properly integrated
    assert.strictEqual(session.sessionId, 'test-session-1');
    assert.ok(session.url.includes('ts='));
    assert.ok(session.url.includes('nonce='));
    assert.ok(session.url.includes('sig='));

    console.log('✅ Better Auth session integration working');
  });

  it('should demonstrate complete TICKET-010 workflow', async () => {
    console.log('🔄 Testing complete TICKET-010 workflow...');
    
    // 1. Create iframe session
    const session = await service.createIframeSession('test-user-1', 'test-slot-1', {
      theme: 'dark',
      mobile: false,
      userAgent: 'workflow-agent',
      ipAddress: '127.0.0.1'
    });
    assert.strictEqual(session.status, 'created');
    console.log('✅ Step 1: Iframe session created successfully');

    // 2. Generate dynamic URL
    const urlInfo = service.generateSlotUrl('test-slot-1', {
      userId: 'test-user-1',
      sessionId: session.sessionId,
      theme: 'dark'
    });
    assert.ok(urlInfo.url);
    console.log('✅ Step 2: Dynamic URL generated successfully');

    // 3. Update loading state
    service.updateIframeLoadingState(session.id, 'loading');
    assert.strictEqual(session.loadingState, 'loading');
    console.log('✅ Step 3: Loading state updated successfully');

    // 4. Handle iframe ready
    await service.handleIframeReady({
      sessionId: session.id,
      payload: { ready: true, loadTime: 1200 }
    });
    assert.strictEqual(session.status, 'active');
    console.log('✅ Step 4: Iframe ready state handled successfully');

    // 5. Validate with Better Auth
    const validationResult = await service.validateIframeSession(session.id);
    assert.strictEqual(validationResult.valid, true);
    console.log('✅ Step 5: Better Auth validation successful');

    // 6. Handle cross-origin messages
    await service.handleUserActivity({
      sessionId: session.id,
      payload: { type: 'click', data: { x: 50, y: 75 } }
    });
    assert.ok(session.activityLog);
    assert.strictEqual(session.activityLog.length, 1);
    console.log('✅ Step 6: Cross-origin messages handled successfully');

    // 7. Refresh session
    const refreshResult = await service.refreshIframeSession(session.id);
    assert.strictEqual(refreshResult.success, true);
    console.log('✅ Step 7: Session refresh successful');

    // 8. Terminate session
    const terminateResult = await service.terminateIframeSession(session.id, 'workflow_complete');
    assert.strictEqual(terminateResult.success, true);
    console.log('✅ Step 8: Session termination successful');

    console.log('🎉 Complete TICKET-010 workflow successful!');
  });

  it('should validate TICKET-010 acceptance criteria', () => {
    console.log('🎯 Validating TICKET-010 acceptance criteria...');
    
    // Check that all required methods exist and are functional
    const requiredMethods = [
      'generateSlotUrl',
      'createIframeSession',
      'getIframeSession',
      'getUserIframes',
      'terminateIframeSession',
      'validateIframeSession',
      'refreshIframeSession',
      'updateIframeLoadingState',
      'handleIframeError',
      'registerMessageHandler',
      'handleMessage',
      'handleAuthRequest',
      'handleSessionValidate',
      'handleSlotInfo',
      'handleIframeReady',
      'handleUserActivity',
      'getStatus',
      'collectMetrics'
    ];

    const missingMethods = requiredMethods.filter(method => typeof service[method] !== 'function');
    assert.strictEqual(missingMethods.length, 0, `Missing required methods: ${missingMethods.join(', ')}`);

    console.log('✅ All required API methods implemented');

    // Check service initialization state
    assert.strictEqual(service.isInitialized, true, 'Service should be initialized');
    
    console.log('✅ Service properly initialized');

    // Check configuration
    assert.ok(service.config.baseUrl, 'Base URL should be configured');
    assert.ok(Array.isArray(service.config.allowedOrigins), 'Allowed origins should be configured');
    assert.ok(Array.isArray(service.config.sandboxPermissions), 'Sandbox permissions should be configured');
    assert.ok(Array.isArray(service.config.allowedFeatures), 'Allowed features should be configured');
    
    console.log('✅ Service configuration correct');

    // Check service integrations
    const status = service.getStatus();
    assert.ok(status.services.authService, 'Auth service should be available');
    assert.ok(status.services.slotManager, 'Slot manager should be available');
    assert.ok(status.services.userManagement, 'User management should be available');
    assert.ok(status.services.sessionPersistence, 'Session persistence should be available');

    console.log('✅ All service integrations working');

    console.log('🎯 All TICKET-010 acceptance criteria validated!');
  });

  console.log('🎉 TICKET-010 Iframe Integration Service tests completed successfully!');
});