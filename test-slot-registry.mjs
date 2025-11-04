#!/usr/bin/env node

/**
 * 🧪 Slot Registry & State Management Test Suite
 * 
 * Tests TICKET-007: Slot Registry & State Management implementation
 * 
 * Coverage:
 * - Automatic slot assignment for users
 * - Load balancing across available slots  
 * - Resource usage monitoring
 * - Slot cleanup and recycling
 * - State persistence and recovery
 */

import SlotRegistryService from './services/slot-registry-service.js';
import UserManagementService from './services/user-management-service.js';
import EnhancedAuthService from './services/enhanced-auth-service.js';

class SlotRegistryTest {
  constructor() {
    this.slotRegistry = null;
    this.userService = null;
    this.authService = null;
    this.testUsers = [];
    this.testSlots = [];
  }
  
  async initialize() {
    console.log('🧪 Initializing Slot Registry Test Suite...');
    
    // Initialize services
    this.authService = new EnhancedAuthService();
    await this.authService.initialize();
    
    this.userService = new UserManagementService();
    await this.userService.initialize();
    
    this.slotRegistry = new SlotRegistryService({
      maxSlots: 10,
      loadBalancing: {
        strategy: 'least-connections',
        maxSlotsPerUser: 3,
        healthCheckInterval: 5000,
        failedSlotThreshold: 2
      },
      cleanup: {
        interval: 10000,
        maxAge: 300000, // 5 minutes for testing
        zombieTimeout: 60000 // 1 minute for testing
      },
      storage: {
        type: 'file',
        dataDirectory: './test-data/slots'
      }
    });
    
    await this.slotRegistry.initialize();
    
    console.log('✅ Test suite initialized');
  }
  
