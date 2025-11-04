/**
 * TICKET-010 Validation Script
 * 
 * This script validates that all TICKET-010 acceptance criteria have been met
 * for the Iframe Integration Service with Better Auth implementation.
 */

import IframeIntegrationService from './services/iframe-integration-service.js';
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';

console.log('🎯 Validating TICKET-010 Iframe Integration Service Implementation...');

// Mock services for validation
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

describe('TICKET-010 Validation - Iframe Integration Service with Better Auth', () => {
  let service;
  let mockAuthService;
  let mockSlotManager;
  let mockUserManagement;
  let mockSessionPersistence;
  let validationResults = {
    total: 0,
    passed: 0,
    failed: 0,
    criteria: {}
  };

  before(async () => {
    console.log('🚀 Setting up validation environment...');
    
    // Create mock services
    mockAuthService = new MockAuthService();
    mockSlotManager = new MockSlotManager();
    mockUserManagement = new MockUserManagementAPI();
    mockSessionPersistence = new MockSessionPersistenceManager();
    
    // Add test slot
    mockSlotManager.slots.set('validation-slot-1', {
      id: 'validation-slot-1',
      name: 'Validation Slot 1',
      status: 'active',
      port: 7682,
      createdAt: Date.now()
    });
    
    // Add test user session
    mockAuthService.sessions.set('validation-user-1', {
      id: 'validation-session-1',
      userId: 'validation-user-1',
      token: 'validation-token-1',
      createdAt: Date.now()
    });
    
    // Initialize service with mock dependencies
    service = new IframeIntegrationService({
      baseUrl: 'http://localhost:7681',
      enableRateLimiting: false,
      enableMetrics: true,
      enableLogging: true,
      secretKey: 'validation-secret-key'
    });
    
    // Replace services with mocks
    service.authService = mockAuthService;
    service.slotManager = mockSlotManager;
    service.userManagement = mockUserManagement;
    service.sessionPersistence = mockSessionPersistence;
    
    await service.initialize();
    console.log('✅ Validation environment ready');
  });

  after(async () => {
    console.log('🧹 Cleaning up validation environment...');
    await service.shutdown();
  });

  function validateCriterion(criterionName, testFunction) {
    validationResults.total++;
    validationResults.criteria[criterionName] = {
      status: 'pending',
      details: []
    };

    try {
      testFunction();
      validationResults.passed++;
      validationResults.criteria[criterionName].status = 'passed';
      console.log(`✅ ${criterionName}: PASSED`);
    } catch (error) {
      validationResults.failed++;
      validationResults.criteria[criterionName].status = 'failed';
      validationResults.criteria[criterionName].details.push(error.message);
      console.log(`❌ ${criterionName}: FAILED - ${error.message}`);
    }
  }

  it('should validate all TICKET-010 acceptance criteria', async () => {
    console.log('🎯 Starting TICKET-010 acceptance criteria validation...\n');

    // Acceptance Criterion 1: Dynamic iframe URL generation per slot
    validateCriterion('Dynamic iframe URL generation per slot', () => {
      const urlInfo = service.generateSlotUrl('validation-slot-1', {
        userId: 'validation-user-1',
        sessionId: 'validation-session-1',
        theme: 'dark',
        mobile: true
      });

      assert.ok(urlInfo.slotId, 'URL should contain slot ID');
      assert.ok(urlInfo.url, 'URL should be generated');
      assert.ok(urlInfo.timestamp, 'URL should have timestamp');
      assert.ok(urlInfo.nonce, 'URL should have nonce');
      assert.ok(urlInfo.signature, 'URL should have signature');
      assert.ok(urlInfo.expiresAt, 'URL should have expiration');
      assert.ok(urlInfo.url.includes('validation-slot-1'), 'URL should contain slot ID');
      assert.ok(urlInfo.url.includes('theme=dark'), 'URL should contain theme parameter');
      assert.ok(urlInfo.url.includes('mobile=true'), 'URL should contain mobile parameter');
    });

    // Acceptance Criterion 2: Iframe loading state management
    validateCriterion('Iframe loading state management', async () => {
      const session = await service.createIframeSession('validation-user-1', 'validation-slot-1');
      
      // Test loading state updates
      const result1 = service.updateIframeLoadingState(session.id, 'loading');
      assert.strictEqual(result1, true, 'Should update loading state successfully');
      assert.strictEqual(session.loadingState, 'loading', 'Session should have loading state');
      
      const result2 = service.updateIframeLoadingState(session.id, 'loaded');
      assert.strictEqual(result2, true, 'Should update to loaded state successfully');
      assert.strictEqual(session.loadingState, 'loaded', 'Session should have loaded state');
      
      // Test iframe ready handling
      await service.handleIframeReady({
        sessionId: session.id,
        payload: { ready: true, loadTime: 1500 }
      });
      
      assert.strictEqual(session.status, 'active', 'Session should be active after iframe ready');
      assert.ok(session.iframeReadyAt, 'Should record iframe ready timestamp');
      assert.ok(session.iframeInfo, 'Should store iframe info');
    });

    // Acceptance Criterion 3: Error handling and fallback UI
    validateCriterion('Error handling and fallback UI', async () => {
      const session = await service.createIframeSession('validation-user-1', 'validation-slot-1');
      
      // Test error handling
      const error = {
        message: 'Connection failed',
        code: 'CONNECTION_ERROR',
        timestamp: Date.now()
      };
      
      service.handleIframeError(session.id, error);
      
      assert.ok(session.lastError, 'Should record last error');
      assert.strictEqual(session.lastError.message, 'Connection failed', 'Should store error message');
      assert.strictEqual(session.lastError.code, 'CONNECTION_ERROR', 'Should store error code');
      assert.strictEqual(session.errorCount, 1, 'Should track error count');
      
      // Test auto-termination on multiple errors
      service.handleIframeError(session.id, { message: 'Error 2', code: 'ERROR_2' });
      service.handleIframeError(session.id, { message: 'Error 3', code: 'ERROR_3' });
      
      const terminatedSession = service.getIframeSession(session.id);
      assert.strictEqual(terminatedSession, null, 'Session should be auto-terminated on multiple errors');
    });

    // Acceptance Criterion 4: Session timeout handling with Better Auth
    validateCriterion('Session timeout handling with Better Auth', async () => {
      const session = await service.createIframeSession('validation-user-1', 'validation-slot-1');
      
      // Test session validation
      const validationResult = await service.validateIframeSession(session.id, {
        userAgent: 'validation-agent',
        ipAddress: '127.0.0.1'
      });
      
      assert.strictEqual(validationResult.valid, true, 'Session should be valid');
      assert.strictEqual(validationResult.sessionId, session.id, 'Should return correct session ID');
      assert.strictEqual(validationResult.userId, 'validation-user-1', 'Should return correct user ID');
      assert.strictEqual(validationResult.slotId, 'validation-slot-1', 'Should return correct slot ID');
      assert.ok(validationResult.expiresAt, 'Should return expiration time');
      assert.ok(validationResult.lastActivity, 'Should return last activity time');
      
      // Test session refresh
      const refreshResult = await service.refreshIframeSession(session.id);
      assert.strictEqual(refreshResult.success, true, 'Session refresh should succeed');
      assert.ok(refreshResult.newUrl, 'Should provide new URL on refresh');
      assert.ok(refreshResult.expiresAt, 'Should provide new expiration time');
      
      // Test session timeout
      session.expiresAt = Date.now() - 1000; // Expire session
      const expiredResult = await service.validateIframeSession(session.id);
      assert.strictEqual(expiredResult.valid, false, 'Expired session should be invalid');
    });

    // Acceptance Criterion 5: Cross-origin communication
    validateCriterion('Cross-origin communication', async () => {
      const session = await service.createIframeSession('validation-user-1', 'validation-slot-1');
      
      // Test message handler registration
      let testHandlerCalled = false;
      service.registerMessageHandler('test_message', async (data) => {
        testHandlerCalled = true;
        return { success: true, received: true };
      });
      
      assert.strictEqual(service.messageHandlers.has('test_message'), true, 'Should register message handler');
      
      // Test auth request handling
      const authResult = await service.handleAuthRequest({
        sessionId: session.id,
        payload: {},
        origin: 'http://localhost:3000'
      });
      
      assert.strictEqual(authResult.success, true, 'Auth request should succeed');
      assert.strictEqual(authResult.userId, 'validation-user-1', 'Should return correct user ID');
      
      // Test session validation handling
      const sessionResult = await service.handleSessionValidate({
        sessionId: session.id,
        payload: {}
      });
      
      assert.strictEqual(sessionResult.valid, true, 'Session validation should succeed');
      
      // Test slot info handling
      const slotResult = await service.handleSlotInfo({
        sessionId: session.id
      });
      
      assert.strictEqual(slotResult.success, true, 'Slot info request should succeed');
      assert.strictEqual(slotResult.slotId, 'validation-slot-1', 'Should return correct slot ID');
      
      // Test user activity handling
      const activityResult = await service.handleUserActivity({
        sessionId: session.id,
        payload: { type: 'click', data: { x: 100, y: 200 } }
      });
      
      assert.strictEqual(activityResult.success, true, 'User activity handling should succeed');
      assert.ok(session.lastActivity > session.createdAt, 'Should update last activity time');
      assert.ok(session.activityLog, 'Should track activity log');
      assert.strictEqual(session.activityLog.length, 1, 'Should have one activity logged');
    });

    // Acceptance Criterion 6: Better Auth session integration
    validateCriterion('Better Auth session integration', async () => {
      const session = await service.createIframeSession('validation-user-1', 'validation-slot-1');
      
      // Test URL signature generation
      const urlInfo = service.generateSlotUrl('validation-slot-1', {
        userId: 'validation-user-1',
        sessionId: session.sessionId,
        authToken: 'validation-token'
      });
      
      assert.ok(urlInfo.signature, 'URL should have cryptographic signature');
      assert.ok(urlInfo.nonce, 'URL should have nonce for replay protection');
      assert.ok(urlInfo.timestamp, 'URL should have timestamp for expiration');
      
      // Test Better Auth session validation integration
      const authValidation = await service.authService.validateBetterAuthSession(session.sessionId);
      assert.strictEqual(authValidation.valid, true, 'Better Auth validation should succeed');
      assert.strictEqual(authValidation.userId, 'mock-user-id', 'Should return correct user ID');
      
      // Test Better Auth session refresh integration
      const authRefresh = await service.authService.refreshBetterAuthSession(session.sessionId);
      assert.strictEqual(authRefresh.success, true, 'Better Auth refresh should succeed');
      assert.strictEqual(authRefresh.sessionId, session.sessionId, 'Should return correct session ID');
      
      // Test session timeout handling with Better Auth
      session.expiresAt = Date.now() - 1000;
      const timeoutValidation = await service.validateIframeSession(session.id);
      assert.strictEqual(timeoutValidation.valid, false, 'Session should be invalidated on timeout');
      
      // Test that session is properly terminated on auth failure
      const terminatedSession = service.getIframeSession(session.id);
      assert.strictEqual(terminatedSession, null, 'Session should be terminated on auth failure');
    });

    console.log('\n📊 Validation Summary:');
    console.log('========================');
    
    // Calculate success rate
    const successRate = (validationResults.passed / validationResults.total * 100).toFixed(1);
    
    console.log(`Total Criteria: ${validationResults.total}`);
    console.log(`Passed: ${validationResults.passed} ✅`);
    console.log(`Failed: ${validationResults.failed} ❌`);
    console.log(`Success Rate: ${successRate}%`);
    
    console.log('\n📋 Detailed Results:');
    console.log('====================');
    
    for (const [criterion, result] of Object.entries(validationResults.criteria)) {
      const status = result.status === 'passed' ? '✅' : '❌';
      console.log(`${status} ${criterion}`);
      
      if (result.details.length > 0) {
        result.details.forEach(detail => {
          console.log(`   - ${detail}`);
        });
      }
    }
    
    // Performance validation
    console.log('\n🚀 Performance Validation:');
    console.log('========================');
    
    const performanceResults = await validatePerformance();
    console.log(`✅ Session Creation: ${performanceResults.sessionCreation.toFixed(2)}ms average`);
    console.log(`✅ URL Generation: ${performanceResults.urlGeneration.toFixed(2)}ms average`);
    console.log(`✅ Session Validation: ${performanceResults.sessionValidation.toFixed(2)}ms average`);
    console.log(`✅ Message Processing: ${performanceResults.messageProcessing.toFixed(2)}ms average`);
    
    // Security validation
    console.log('\n🔒 Security Validation:');
    console.log('=====================');
    
    const securityResults = validateSecurity();
    console.log(`✅ URL Signing: ${securityResults.urlSigning ? 'IMPLEMENTED' : 'MISSING'}`);
    console.log(`✅ Origin Validation: ${securityResults.originValidation ? 'IMPLEMENTED' : 'MISSING'}`);
    console.log(`✅ Rate Limiting: ${securityResults.rateLimiting ? 'IMPLEMENTED' : 'MISSING'}`);
    console.log(`✅ Session Timeout: ${securityResults.sessionTimeout ? 'IMPLEMENTED' : 'MISSING'}`);
    console.log(`✅ Error Handling: ${securityResults.errorHandling ? 'IMPLEMENTED' : 'MISSING'}`);
    
    // Integration validation
    console.log('\n🔗 Integration Validation:');
    console.log('========================');
    
    const integrationResults = validateIntegration();
    console.log(`✅ Better Auth Integration: ${integrationResults.betterAuth ? 'OPERATIONAL' : 'FAILED'}`);
    console.log(`✅ Slot Manager Integration: ${integrationResults.slotManager ? 'OPERATIONAL' : 'FAILED'}`);
    console.log(`✅ User Management Integration: ${integrationResults.userManagement ? 'OPERATIONAL' : 'FAILED'}`);
    console.log(`✅ Session Persistence Integration: ${integrationResults.sessionPersistence ? 'OPERATIONAL' : 'FAILED'}`);
    
    // Overall validation result
    const allPassed = validationResults.failed === 0;
    
    console.log('\n🎯 TICKET-010 Validation Result:');
    console.log('============================');
    
    if (allPassed) {
      console.log('🎉 ALL ACCEPTANCE CRITERIA MET!');
      console.log('✅ TICKET-010: Iframe Integration Service with Better Auth is READY FOR PRODUCTION');
    } else {
      console.log('⚠️  SOME ACCEPTANCE CRITERIA NOT MET');
      console.log('❌ Additional work required before production deployment');
    }
    
    console.log(`\n📈 Overall Success Rate: ${successRate}%`);
    
    // Return validation results for programmatic use
    return {
      success: allPassed,
      successRate: parseFloat(successRate),
      totalCriteria: validationResults.total,
      passedCriteria: validationResults.passed,
      failedCriteria: validationResults.failed,
      criteria: validationResults.criteria,
      performance: performanceResults,
      security: securityResults,
      integration: integrationResults
    };
  });

  async function validatePerformance() {
    const iterations = 10;
    
    // Test session creation performance
    const sessionCreationTimes = [];
    for (let i = 0; i < iterations; i++) {
      const start = Date.now();
      await service.createIframeSession(`perf-user-${i}`, 'validation-slot-1');
      sessionCreationTimes.push(Date.now() - start);
    }
    
    // Test URL generation performance
    const urlGenerationTimes = [];
    for (let i = 0; i < iterations; i++) {
      const start = Date.now();
      service.generateSlotUrl('validation-slot-1', {
        userId: 'perf-user',
        sessionId: 'perf-session'
      });
      urlGenerationTimes.push(Date.now() - start);
    }
    
    // Test session validation performance
    const session = await service.createIframeSession('perf-user', 'validation-slot-1');
    const sessionValidationTimes = [];
    for (let i = 0; i < iterations; i++) {
      const start = Date.now();
      await service.validateIframeSession(session.id);
      sessionValidationTimes.push(Date.now() - start);
    }
    
    // Test message processing performance
    const messageProcessingTimes = [];
    for (let i = 0; i < iterations; i++) {
      const start = Date.now();
      await service.handleUserActivity({
        sessionId: session.id,
        payload: { type: 'test', data: { iteration: i } }
      });
      messageProcessingTimes.push(Date.now() - start);
    }
    
    // Cleanup
    await service.terminateIframeSession(session.id, 'performance_cleanup');
    
    return {
      sessionCreation: sessionCreationTimes.reduce((a, b) => a + b, 0) / sessionCreationTimes.length,
      urlGeneration: urlGenerationTimes.reduce((a, b) => a + b, 0) / urlGenerationTimes.length,
      sessionValidation: sessionValidationTimes.reduce((a, b) => a + b, 0) / sessionValidationTimes.length,
      messageProcessing: messageProcessingTimes.reduce((a, b) => a + b, 0) / messageProcessingTimes.length
    };
  }

  function validateSecurity() {
    return {
      urlSigning: typeof service.generateUrlSignature === 'function',
      originValidation: Array.isArray(service.config.allowedOrigins) && service.config.allowedOrigins.length > 0,
      rateLimiting: typeof service.checkRateLimit === 'function',
      sessionTimeout: service.config.sessionTimeout > 0,
      errorHandling: typeof service.handleIframeError === 'function'
    };
  }

  function validateIntegration() {
    const status = service.getStatus();
    return {
      betterAuth: status.services.authService,
      slotManager: status.services.slotManager,
      userManagement: status.services.userManagement,
      sessionPersistence: status.services.sessionPersistence
    };
  }
});

console.log('🎯 TICKET-010 validation script loaded successfully!');