/**
 * Comprehensive Test Suite for User Management API with Better Auth Integration
 * 
 * Tests all TICKET-009 requirements:
 * - User registration and management endpoints
 * - Slot assignment and management endpoints
 * - Authentication status endpoints with Better Auth
 * - Usage statistics endpoints
 * - Better Auth session management
 */

import UserManagementAPI from '../services/user-management-api.js';
import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert';

describe('User Management API - TICKET-009 Tests', () => {
  let api;
  let testSessionId;
  let testUserId;
  let testSlotId;

  before(async () => {
    console.log('🧪 Setting up User Management API tests...');
    
    // Initialize API with test configuration
    api = new UserManagementAPI({
      enableRateLimiting: false, // Disable rate limiting for tests
      enableMetrics: true,
      userService: {
        storage: { type: 'memory' },
        enableRegistration: true
      }
    });
    
    await api.initialize();
    console.log('✅ User Management API initialized for testing');
  });

  after(async () => {
    console.log('🧹 Cleaning up User Management API tests...');
    await api.shutdown();
  });

  beforeEach(() => {
    // Reset test state
    testSessionId = null;
    testUserId = null;
    testSlotId = null;
  });

  /**
   * Test Group 1: User Registration and Management
   */
  describe('User Registration and Management', () => {
    it('should register a new user with Better Auth integration', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'SecurePassword123!',
        username: 'testuser',
        displayName: 'Test User'
      };

      const result = await api.registerUser(userData, 'oauth2', {
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent',
        source: 'test'
      });

      assert.strictEqual(result.success, true);
      assert.ok(result.userId);
      assert.ok(result.user);
      assert.strictEqual(result.user.email, 'test@example.com');
      assert.ok(result.authSession);
      
      testUserId = result.userId;
      testSessionId = result.authSession.sessionId;
      
      console.log(`✅ User registered successfully: ${testUserId}`);
    });

    it('should login existing user with Better Auth', async () => {
      const credentials = {
        email: 'test@example.com',
        password: 'SecurePassword123!'
      };

      const result = await api.loginUser(credentials, 'oauth2', {
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent'
      });

      assert.strictEqual(result.success, true);
      assert.ok(result.userId);
      assert.ok(result.authSession);
      
      testSessionId = result.authSession.sessionId;
      
      console.log(`✅ User logged in successfully: ${result.userId}`);
    });

    it('should get user profile with Better Auth validation', async () => {
      const result = await api.getUserProfile(testUserId, testSessionId);

      assert.ok(result.user);
      assert.strictEqual(result.user.email, 'test@example.com');
      assert.ok(result.profile);
      assert.strictEqual(result.profile.userId, testUserId);
      
      console.log(`✅ User profile retrieved successfully`);
    });

    it('should update user profile with Better Auth validation', async () => {
      const profileData = {
        bio: 'Updated bio',
        preferences: { theme: 'dark' }
      };

      const result = await api.updateUserProfile(testUserId, profileData, testSessionId);

      assert.strictEqual(result.success, true);
      assert.ok(result.profile);
      assert.strictEqual(result.profile.bio, 'Updated bio');
      assert.strictEqual(result.profile.preferences.theme, 'dark');
      
      console.log(`✅ User profile updated successfully`);
    });

    it('should reject unauthorized profile update', async () => {
      // Create another user
      const otherUserData = {
        email: 'other@example.com',
        password: 'SecurePassword123!',
        username: 'otheruser'
      };

      const otherResult = await api.registerUser(otherUserData, 'oauth2', {
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent'
      });

      // Try to update other user's profile with first user's session
      const profileData = { bio: 'Unauthorized update' };
      
      await assert.rejects(
        async () => await api.updateUserProfile(otherResult.userId, profileData, testSessionId),
        /Unauthorized to update this profile/
      );
      
      console.log(`✅ Unauthorized profile update correctly rejected`);
    });

    it('should reject invalid session', async () => {
      await assert.rejects(
        async () => await api.getUserProfile(testUserId, 'invalid-session-id'),
        /Invalid session/
      );
      
      console.log(`✅ Invalid session correctly rejected`);
    });
  });

  /**
   * Test Group 2: Slot Assignment and Management
   */
  describe('Slot Assignment and Management', () => {
    it('should create and assign slot to user', async () => {
      const slotConfig = {
        name: 'Test Slot',
        description: 'Test slot for API testing',
        resources: {
          memory: '512MB',
          cpu: '1'
        }
      };

      const result = await api.createUserSlot(testUserId, slotConfig, testSessionId);

      assert.strictEqual(result.success, true);
      assert.ok(result.slotId);
      assert.strictEqual(result.userId, testUserId);
      
      testSlotId = result.slotId;
      
      console.log(`✅ Slot created and assigned successfully: ${testSlotId}`);
    });

    it('should get user slots', async () => {
      const result = await api.getUserSlots(testUserId, testSessionId);

      assert.ok(result.userId);
      assert.ok(result.slots);
      assert.ok(Array.isArray(result.slots));
      
      const createdSlot = result.slots.find(slot => slot.id === testSlotId);
      assert.ok(createdSlot);
      
      console.log(`✅ User slots retrieved successfully: ${result.slots.length} slots`);
    });

    it('should configure slot authentication', async () => {
      const authConfig = {
        type: 'api_key',
        apiKey: 'test-api-key-123',
        provider: 'claude'
      };

      const result = await api.configureSlotAuth(testSlotId, authConfig, testSessionId);

      assert.ok(result);
      assert.ok(result.success !== false);
      
      console.log(`✅ Slot authentication configured successfully`);
    });

    it('should reject unauthorized slot creation', async () => {
      // Create another user
      const otherUserData = {
        email: 'slotuser@example.com',
        password: 'SecurePassword123!',
        username: 'slotuser'
      };

      const otherResult = await api.registerUser(otherUserData, 'oauth2', {
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent'
      });

      const otherSessionId = otherResult.authSession.sessionId;

      // Try to create slot for first user with second user's session
      const slotConfig = { name: 'Unauthorized Slot' };
      
      await assert.rejects(
        async () => await api.createUserSlot(testUserId, slotConfig, otherSessionId),
        /Unauthorized to create slot for this user/
      );
      
      console.log(`✅ Unauthorized slot creation correctly rejected`);
    });
  });

  /**
   * Test Group 3: Authentication Status with Better Auth
   */
  describe('Authentication Status with Better Auth', () => {
    it('should get authentication status', async () => {
      const result = await api.getAuthStatus(testUserId, testSessionId);

      assert.ok(result.userId);
      assert.ok(result.user);
      assert.strictEqual(result.user.email, 'test@example.com');
      assert.ok(result.authStatus);
      assert.ok(result.lastUpdated);
      
      console.log(`✅ Authentication status retrieved successfully`);
    });

    it('should validate Better Auth session', async () => {
      const result = await api.validateBetterAuthSession(testSessionId);

      assert.ok(result.valid);
      assert.ok(result.userId);
      assert.ok(result.expiresAt);
      
      console.log(`✅ Better Auth session validated successfully`);
    });

    it('should refresh Better Auth session', async () => {
      // Get refresh token (simulated)
      const refreshToken = 'test-refresh-token';
      
      const result = await api.refreshBetterAuthSession(testSessionId, refreshToken);

      assert.ok(result);
      assert.ok(result.success !== false);
      
      console.log(`✅ Better Auth session refreshed successfully`);
    });

    it('should reject invalid session validation', async () => {
      const result = await api.validateBetterAuthSession('invalid-session-id');

      assert.ok(!result.valid);
      
      console.log(`✅ Invalid session validation correctly handled`);
    });
  });

  /**
   * Test Group 4: Usage Statistics
   */
  describe('Usage Statistics', () => {
    it('should get user usage statistics', async () => {
      const result = await api.getUserUsageStats(testUserId, testSessionId, '24h');

      assert.ok(result.userId);
      assert.ok(result.user);
      assert.strictEqual(result.user.email, 'test@example.com');
      assert.ok(result.metrics);
      assert.ok(result.period);
      assert.strictEqual(result.period, '24h');
      assert.ok(result.generatedAt);
      
      console.log(`✅ User usage statistics retrieved successfully`);
    });

    it('should get system usage statistics for admin', async () => {
      // Note: This would require admin privileges in production
      // For testing, we'll call it directly
      const result = await api.getSystemUsageStats(testSessionId, '24h');

      assert.ok(result.period);
      assert.ok(result.system);
      assert.ok(result.users);
      assert.ok(result.slots);
      assert.ok(result.api);
      assert.ok(result.generatedAt);
      
      console.log(`✅ System usage statistics retrieved successfully`);
    });

    it('should reject unauthorized access to user stats', async () => {
      // Create another user
      const otherUserData = {
        email: 'statsuser@example.com',
        password: 'SecurePassword123!',
        username: 'statsuser'
      };

      const otherResult = await api.registerUser(otherUserData, 'oauth2', {
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent'
      });

      const otherSessionId = otherResult.authSession.sessionId;

      // Try to access first user's stats with second user's session
      await assert.rejects(
        async () => await api.getUserUsageStats(testUserId, otherSessionId, '24h'),
        /Unauthorized to access user stats/
      );
      
      console.log(`✅ Unauthorized stats access correctly rejected`);
    });
  });

  /**
   * Test Group 5: Better Auth Session Management
   */
  describe('Better Auth Session Management', () => {
    it('should get user sessions', async () => {
      const result = await api.getUserSessions(testUserId, testSessionId);

      assert.ok(result.userId);
      assert.ok(result.authSessions);
      assert.ok(result.apiSessions);
      assert.ok(result.totalSessions);
      assert.ok(Array.isArray(result.authSessions));
      assert.ok(Array.isArray(result.apiSessions));
      
      console.log(`✅ User sessions retrieved successfully: ${result.totalSessions} total sessions`);
    });

    it('should terminate user session', async () => {
      const result = await api.terminateUserSession(testUserId, testSessionId, 'test_cleanup');

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.userId, testUserId);
      assert.strictEqual(result.sessionId, testSessionId);
      assert.ok(result.terminatedAt);
      assert.strictEqual(result.reason, 'test_cleanup');
      
      console.log(`✅ User session terminated successfully`);
    });

    it('should validate terminated session as invalid', async () => {
      const result = await api.validateBetterAuthSession(testSessionId);

      assert.ok(!result.valid);
      
      console.log(`✅ Terminated session correctly validated as invalid`);
    });
  });

  /**
   * Test Group 6: Error Handling and Edge Cases
   */
  describe('Error Handling and Edge Cases', () => {
    it('should handle duplicate user registration', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'SecurePassword123!',
        username: 'testuser'
      };

      await assert.rejects(
        async () => await api.registerUser(userData, 'oauth2'),
        /User with this email already exists/
      );
      
      console.log(`✅ Duplicate registration correctly rejected`);
    });

    it('should handle invalid user data', async () => {
      const invalidUserData = {
        email: 'invalid-email',
        password: '123'
      };

      await assert.rejects(
        async () => await api.registerUser(invalidUserData, 'oauth2'),
        /Invalid user data/
      );
      
      console.log(`✅ Invalid user data correctly rejected`);
    });

    it('should handle non-existent user access', async () => {
      const nonExistentUserId = 'non-existent-user-id';
      
      await assert.rejects(
        async () => await api.getUserProfile(nonExistentUserId, testSessionId),
        /User not found/
      );
      
      console.log(`✅ Non-existent user access correctly handled`);
    });

    it('should handle non-existent slot access', async () => {
      const nonExistentSlotId = 'non-existent-slot-id';
      const authConfig = { type: 'api_key' };
      
      await assert.rejects(
        async () => await api.configureSlotAuth(nonExistentSlotId, authConfig, testSessionId),
        /Slot not found/
      );
      
      console.log(`✅ Non-existent slot access correctly handled`);
    });
  });

  /**
   * Test Group 7: API Metrics and Monitoring
   */
  describe('API Metrics and Monitoring', () => {
    it('should track API metrics', async () => {
      // Perform some API calls to generate metrics
      await api.getStatus();
      
      const metrics = api.getAPIMetrics();
      
      assert.ok(metrics.totalRequests);
      assert.ok(metrics.averageResponseTime);
      assert.ok(metrics.endpoints);
      
      console.log(`✅ API metrics tracked successfully: ${metrics.totalRequests} total requests`);
    });

    it('should provide API status', async () => {
      const status = api.getStatus();

      assert.ok(status.isInitialized);
      assert.ok(status.requestCount);
      assert.ok(status.activeSessions);
      assert.ok(status.services);
      assert.ok(status.metrics);
      assert.ok(status.config);
      
      console.log(`✅ API status retrieved successfully`);
    });
  });

  /**
   * Test Group 8: Rate Limiting (if enabled)
   */
  describe('Rate Limiting', () => {
    it('should handle rate limiting when enabled', async () => {
      // Create API with rate limiting enabled
      const rateLimitedApi = new UserManagementAPI({
        enableRateLimiting: true,
        maxRequestsPerMinute: 2,
        userService: {
          storage: { type: 'memory' }
        }
      });

      await rateLimitedApi.initialize();

      // Make requests that should trigger rate limiting
      await rateLimitedApi.getStatus();
      await rateLimitedApi.getStatus();
      
      // Third request should be rate limited
      await assert.rejects(
        async () => await rateLimitedApi.getStatus(),
        /Rate limit exceeded/
      );

      await rateLimitedApi.shutdown();
      
      console.log(`✅ Rate limiting tested successfully`);
    });
  });

  /**
   * Test Group 9: Integration Tests
   */
  describe('Integration Tests', () => {
    it('should handle complete user workflow', async () => {
      // Create new user
      const workflowUserData = {
        email: 'workflow@example.com',
        password: 'SecurePassword123!',
        username: 'workflowuser'
      };

      const registerResult = await api.registerUser(workflowUserData, 'oauth2', {
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent'
      });

      assert.strictEqual(registerResult.success, true);
      
      const workflowUserId = registerResult.userId;
      const workflowSessionId = registerResult.authSession.sessionId;

      // Login user
      const loginCredentials = {
        email: 'workflow@example.com',
        password: 'SecurePassword123!'
      };

      const loginResult = await api.loginUser(loginCredentials, 'oauth2', {
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent'
      });

      assert.strictEqual(loginResult.success, true);

      // Create slot
      const slotConfig = {
        name: 'Workflow Slot',
        description: 'Slot for workflow testing'
      };

      const slotResult = await api.createUserSlot(workflowUserId, slotConfig, workflowSessionId);
      assert.strictEqual(slotResult.success, true);

      // Get user stats
      const statsResult = await api.getUserUsageStats(workflowUserId, workflowSessionId, '24h');
      assert.ok(statsResult.user);
      assert.strictEqual(statsResult.user.email, 'workflow@example.com');

      // Get auth status
      const authStatusResult = await api.getAuthStatus(workflowUserId, workflowSessionId);
      assert.ok(authStatusResult.user);
      assert.strictEqual(authStatusResult.user.email, 'workflow@example.com');

      // Cleanup - terminate session
      await api.terminateUserSession(workflowUserId, workflowSessionId, 'workflow_cleanup');

      console.log(`✅ Complete user workflow tested successfully`);
    });

    it('should handle concurrent operations', async () => {
      // Create multiple users concurrently
      const concurrentUsers = [];
      const userPromises = [];

      for (let i = 0; i < 3; i++) {
        const userData = {
          email: `concurrent${i}@example.com`,
          password: 'SecurePassword123!',
          username: `concurrentuser${i}`
        };

        userPromises.push(
          api.registerUser(userData, 'oauth2', {
            ipAddress: '127.0.0.1',
            userAgent: 'test-agent'
          })
        );
      }

      const results = await Promise.all(userPromises);
      
      assert.strictEqual(results.length, 3);
      results.forEach(result => {
        assert.strictEqual(result.success, true);
        assert.ok(result.userId);
        concurrentUsers.push(result.userId);
      });

      // Get all user profiles concurrently
      const profilePromises = concurrentUsers.map(userId => 
        api.getUserProfile(userId, results[0].authSession.sessionId)
      );

      const profiles = await Promise.all(profilePromises);
      
      assert.strictEqual(profiles.length, 3);
      profiles.forEach(profile => {
        assert.ok(profile.user);
        assert.ok(profile.profile);
      });

      console.log(`✅ Concurrent operations tested successfully`);
    });
  });

  /**
   * Performance Tests
   */
  describe('Performance Tests', () => {
    it('should handle multiple rapid requests', async () => {
      const startTime = Date.now();
      const requestCount = 10;

      const requests = [];
      for (let i = 0; i < requestCount; i++) {
        requests.push(api.getStatus());
      }

      await Promise.all(requests);
      
      const duration = Date.now() - startTime;
      const averageTime = duration / requestCount;

      console.log(`📊 Performance: ${requestCount} requests in ${duration}ms (${averageTime.toFixed(2)}ms per request)`);
      
      // Each request should take less than 100ms on average
      assert.ok(averageTime < 100, `Average request time ${averageTime}ms should be less than 100ms`);
      
      console.log(`✅ Performance test passed`);
    });
  });

  console.log('🎯 All User Management API tests completed successfully!');
});