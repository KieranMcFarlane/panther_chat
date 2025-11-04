#!/usr/bin/env node

/**
 * 🧪 Session Persistence Integration Test Suite
 * 
 * Tests TICKET-008: Session Persistence with Better Auth implementation
 */

import SessionPersistenceManager from './services/session-persistence-manager.js';
import SlotRegistryService from './services/slot-registry-service.js';
import UserManagementService from './services/user-management-service.js';
import EnhancedAuthService from './services/enhanced-auth-service.js';

class SessionPersistenceTest {
  constructor() {
    this.sessionManager = null;
    this.slotRegistry = null;
    this.userService = null;
    this.authService = null;
    this.testUsers = [];
    this.testSlots = [];
  }

  async initialize() {
    console.log('🧪 Initializing Session Persistence Test Suite...');
    
    // Initialize services
    this.authService = new EnhancedAuthService();
    await this.authService.initialize();
    
    this.userService = new UserManagementService();
    await this.userService.initialize();
    
    this.slotRegistry = new SlotRegistryService({
      maxSlots: 5,
      loadBalancing: {
        strategy: 'least-connections',
        maxSlotsPerUser: 2
      },
      storage: {
        type: 'file',
        dataDirectory: './test-data/slots'
      }
    });
    await this.slotRegistry.initialize();
    
    // Initialize session persistence manager
    this.sessionManager = new SessionPersistenceManager({
      betterAuth: this.authService,
      backupDirectory: './test-data/backups/sessions',
      backupInterval: 10000, // 10 seconds for testing
      maxBackups: 3
    });
    await this.sessionManager.initialize();
    
    // Connect session manager to slot registry events
    this.slotRegistry.on('slotCreated', (slotData) => {
      this.sessionManager.emit('slotCreated', slotData);
    });
    
    this.slotRegistry.on('slotDestroyed', (slotData) => {
      this.sessionManager.emit('slotDestroyed', slotData);
    });
    
    this.slotRegistry.on('slotRestarted', (slotData) => {
      this.sessionManager.emit('slotRestarted', slotData);
    });
    
    console.log('✅ Test suite initialized');
  }

  async runTests() {
    console.log('🚀 Running Session Persistence Tests...');
    
    const tests = [
      this.testSessionCreationAndBackup.bind(this),
      this.testWorkDirectoryPersistence.bind(this),
      this.testClaudeConfigPersistence.bind(this),
      this.testBetterAuthSessionIntegration.bind(this),
      this.testSessionRestoreAfterRestart.bind(this),
      this.testPeriodicBackups.bind(this),
      this.testBackupCleanup.bind(this),
      this.testSessionStatistics.bind(this)
    ];
    
    let passed = 0;
    let failed = 0;
    
    for (const test of tests) {
      try {
        await test();
        passed++;
        console.log(`✅ ${test.name} passed`);
      } catch (error) {
        failed++;
        console.error(`❌ ${test.name} failed:`, error.message);
      }
    }
    
    console.log(`\n🧪 Test Results: ${passed} passed, ${failed} failed`);
    console.log(`📊 Success Rate: ${((passed / tests.length) * 100).toFixed(1)}%`);
    
    return { passed, failed, total: tests.length };
  }

  /**
   * Test session creation and backup
   */
  async testSessionCreationAndBackup() {
    console.log('🧪 Testing session creation and backup...');
    
    // Create test user
    const userResult = await this.userService.registerUser({
      email: 'session-test@example.com',
      username: 'sessiontester',
      password: 'SecurePass123!',
      displayName: 'Session Test User',
      role: 'USER'
    }, 'oauth2');
    
    const userId = userResult.userId;
    this.testUsers.push(userId);
    
    // Allocate slot for user
    const allocation = await this.slotRegistry.allocateSlot(userId, {
      type: 'standard',
      priority: 'normal'
    });
    
    if (!allocation.success) {
      throw new Error('Slot allocation failed');
    }
    
    const slotId = allocation.slot.id;
    this.testSlots.push(slotId);
    
    // Simulate slot creation event
    this.sessionManager.emit('slotCreated', {
      slotId,
      userId,
      sessionId: `session_${Date.now()}`
    });
    
    // Wait a moment for backup to be created
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Verify session is being tracked
    const sessionInfo = this.sessionManager.activeSessions.get(slotId);
    if (!sessionInfo) {
      throw new Error('Session not being tracked');
    }
    
    // Create manual backup
    const backup = await this.sessionManager.createBackup(slotId, {
      type: 'test',
      reason: 'Test backup'
    });
    
    if (!backup.id) {
      throw new Error('Backup creation failed');
    }
    
    // Verify backup was created
    const backups = await this.sessionManager.listBackups(slotId);
    if (backups.length === 0) {
      throw new Error('No backups found');
    }
    
    console.log(`✅ Session creation and backup test passed: ${backups.length} backups created`);
  }