  async runTests() {
    console.log('🚀 Running Slot Registry Tests...');
    
    const tests = [
      this.testSlotAllocation.bind(this),
      this.testLoadBalancing.bind(this),
      this.testResourceMonitoring.bind(this),
      this.testSlotCleanup.bind(this),
      this.testStatePersistence.bind(this),
      this.testUserSlotLimits.bind(this),
      this.testSlotRecycling.bind(this),
      this.testHealthMonitoring.bind(this)
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
    
    console.log(`\\n🧪 Test Results: ${passed} passed, ${failed} failed`);
    console.log(`📊 Success Rate: ${((passed / tests.length) * 100).toFixed(1)}%`);
    
    return { passed, failed, total: tests.length };
  }
  
  /**
   * Test automatic slot assignment for users
   */
  async testSlotAllocation() {
    console.log('🧪 Testing automatic slot assignment...');
    
    // Create test user
    const userResult = await this.userService.registerUser({
      email: 'slot-test@example.com',
      username: 'slottester',
      password: 'SecurePass123!',
      displayName: 'Slot Test User',
      role: 'USER'
    }, 'oauth2');
    
    const userId = userResult.userId;
    this.testUsers.push(userId);
    
    // Test slot allocation
    const allocation1 = await this.slotRegistry.allocateSlot(userId, {
      type: 'standard',
      priority: 'normal'
    });
    
    if (!allocation1.success) {
      throw new Error('Slot allocation failed');
    }
    
    this.testSlots.push(allocation1.slot.id);
    
    // Verify slot is assigned to user
    const userSlots = this.slotRegistry.getUserSlots(userId);
    if (userSlots.length !== 1) {
      throw new Error(`Expected 1 slot, got ${userSlots.length}`);
    }
    
    // Verify slot is in assigned pool
    if (!this.slotRegistry.assignedSlots.has(allocation1.slot.id)) {
      throw new Error('Slot not found in assigned pool');
    }
    
    // Allocate second slot
    const allocation2 = await this.slotRegistry.allocateSlot(userId, {
      type: 'priority',
      priority: 'high'
    });
    
    if (!allocation2.success) {
      throw new Error('Second slot allocation failed');
    }
    
    this.testSlots.push(allocation2.slot.id);
    
    // Verify user has 2 slots
    const updatedUserSlots = this.slotRegistry.getUserSlots(userId);
    if (updatedUserSlots.length !== 2) {
      throw new Error(`Expected 2 slots, got ${updatedUserSlots.length}`);
    }
    
    console.log(`✅ Slot allocation test passed: 2 slots allocated to user ${userId}`);
  }
  
  /**
   * Test load balancing strategies
   */
  async testLoadBalancing() {
    console.log('🧪 Testing load balancing strategies...');
    
    const strategies = ['least-connections', 'round-robin', 'resource-based'];
    const userId = this.testUsers[0];
    
    for (const strategy of strategies) {
      // Change load balancing strategy
      this.slotRegistry.loadBalancer.currentStrategy = strategy;
      
      // Create some available slots manually for testing
      for (let i = 0; i < 3; i++) {
        const slot = await this.slotRegistry.createSlot(userId, { type: 'test' });
        this.testSlots.push(slot.id);
      }
      
      // Test allocation with different strategies
      const allocation = await this.slotRegistry.allocateSlot(userId, {
        strategy
      });
      
      if (!allocation.success) {
        throw new Error(`Allocation failed with strategy ${strategy}`);
      }
      
      console.log(`✅ ${strategy} strategy: slot ${allocation.slot.id} allocated`);
    }
    
    console.log('✅ Load balancing test passed');
  }
  
  /**
   * Test resource usage monitoring
   */
  async testResourceMonitoring() {
    console.log('🧪 Testing resource usage monitoring...');
    
    const userId = this.testUsers[0];
    const slotId = this.testSlots[0];
    
    // Simulate resource usage
    const resourceMetrics = {
      memory: 256,
      cpu: 25,
      disk: 100,
      network: 50,
      connections: 5,
      operations: 10
    };
    
    // Update resource metrics
    this.slotRegistry.updateResourceMetrics(slotId, resourceMetrics);
    
    // Get resource usage
    const usage = this.slotRegistry.getResourceUsage(slotId);
    
    if (usage.memory !== resourceMetrics.memory) {
      throw new Error('Memory usage not updated correctly');
    }
    
    if (usage.cpu !== resourceMetrics.cpu) {
      throw new Error('CPU usage not updated correctly');
    }
    
    // Test slot score calculation
    const score = this.slotRegistry.calculateSlotScore(slotId);
    if (typeof score !== 'number' || score < 0 || score > 1) {
      throw new Error(`Invalid slot score: ${score}`);
    }
    
    // Get registry stats
    const stats = this.slotRegistry.getRegistryStats();
    if (stats.totalSlots === 0) {
      throw new Error('Registry stats show no slots');
    }
    
    console.log(`✅ Resource monitoring test passed: ${stats.totalSlots} slots tracked`);
  }
  
  /**
   * Test slot cleanup and recycling
   */
  async testSlotCleanup() {
    console.log('🧪 Testing slot cleanup and recycling...');
    
    const userId = this.testUsers[0];
    const slotId = this.testSlots[0];
    
    // Deallocate a slot
    const deallocation = await this.slotRegistry.deallocateSlot(slotId);
    if (!deallocation.success) {
      throw new Error('Slot deallocation failed');
    }
    
    // Verify slot is no longer assigned to user
    const userSlots = this.slotRegistry.getUserSlots(userId);
    if (userSlots.some(slot => slot.id === slotId)) {
      throw new Error('Deallocated slot still assigned to user');
    }
    
    // Verify slot is not in assigned pool
    if (this.slotRegistry.assignedSlots.has(slotId)) {
      throw new Error('Deallocated slot still in assigned pool');
    }
    
    // Manual cleanup test
    await this.slotRegistry.performCleanup();
    
    console.log('✅ Slot cleanup test passed');
  }
  
  /**
   * Test state persistence and recovery
   */
  async testStatePersistence() {
    console.log('🧪 Testing state persistence and recovery...');
    
    // Save current state
    await this.slotRegistry.saveRegistryState();
    
    // Create backup
    await this.slotRegistry.backupRegistryState();
    
    // Shutdown and restart service
    await this.slotRegistry.shutdown();
    
    const newRegistry = new SlotRegistryService({
      maxSlots: 10,
      storage: {
        type: 'file',
        dataDirectory: './test-data/slots'
      }
    });
    
    await newRegistry.initialize();
    
    // Verify state was restored
    const stats = newRegistry.getRegistryStats();
    if (stats.totalSlots === 0) {
      throw new Error('State not restored - no slots found');
    }
    
    console.log(`✅ State persistence test passed: ${stats.totalSlots} slots restored`);
    
    // Update the reference
    this.slotRegistry = newRegistry;
  }
  
  /**
   * Test user slot limits
   */
  async testUserSlotLimits() {
    console.log('🧪 Testing user slot limits...');
    
    // Create new user for limit testing
    const userResult = await this.userService.registerUser({
      email: 'limit-test@example.com',
      username: 'limittester',
      password: 'SecurePass123!',
      displayName: 'Limit Test User',
      role: 'USER'
    }, 'oauth2');
    
    const userId = userResult.userId;
    this.testUsers.push(userId);
    
    // Try to allocate more slots than allowed (max 3)
    const maxSlots = 3;
    let allocatedSlots = [];
    
    for (let i = 0; i < maxSlots + 1; i++) {
      try {
        const allocation = await this.slotRegistry.allocateSlot(userId);
        if (allocation.success) {
          allocatedSlots.push(allocation.slot.id);
          this.testSlots.push(allocation.slot.id);
        }
      } catch (error) {
        if (i < maxSlots) {
          throw new Error(`Unexpected allocation failure at slot ${i + 1}`);
        }
        // Expected failure for slot 4
        if (!error.message.includes('maximum slot limit')) {
          throw error;
        }
      }
    }
    
    // Verify only 3 slots were allocated
    if (allocatedSlots.length !== maxSlots) {
      throw new Error(`Expected ${maxSlots} slots, got ${allocatedSlots.length}`);
    }
    
    console.log(`✅ User slot limits test passed: ${allocatedSlots.length}/${maxSlots + 1} slots allocated`);
  }
  
  /**
   * Test slot recycling
   */
  async testSlotRecycling() {
    console.log('🧪 Testing slot recycling...');
    
    const userId = this.testUsers[0];
    
    // Get a slot that can be recycled
    const allocation = await this.slotRegistry.allocateSlot(userId, {
      type: 'recyclable'
    });
    
    if (!allocation.success) {
      throw new Error('Slot allocation for recycling test failed');
    }
    
    const slotId = allocation.slot.id;
    this.testSlots.push(slotId);
    
    // Deallocate the slot (should be recycled, not destroyed)
    await this.slotRegistry.deallocateSlot(slotId);
    
    // Verify slot is now available
    if (!this.slotRegistry.availableSlots.has(slotId)) {
      throw new Error('Recycled slot not found in available pool');
    }
    
    // Verify slot still exists in registry
    if (!this.slotRegistry.slotRegistry.has(slotId)) {
      throw new Error('Recycled slot removed from registry');
    }
    
    // Allocate the recycled slot to another user
    const newUserId = this.testUsers[1] || this.testUsers[0];
    const recycledAllocation = await this.slotRegistry.allocateSlot(newUserId);
    
    if (!recycledAllocation.success) {
      throw new Error('Recycled slot reallocation failed');
    }
    
    console.log(`✅ Slot recycling test passed: slot ${slotId} recycled and reused`);
  }
  
  /**
   * Test health monitoring
   */
  async testHealthMonitoring() {
    console.log('🧪 Testing health monitoring...');
    
    // Manually trigger health checks
    await this.slotRegistry.performHealthChecks();
    
    // Get health status
    const stats = this.slotRegistry.getRegistryStats();
    
    // Verify health status is tracked
    const healthDist = stats.loadBalancing.healthDistribution;
    let healthyCount = 0;
    
    for (const [slotId, status] of Object.entries(healthDist)) {
      if (status === 'healthy') {
        healthyCount++;
      }
    }
    
    if (healthyCount === 0 && stats.totalSlots > 0) {
      throw new Error('No healthy slots found');
    }
    
    // Test zombie slot cleanup
    await this.slotRegistry.performCleanup();
    
    console.log(`✅ Health monitoring test passed: ${healthyCount} healthy slots`);
  }
  
  async cleanup() {
    console.log('🧹 Cleaning up test environment...');
    
    // Deallocate all test slots
    for (const slotId of this.testSlots) {
      try {
        await this.slotRegistry.deallocateSlot(slotId);
      } catch (error) {
        // Ignore cleanup errors
      }
    }
    
    // Shutdown services
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
async function runSlotRegistryTests() {
  const test = new SlotRegistryTest();
  
  try {
    await test.initialize();
    const results = await test.runTests();
    await test.cleanup();
    
    // Print final results
    console.log('\\n════════════════════════════════════════════════════════════');
    console.log('🎯 SLOT REGISTRY TEST RESULTS');
    console.log('════════════════════════════════════════════════════════════');
    console.log(`📊 Total Tests: ${results.total}`);
    console.log(`✅ Passed: ${results.passed}`);
    console.log(`❌ Failed: ${results.failed}`);
    console.log(`📈 Success Rate: ${((results.passed / results.total) * 100).toFixed(1)}%`);
    
    if (results.failed === 0) {
      console.log('\\n🎉 ALL TESTS PASSED! TICKET-007 IMPLEMENTATION IS WORKING! 🎉');
    } else {
      console.log(`\\n⚠️  ${results.failed} tests failed. Review implementation.`);
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
  runSlotRegistryTests()
    .then(results => {
      process.exit(results.failed > 0 ? 1 : 0);
    })
    .catch(error => {
      console.error('💥 Test execution failed:', error);
      process.exit(1);
    });
}

export default SlotRegistryTest;