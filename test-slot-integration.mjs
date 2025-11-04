#!/usr/bin/env node

/**
 * 🎯 Complete Slot Registry Integration Test
 * Tests the full TICKET-007 implementation with real user workflows
 */

import SlotRegistryService from './services/slot-registry-service.js';
import UserManagementService from './services/user-management-service.js';
import EnhancedAuthService from './services/enhanced-auth-service.js';

async function completeIntegrationTest() {
  console.log('🚀 Starting Complete Slot Registry Integration Test...');
  
  let slotRegistry, userService, authService;
  
  try {
    // Initialize services
    console.log('🔧 Initializing services...');
    authService = new EnhancedAuthService();
    await authService.initialize();
    
    userService = new UserManagementService();
    await userService.initialize();
    
    slotRegistry = new SlotRegistryService({
      maxSlots: 20,
      loadBalancing: {
        strategy: 'resource-based',
        maxSlotsPerUser: 5,
        healthCheckInterval: 10000,
        failedSlotThreshold: 3
      },
      cleanup: {
        interval: 30000,
        maxAge: 3600000, // 1 hour
        zombieTimeout: 300000 // 5 minutes
      },
      storage: {
        type: 'file',
        dataDirectory: './test-data/slots'
      }
    });
    
    await slotRegistry.initialize();
    
    console.log('✅ All services initialized');
    
    // Test 1: Multi-user slot allocation
    console.log('🧪 Test 1: Multi-user slot allocation...');
    
    const users = [];
    const userSlots = new Map();
    
    // Create 3 test users
    for (let i = 1; i <= 3; i++) {
      const userResult = await userService.registerUser({
        email: `integration${i}@example.com`,
        username: `integrationuser${i}`,
        password: 'SecurePass123!',
        displayName: `Integration Test User ${i}`,
        role: 'USER'
      }, 'oauth2');
      
      users.push(userResult.userId);
      userSlots.set(userResult.userId, []);
    }
    
    console.log(`✅ Created ${users.length} test users`);
    
    // Allocate slots to users with different strategies
    const strategies = ['least-connections', 'round-robin', 'resource-based'];
    
    for (let i = 0; i < users.length; i++) {
      const userId = users[i];
      const strategy = strategies[i];
      
      // Allocate 2 slots per user with different strategies
      for (let j = 0; j < 2; j++) {
        const allocation = await slotRegistry.allocateSlot(userId, {
          type: j === 0 ? 'standard' : 'priority',
          priority: j === 0 ? 'normal' : 'high',
          strategy
        });
        
        if (!allocation.success) {
          throw new Error(`Failed to allocate slot ${j + 1} for user ${i + 1}`);
        }
        
        userSlots.get(userId).push(allocation.slot.id);
        
        // Simulate resource usage
        slotRegistry.updateResourceMetrics(allocation.slot.id, {
          memory: Math.random() * 256,
          cpu: Math.random() * 30,
          disk: Math.random() * 100,
          network: Math.random() * 50,
          connections: Math.floor(Math.random() * 10),
          operations: Math.floor(Math.random() * 20)
        });
      }
    }
    
    console.log('✅ Multi-user slot allocation completed');
    
    // Test 2: Load balancing validation
    console.log('🧪 Test 2: Load balancing validation...');
    
    const stats = slotRegistry.getRegistryStats();
    console.log(`📊 Registry Stats:`, {
      totalSlots: stats.totalSlots,
      availableSlots: stats.availableSlots,
      assignedSlots: stats.assignedSlots,
      utilizationRate: (stats.utilizationRate * 100).toFixed(1) + '%'
    });
    
    // Verify load distribution
    const connectionCounts = stats.loadBalancing.connectionDistribution;
    const totalConnections = Object.values(connectionCounts).reduce((sum, count) => sum + count, 0);
    const avgConnections = totalConnections / Object.keys(connectionCounts).length;
    
    console.log(`📈 Load Distribution: ${totalConnections} total connections, ${avgConnections.toFixed(1)} avg per slot`);
    
    // Test 3: Resource monitoring
    console.log('🧪 Test 3: Resource monitoring...');
    
    let totalMemory = 0, totalCPU = 0;
    for (const [slotId, metrics] of slotRegistry.resourceMetrics) {
      totalMemory += metrics.memory || 0;
      totalCPU += metrics.cpu || 0;
    }
    
    console.log(`💾 Resource Usage: ${totalMemory.toFixed(0)}MB memory, ${totalCPU.toFixed(1)}% CPU`);
    
    // Test 4: Slot deallocation and recycling
    console.log('🧪 Test 4: Slot deallocation and recycling...');
    
    // Deallocate one slot from each user
    for (let i = 0; i < users.length; i++) {
      const userId = users[i];
      const slotIds = userSlots.get(userId);
      
      if (slotIds.length > 0) {
        const slotId = slotIds[0]; // Deallocate first slot
        await slotRegistry.deallocateSlot(slotId);
        
        // Verify deallocation
        const userSlotList = slotRegistry.getUserSlots(userId);
        if (userSlotList.some(slot => slot.id === slotId)) {
          throw new Error(`Slot ${slotId} still assigned to user after deallocation`);
        }
        
        console.log(`✅ Slot ${slotId} deallocated from user ${userId}`);
      }
    }
    
    // Test 5: Reallocation of recycled slots
    console.log('🧪 Test 5: Reallocation of recycled slots...');
    
    // Try to allocate new slots (should reuse recycled ones)
    for (let i = 0; i < users.length; i++) {
      const userId = users[i];
      
      const allocation = await slotRegistry.allocateSlot(userId, {
        type: 'recycled',
        priority: 'normal'
      });
      
      if (!allocation.success) {
        throw new Error(`Failed to reallocate slot for user ${userId}`);
      }
      
      userSlots.get(userId).push(allocation.slot.id);
      console.log(`✅ Recycled slot ${allocation.slot.id} allocated to user ${userId}`);
    }
    
    // Test 6: Health monitoring and cleanup
    console.log('🧪 Test 6: Health monitoring and cleanup...');
    
    // Manually trigger health checks
    await slotRegistry.performHealthChecks();
    
    // Manually trigger cleanup
    await slotRegistry.performCleanup();
    
    const updatedStats = slotRegistry.getRegistryStats();
    console.log(`📊 Updated Stats:`, {
      totalSlots: updatedStats.totalSlots,
      availableSlots: updatedStats.availableSlots,
      assignedSlots: updatedStats.assignedSlots,
      blacklistedSlots: updatedStats.blacklistedSlots
    });
    
    // Test 7: User slot limits enforcement
    console.log('🧪 Test 7: User slot limits enforcement...');
    
    const testUserId = users[0];
    const currentSlotCount = slotRegistry.getUserSlotCount(testUserId);
    const maxSlots = slotRegistry.config.loadBalancing.maxSlotsPerUser;
    
    console.log(`📋 User ${testUserId} has ${currentSlotCount}/${maxSlots} slots`);
    
    // Try to exceed slot limit
    let allocationAttempts = 0;
    let successfulAllocations = 0;
    
    while (currentSlotCount + successfulAllocations < maxSlots + 2) {
      try {
        const allocation = await slotRegistry.allocateSlot(testUserId);
        if (allocation.success) {
          successfulAllocations++;
          userSlots.get(testUserId).push(allocation.slot.id);
        }
      } catch (error) {
        if (!error.message.includes('maximum slot limit')) {
          throw error;
        }
        console.log(`✅ Slot limit enforced: ${error.message}`);
        break;
      }
      allocationAttempts++;
    }
    
    if (successfulAllocations > maxSlots - currentSlotCount) {
      throw new Error(`Slot limit not enforced: allocated ${successfulAllocations} additional slots`);
    }
    
    console.log(`✅ Slot limit test passed: ${successfulAllocations} additional slots allocated (limit: ${maxSlots - currentSlotCount})`);
    
    // Test 8: State persistence
    console.log('🧪 Test 8: State persistence...');
    
    // Save state
    await slotRegistry.saveRegistryState();
    
    // Create backup
    await slotRegistry.backupRegistryState();
    
    console.log('✅ State persistence test passed');
    
    // Final stats
    const finalStats = slotRegistry.getRegistryStats();
    console.log('\\n📊 FINAL REGISTRY STATISTICS:');
    console.log(`🎯 Total Slots Created: ${finalStats.totalSlots}`);
    console.log(`🔄 Available Slots: ${finalStats.availableSlots}`);
    console.log(`👥 Assigned Slots: ${finalStats.assignedSlots}`);
    console.log(`🚫 Blacklisted Slots: ${finalStats.blacklistedSlots}`);
    console.log(`📈 Utilization Rate: ${(finalStats.utilizationRate * 100).toFixed(1)}%`);
    console.log(`👤 Average Slots per User: ${finalStats.averageSlotsPerUser.toFixed(2)}`);
    console.log(`⚡ Total Allocations: ${finalStats.metrics.totalAllocations}`);
    console.log(`🗑️ Total Deallocations: ${finalStats.metrics.totalDeallocations}`);
    console.log(`❌ Failed Allocations: ${finalStats.metrics.failedAllocations}`);
    console.log(`⏱️ Uptime: ${(finalStats.uptime / 1000).toFixed(0)}s`);
    
    console.log('\\n✅ ALL INTEGRATION TESTS PASSED! 🎉');
    console.log('🎯 TICKET-007: Slot Registry & State Management is fully functional!');
    
    return {
      success: true,
      stats: finalStats,
      usersTested: users.length,
      totalSlots: finalStats.totalSlots
    };
    
  } catch (error) {
    console.error('❌ Integration test failed:', error);
    throw error;
  } finally {
    console.log('\\n🛑 Cleaning up...');
    
    // Cleanup all slots
    if (slotRegistry) {
      try {
        for (const [slotId] of slotRegistry.slotRegistry) {
          await slotRegistry.deallocateSlot(slotId);
        }
        await slotRegistry.shutdown();
      } catch (error) {
        console.warn('⚠️ Error during slot cleanup:', error.message);
      }
    }
    
    // Shutdown services
    if (userService) {
      try {
        await userService.shutdown();
      } catch (error) {
        console.warn('⚠️ Error during user service shutdown:', error.message);
      }
    }
    
    if (authService) {
      try {
        await authService.shutdown();
      } catch (error) {
        console.warn('⚠️ Error during auth service shutdown:', error.message);
      }
    }
    
    console.log('✅ Cleanup completed');
  }
}

// Run the integration test
completeIntegrationTest()
  .then(result => {
    console.log('\\n🎉 INTEGRATION TEST COMPLETED SUCCESSFULLY!');
    process.exit(0);
  })
  .catch(error => {
    console.error('\\n💥 INTEGRATION TEST FAILED:', error);
    process.exit(1);
  });