  /**
   * Test work directory persistence
   */
  async testWorkDirectoryPersistence() {
    console.log('🧪 Testing work directory persistence...');
    
    const userId = this.testUsers[0];
    const slotId = this.testSlots[0];
    
    // Create test files in work directory
    const testDir = `/tmp/claudebox-test/${slotId}`;
    await require('fs').promises.mkdir(testDir, { recursive: true });
    
    await require('fs').promises.writeFile(
      `${testDir}/test-file.js`,
      'console.log("Hello from session persistence test!");'
    );
    
    await require('fs').promises.writeFile(
      `${testDir}/package.json`,
      JSON.stringify({ name: 'test-project', version: '1.0.0' }, null, 2)
    );
    
    // Create backup including work directory
    const backup = await this.sessionManager.createBackup(slotId, {
      type: 'work_directory_test'
    });
    
    if (!backup.slotState.workDirectory) {
      throw new Error('Work directory not included in backup');
    }
    
    // Simulate deletion of work directory
    await require('fs').promises.rm(testDir, { recursive: true, force: true });
    
    // Restore session
    const restored = await this.sessionManager.restoreSession(slotId, userId);
    
    if (!restored) {
      throw new Error('Session restoration failed');
    }
    
    console.log(`✅ Work directory persistence test passed: backup ${backup.id} created and restored`);
  }

  /**
   * Test Claude configuration persistence
   */
  async testClaudeConfigPersistence() {
    console.log('🧪 Testing Claude configuration persistence...');
    
    const userId = this.testUsers[0];
    const slotId = this.testSlots[0];
    
    // Create test Claude configuration
    const testConfig = {
      model: 'claude-3-sonnet-20240229',
      temperature: 0.8,
      maxTokens: 2000,
      tools: ['filesystem', 'web', 'neo4j', 'github'],
      preferences: {
        theme: 'dark',
        editor: 'vscode',
        autoSave: true
      }
    };
    
    // Mock exportClaudeConfig to return test config
    const originalExport = this.sessionManager.exportClaudeConfig;
    this.sessionManager.exportClaudeConfig = async () => testConfig;
    
    // Create backup with Claude configuration
    const backup = await this.sessionManager.createBackup(slotId, {
      type: 'claude_config_test'
    });
    
    if (!backup.slotState.claudeConfig) {
      throw new Error('Claude configuration not included in backup');
    }
    
    if (backup.slotState.claudeConfig.temperature !== 0.8) {
      throw new Error('Claude configuration not properly saved');
    }
    
    // Restore original method
    this.sessionManager.exportClaudeConfig = originalExport;
    
    console.log(`✅ Claude configuration persistence test passed: config saved in backup ${backup.id}`);
  }

  /**
   * Test Better Auth session integration
   */
  async testBetterAuthSessionIntegration() {
    console.log('🧪 Testing Better Auth session integration...');
    
    const userId = this.testUsers[0];
    const slotId = this.testSlots[0];
    
    // Simulate Better Auth session creation
    const authSession = {
      sessionId: `auth_session_${Date.now()}`,
      userId: userId,
      provider: 'oauth2',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 3600000).toISOString(), // 1 hour
      tokens: {
        accessToken: 'mock_access_token',
        refreshToken: 'mock_refresh_token'
      }
    };
    
    // Simulate Better Auth event
    this.sessionManager.handleBetterAuthSessionCreated(authSession);
    
    // Wait for session to be updated
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Verify session tracking includes Better Auth info
    const sessionInfo = this.sessionManager.activeSessions.get(slotId);
    if (!sessionInfo.authSession) {
      throw new Error('Better Auth session not tracked');
    }
    
    if (sessionInfo.authSession.sessionId !== authSession.sessionId) {
      throw new Error('Better Auth session ID not properly stored');
    }
    
    // Create backup with Better Auth session
    const backup = await this.sessionManager.createBackup(slotId, {
      type: 'better_auth_test'
    });
    
    if (!backup.authSession) {
      throw new Error('Better Auth session not included in backup');
    }
    
    if (backup.authSession.sessionId !== authSession.sessionId) {
      throw new Error('Better Auth session not properly backed up');
    }
    
