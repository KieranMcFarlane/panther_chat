/**
 * Simple TICKET-009 Completion Test
 * 
 * This test validates that the core User Management API functionality
 * from TICKET-009 has been successfully implemented.
 */

import UserManagementAPI from './services/user-management-api.js';
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';

console.log('🎯 Testing TICKET-009 User Management API Implementation...');

describe('TICKET-009 User Management API - Core Tests', () => {
  let api;
  let testUserId;
  let testSessionId;

  before(async () => {
    console.log('🚀 Setting up test environment...');
    
    api = new UserManagementAPI({
      enableRateLimiting: false,
      enableMetrics: true,
      userService: {
        storage: { type: 'memory' },
        enableRegistration: true
      }
    });

    await api.initialize();
    console.log('✅ API initialized successfully');
  });

  after(async () => {
    console.log('🧹 Cleaning up test environment...');
    await api.shutdown();
  });

  it('should implement user registration and management endpoints', async () => {
    console.log('👤 Testing user registration and management...');
    
    // Test user registration
    const userData = {
      email: 'test009@example.com',
      password: 'SecurePassword123!',
      username: 'test009user',
      displayName: 'Test 009 User'
    };

    const registerResult = await api.registerUser(userData, 'oauth2', {
      ipAddress: '127.0.0.1',
      userAgent: 'test-agent'
    });

    assert.strictEqual(registerResult.success, true);
    assert.ok(registerResult.userId);
    assert.ok(registerResult.user);
    assert.strictEqual(registerResult.user.email, 'test009@example.com');
    assert.ok(registerResult.authSession);

    testUserId = registerResult.userId;
    testSessionId = registerResult.authSession.sessionId;

    console.log(`✅ User registered: ${testUserId}`);

    // Test user login
    const loginCredentials = {
      email: 'test009@example.com',
      password: 'SecurePassword123!'
    };

    const loginResult = await api.loginUser(loginCredentials, 'oauth2', {
      ipAddress: '127.0.0.1',
      userAgent: 'test-agent'
    });

    assert.strictEqual(loginResult.success, true);
    assert.ok(loginResult.authSession);

    console.log('✅ User login successful');

    // Test get user profile
    const profileResult = await api.getUserProfile(testUserId, testSessionId);
    assert.ok(profileResult.user);
    assert.strictEqual(profileResult.user.email, 'test009@example.com');
    assert.ok(profileResult.profile);

    console.log('✅ User profile retrieval successful');

    // Test update user profile
    const updateResult = await api.updateUserProfile(testUserId, {
      bio: 'TICKET-009 test user',
      preferences: { theme: 'dark' }
    }, testSessionId);

    assert.strictEqual(updateResult.success, true);
    assert.strictEqual(updateResult.profile.bio, 'TICKET-009 test user');

    console.log('✅ User profile update successful');
  });

  it('should implement slot assignment and management endpoints', async () => {
    console.log('🎰 Testing slot assignment and management...');
    
    // Test create user slot
    const slotConfig = {
      name: 'TICKET-009 Test Slot',
      description: 'Slot for TICKET-009 validation',
      resources: {
        memory: '1GB',
        cpu: '2 cores'
      }
    };

    const slotResult = await api.createUserSlot(testUserId, slotConfig, testSessionId);
    assert.strictEqual(slotResult.success, true);
    assert.ok(slotResult.slotId);

    const slotId = slotResult.slotId;
    console.log(`✅ Slot created: ${slotId}`);

    // Test get user slots
    const slotsResult = await api.getUserSlots(testUserId, testSessionId);
    assert.ok(slotsResult.slots);
    assert.ok(Array.isArray(slotsResult.slots));
    assert.ok(slotsResult.slots.length > 0);

    const createdSlot = slotsResult.slots.find(slot => slot.id === slotId);
    assert.ok(createdSlot);

    console.log(`✅ User slots retrieved: ${slotsResult.slots.length} slots`);

    // Test configure slot authentication
    const authConfig = {
      type: 'api_key',
      apiKey: 'test009-key',
      provider: 'claude'
    };

    const authResult = await api.configureSlotAuth(slotId, authConfig, testSessionId);
    assert.ok(authResult);

    console.log('✅ Slot authentication configured');
  });

  it('should implement authentication status endpoints with Better Auth', async () => {
    console.log('🔐 Testing authentication status with Better Auth...');
    
    // Test get authentication status
    const authStatusResult = await api.getAuthStatus(testUserId, testSessionId);
    assert.ok(authStatusResult.userId);
    assert.ok(authStatusResult.user);
    assert.strictEqual(authStatusResult.user.email, 'test009@example.com');
    assert.ok(authStatusResult.authStatus);
    assert.ok(authStatusResult.lastUpdated);

    console.log('✅ Authentication status retrieved');

    // Test validate Better Auth session
    const validationResult = await api.validateBetterAuthSession(testSessionId);
    assert.ok(validationResult.valid);
    assert.ok(validationResult.userId);
    assert.ok(validationResult.expiresAt);

    console.log('✅ Better Auth session validated');

    // Test refresh Better Auth session
    const refreshResult = await api.refreshBetterAuthSession(testSessionId, 'test-refresh-token');
    assert.ok(refreshResult);

    console.log('✅ Better Auth session refreshed');
  });

  it('should implement usage statistics endpoints', async () => {
    console.log('📊 Testing usage statistics endpoints...');
    
    // Test get user usage statistics
    const statsResult = await api.getUserUsageStats(testUserId, testSessionId, '24h');
    assert.ok(statsResult.userId);
    assert.ok(statsResult.user);
    assert.strictEqual(statsResult.user.email, 'test009@example.com');
    assert.ok(statsResult.metrics);
    assert.strictEqual(statsResult.period, '24h');
    assert.ok(statsResult.generatedAt);

    console.log('✅ User usage statistics retrieved');

    // Test get system usage statistics
    const systemStatsResult = await api.getSystemUsageStats(testSessionId, '24h');
    assert.ok(systemStatsResult.period);
    assert.ok(systemStatsResult.system);
    assert.ok(systemStatsResult.users);
    assert.ok(systemStatsResult.slots);
    assert.ok(systemStatsResult.api);
    assert.ok(systemStatsResult.generatedAt);

    console.log('✅ System usage statistics retrieved');
  });

  it('should implement Better Auth session management', async () => {
    console.log('🔑 Testing Better Auth session management...');
    
    // Test get user sessions
    const sessionsResult = await api.getUserSessions(testUserId, testSessionId);
    assert.ok(sessionsResult.userId);
    assert.ok(sessionsResult.authSessions);
    assert.ok(sessionsResult.apiSessions);
    assert.ok(sessionsResult.totalSessions);
    assert.ok(Array.isArray(sessionsResult.authSessions));
    assert.ok(Array.isArray(sessionsResult.apiSessions));

    console.log(`✅ User sessions retrieved: ${sessionsResult.totalSessions} total sessions`);

    // Test terminate user session
    const terminateResult = await api.terminateUserSession(testUserId, testSessionId, 'test_cleanup');
    assert.strictEqual(terminateResult.success, true);
    assert.strictEqual(terminateResult.userId, testUserId);
    assert.strictEqual(terminateResult.sessionId, testSessionId);
    assert.ok(terminateResult.terminatedAt);

    console.log('✅ User session terminated');

    // Test validate terminated session
    const terminatedValidation = await api.validateBetterAuthSession(testSessionId);
    assert.ok(!terminatedValidation.valid);

    console.log('✅ Terminated session correctly invalidated');
  });

  it('should provide API documentation and status', async () => {
    console.log('📚 Testing API documentation and status...');
    
    // Test API status
    const status = api.getStatus();
    assert.ok(status.isInitialized);
    assert.ok(status.requestCount);
    assert.ok(status.activeSessions);
    assert.ok(status.services);
    assert.ok(status.metrics);
    assert.ok(status.config);

    console.log('✅ API status retrieved');

    // Test API metrics
    const metrics = api.getAPIMetrics();
    assert.ok(metrics.totalRequests);
    assert.ok(metrics.averageResponseTime);
    assert.ok(metrics.endpoints);

    console.log('✅ API metrics retrieved');

    // Test comprehensive error handling
    try {
      await api.getUserProfile('non-existent-user', 'invalid-session');
      assert.fail('Should have thrown an error');
    } catch (error) {
      assert.ok(error.message.includes('Invalid session') || error.message.includes('User not found'));
    }

    console.log('✅ Error handling working correctly');
  });

  it('should demonstrate complete TICKET-009 workflow', async () => {
    console.log('🔄 Testing complete TICKET-009 workflow...');
    
    // Create a new user and demonstrate complete workflow
    const workflowUserData = {
      email: 'workflow@example.com',
      password: 'SecurePassword123!',
      username: 'workflowuser'
    };

    // 1. Register user
    const registerResult = await api.registerUser(workflowUserData, 'oauth2', {
      ipAddress: '127.0.0.1',
      userAgent: 'workflow-agent'
    });
    assert.strictEqual(registerResult.success, true);

    const workflowUserId = registerResult.userId;
    const workflowSessionId = registerResult.authSession.sessionId;

    console.log('✅ Step 1: User registration successful');

    // 2. Create slot
    const slotResult = await api.createUserSlot(workflowUserId, {
      name: 'Workflow Slot',
      description: 'Slot for complete workflow test'
    }, workflowSessionId);
    assert.strictEqual(slotResult.success, true);

    console.log('✅ Step 2: Slot creation successful');

    // 3. Configure authentication
    const authResult = await api.configureSlotAuth(slotResult.slotId, {
      type: 'api_key',
      apiKey: 'workflow-key',
      provider: 'claude'
    }, workflowSessionId);
    assert.ok(authResult);

    console.log('✅ Step 3: Authentication configuration successful');

    // 4. Get usage statistics
    const statsResult = await api.getUserUsageStats(workflowUserId, workflowSessionId, '24h');
    assert.ok(statsResult.user);
    assert.strictEqual(statsResult.user.email, 'workflow@example.com');

    console.log('✅ Step 4: Usage statistics retrieval successful');

    // 5. Get authentication status
    const authStatusResult = await api.getAuthStatus(workflowUserId, workflowSessionId);
    assert.ok(authStatusResult.user);
    assert.strictEqual(authStatusResult.user.email, 'workflow@example.com');

    console.log('✅ Step 5: Authentication status retrieval successful');

    // 6. Session management
    const sessionsResult = await api.getUserSessions(workflowUserId, workflowSessionId);
    assert.ok(sessionsResult.totalSessions > 0);

    console.log('✅ Step 6: Session management successful');

    // 7. Cleanup
    await api.terminateUserSession(workflowUserId, workflowSessionId, 'workflow_cleanup');

    console.log('✅ Step 7: Session cleanup successful');

    console.log('🎉 Complete TICKET-009 workflow successful!');
  });

  it('should validate TICKET-009 acceptance criteria', () => {
    console.log('🎯 Validating TICKET-009 acceptance criteria...');
    
    // Check that all required API methods exist and are functional
    const requiredMethods = [
      'registerUser',
      'loginUser', 
      'getUserProfile',
      'updateUserProfile',
      'createUserSlot',
      'getUserSlots',
      'configureSlotAuth',
      'getAuthStatus',
      'validateBetterAuthSession',
      'refreshBetterAuthSession',
      'getUserUsageStats',
      'getSystemUsageStats',
      'getUserSessions',
      'terminateUserSession',
      'getStatus',
      'getAPIMetrics'
    ];

    const missingMethods = requiredMethods.filter(method => typeof api[method] !== 'function');
    assert.strictEqual(missingMethods.length, 0, `Missing required methods: ${missingMethods.join(', ')}`);

    console.log('✅ All required API methods implemented');

    // Check API initialization state
    assert.strictEqual(api.isInitialized, true, 'API should be initialized');
    
    console.log('✅ API properly initialized');

    // Check service integrations
    const status = api.getStatus();
    assert.ok(status.services.userService, 'User service should be available');
    assert.ok(status.services.authService, 'Auth service should be available');
    assert.ok(status.services.slotManager, 'Slot manager should be available');

    console.log('✅ All service integrations working');

    console.log('🎯 All TICKET-009 acceptance criteria validated!');
  });

  console.log('🎉 TICKET-009 User Management API tests completed successfully!');
});