    console.log(`✅ Better Auth session integration test passed: session ${authSession.sessionId} backed up`);
  }

  /**
   * Test session restore after restart
   */
  async testSessionRestoreAfterRestart() {
    console.log('🧪 Testing session restore after restart...');
    
    const userId = this.testUsers[0];
    const slotId = this.testSlots[0];
    
    // Create comprehensive backup
    const backup = await this.sessionManager.createBackup(slotId, {
      type: 'restart_test'
    });
    
    // Simulate slot restart
    await this.slotRegistry.deallocateSlot(slotId);
    
    // Simulate slot recreation
    const newAllocation = await this.slotRegistry.allocateSlot(userId, {
      type: 'standard',
      priority: 'normal'
    });
    
    const newSlotId = newAllocation.slot.id;
    
    // Try to restore from backup (using old slot ID)
    const restored = await this.sessionManager.restoreSession(newSlotId, userId);
    
    if (!restored) {
      throw new Error('Session restoration after restart failed');
    }
    
    // Verify session was properly restored
    const newSessionInfo = this.sessionManager.activeSessions.get(newSlotId);
    if (!newSessionInfo) {
      throw new Error('New session not being tracked');
    }
    
    console.log(`✅ Session restore after restart test passed: session restored from backup ${backup.id}`);
  }

  /**
   * Test periodic backups
   */
  async testPeriodicBackups() {
    console.log('🧪 Testing periodic backups...');
    
    const userId = this.testUsers[0];
    const slotId = this.testSlots[0];
    
    const initialBackupCount = this.sessionManager.activeSessions.get(slotId)?.backupCount || 0;
    
    // Wait for periodic backup (should occur within 10 seconds)
    await new Promise(resolve => setTimeout(resolve, 11000));
    
    const sessionInfo = this.sessionManager.activeSessions.get(slotId);
    const currentBackupCount = sessionInfo?.backupCount || 0;
    
    if (currentBackupCount <= initialBackupCount) {
      throw new Error(`Periodic backup not triggered. Expected >${initialBackupCount}, got ${currentBackupCount}`);
    }
    
    const backups = await this.sessionManager.listBackups(slotId);
    const periodicBackups = backups.filter(b => b.type === 'periodic');
    
    if (periodicBackups.length === 0) {
      throw new Error('No periodic backups found');
    }
    
    console.log(`✅ Periodic backups test passed: ${currentBackupCount - initialBackupCount} periodic backups created`);
  }

  /**
   * Test backup cleanup
   */
  async testBackupCleanup() {
    console.log('🧪 Testing backup cleanup...');
    
    const userId = this.testUsers[0];
    const slotId = this.testSlots[0];
    
    // Create multiple backups to exceed limit
    for (let i = 0; i < 5; i++) {
      await this.sessionManager.createBackup(slotId, {
        type: 'cleanup_test',
        reason: `Test backup ${i + 1}`
      });
    }
    
    const backups = await this.sessionManager.listBackups(slotId);
    
    if (backups.length > this.sessionManager.maxBackups) {
      throw new Error(`Backup cleanup not working. Expected ≤${this.sessionManager.maxBackups}, got ${backups.length}`);
    }
    
    console.log(`✅ Backup cleanup test passed: ${backups.length} backups retained (limit: ${this.sessionManager.maxBackups})`);
  }

  /**
   * Test session statistics
   */
  async testSessionStatistics() {
    console.log('🧪 Testing session statistics...');
    
    const stats = this.sessionManager.getStatistics();
    
    if (typeof stats.activeSessions !== 'number') {
      throw new Error('Active sessions count not available');
    }
    
    if (typeof stats.totalBackups !== 'number') {
      throw new Error('Total backups count not available');
    }
    
    if (typeof stats.averageBackupCount !== 'number') {
      throw new Error('Average backup count not available');
    }
    
    if (stats.activeSessions === 0) {
      throw new Error('No active sessions found');
    }
    
    console.log(`📊 Session statistics:`, stats);
    console.log(`✅ Session statistics test passed: ${stats.activeSessions} active sessions, ${stats.totalBackups} total backups`);
  }

  async cleanup() {
    console.log('🧹 Cleaning up test environment...');
    
    // Cleanup test slots
    for (const slotId of this.testSlots) {
      try {
        await this.slotRegistry.deallocateSlot(slotId);
      } catch (error) {
        console.warn('⚠️ Error during slot cleanup:', error.message);
      }
    }
    
    // Shutdown services
    if (this.sessionManager) {
      await this.sessionManager.shutdown();
    }
    
    if (this.slotRegistry) {
      await this.slotRegistry.shutdown();
    }
    
    if (this.userService) {
      await this.userService.shutdown();
    }
    
    if (this.authService) {
      await this.authService.shutdown();
    }
    
    console.log('✅ Test cleanup completed');
  }
}

// Main test runner
async function runSessionPersistenceTests() {
  const test = new SessionPersistenceTest();
  
  try {
    await test.initialize();
    const results = await test.runTests();
    await test.cleanup();
    
    // Print final results
    console.log('\n════════════════════════════════════════════════════════════');
    console.log('🎯 SESSION PERSISTENCE TEST RESULTS');
    console.log('════════════════════════════════════════════════════════════');
    console.log(`📊 Total Tests: ${results.total}`);
    console.log(`✅ Passed: ${results.passed}`);
    console.log(`❌ Failed: ${results.failed}`);
    console.log(`📈 Success Rate: ${((results.passed / results.total) * 100).toFixed(1)}%`);
    
    if (results.failed === 0) {
      console.log('\n🎉 ALL SESSION PERSISTENCE TESTS PASSED! 🎉');
      console.log('🎯 TICKET-008: Session Persistence with Better Auth is working!');
    } else {
      console.log(`\n⚠️  ${results.failed} tests failed. Review implementation.`);
    }
    
    return results;
    
  } catch (error) {
    console.error('💥 Test suite crashed:', error);
    await test.cleanup();
    throw error;
  }
}

// Run tests if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runSessionPersistenceTests()
    .then(results => {
      process.exit(results.failed > 0 ? 1 : 0);
    })
    .catch(error => {
      console.error('💥 Test execution failed:', error);
      process.exit(1);
    });
}

export default SessionPersistenceTest;