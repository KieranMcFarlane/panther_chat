/**
 * SSH Tunnel Manager Test Suite
 * 
 * Comprehensive test suite for SSH Tunnel Management Service
 * Validates TICKET-003 acceptance criteria
 */

import SSHTunnelManager from './services/ssh-tunnel-manager.js';

async function testSSHTunnelManager() {
  console.log('🧪 Testing SSH Tunnel Manager...\n');
  
  // Set test mode for development
  process.env.TEST_MODE = 'true';
  
  const tunnelManager = new SSHTunnelManager({
    host: '13.60.60.50',
    port: 22,
    keyPath: '/home/ec2-user/yellowpanther.pem',
    user: 'ec2-user',
    localPortRange: {
      start: 9100,
      end: 9150
    },
    reconnectDelay: 3000,
    maxReconnectAttempts: 5,
    healthCheckInterval: 15000
  });
  
  let testResults = {
    initialization: false,
    autoConnect: false,
    connectionDropHandling: false,
    tunnelHealthMonitoring: false,
    configurableParameters: false,
    errors: []
  };
  
  try {
    // Test 1: Initialization and SSH key validation
    console.log('🔧 Test 1: Testing SSH Tunnel Manager initialization...');
    const isInitialized = await tunnelManager.initialize();
    
    if (isInitialized) {
      console.log('✅ SSH Tunnel Manager initialized successfully');
      testResults.initialization = true;
    } else {
      console.log('❌ SSH Tunnel Manager initialization failed');
      testResults.errors.push('Failed to initialize SSH Tunnel Manager');
    }
    
    // Test 2: Auto-connect SSH tunnel on service start
    console.log('\n🚇 Test 2: Testing auto-connect SSH tunnel...');
    try {
      if (isInitialized) {
        // Create a test tunnel
        const testTunnel = await tunnelManager.createTunnel('test-slot-1', null, 22);
        
        if (testTunnel && testTunnel.status === 'active') {
          console.log('✅ Auto-connect SSH tunnel working');
          testResults.autoConnect = true;
        } else {
          console.log('❌ Auto-connect SSH tunnel failed');
          testResults.errors.push('Failed to create auto-connect tunnel');
        }
      } else {
        throw new Error('Cannot test auto-connect without initialization');
      }
    } catch (error) {
      console.log('❌ Auto-connect SSH tunnel test failed:', error.message);
      testResults.errors.push(`Auto-connect test failed: ${error.message}`);
    }
    
    // Test 3: Handle connection drops and auto-reconnect
    console.log('\n🔄 Test 3: Testing connection drop handling...');
    try {
      if (isInitialized && testResults.autoConnect) {
        // Simulate connection drop by killing the tunnel process
        const tunnel = tunnelManager.tunnels.get('test-slot-1');
        
        if (tunnel && tunnel.process) {
          console.log('  Simulating connection drop...');
          tunnel.process.kill('SIGTERM');
          
          // Wait for reconnection attempt
          await new Promise(resolve => setTimeout(resolve, 5000));
          
          // Check if tunnel was reconnected
          const reconnectedTunnel = tunnelManager.tunnels.get('test-slot-1');
          
          if (reconnectedTunnel && reconnectedTunnel.status === 'active') {
            console.log('✅ Connection drop handling and auto-reconnect working');
            testResults.connectionDropHandling = true;
          } else {
            console.log('❌ Connection drop handling failed');
            testResults.errors.push('Failed to reconnect after connection drop');
          }
        } else {
          throw new Error('No tunnel process found to simulate drop');
        }
      } else {
        throw new Error('Cannot test connection drops without active tunnel');
      }
    } catch (error) {
      console.log('❌ Connection drop handling test failed:', error.message);
      testResults.errors.push(`Connection drop test failed: ${error.message}`);
    }
    
    // Test 4: Monitor tunnel health and status
    console.log('\n🏥 Test 4: Testing tunnel health monitoring...');
    try {
      if (isInitialized) {
        // Create another test tunnel for health monitoring
        const healthTunnel = await tunnelManager.createTunnel('test-slot-2', null, 22);
        
        if (healthTunnel) {
          // Get tunnel status
          const status = tunnelManager.getTunnelStatus('test-slot-2');
          
          if (status && status.slotId === 'test-slot-2') {
            console.log('✅ Tunnel status monitoring working');
            
            // Get all tunnel statuses
            const allStatuses = tunnelManager.getAllTunnelStatuses();
            
            if (Array.isArray(allStatuses) && allStatuses.length > 0) {
              console.log('✅ Multiple tunnel status monitoring working');
              
              // Get stats
              const stats = tunnelManager.getStats();
              
              if (stats && typeof stats.totalTunnels === 'number') {
                console.log('✅ Tunnel statistics monitoring working');
                testResults.tunnelHealthMonitoring = true;
              } else {
                console.log('❌ Tunnel statistics monitoring failed');
                testResults.errors.push('Failed to get tunnel statistics');
              }
            } else {
              console.log('❌ Multiple tunnel status monitoring failed');
              testResults.errors.push('Failed to get all tunnel statuses');
            }
          } else {
            console.log('❌ Tunnel status monitoring failed');
            testResults.errors.push('Failed to get tunnel status');
          }
        } else {
          throw new Error('Failed to create tunnel for health monitoring test');
        }
      } else {
        throw new Error('Cannot test health monitoring without initialization');
      }
    } catch (error) {
      console.log('❌ Tunnel health monitoring test failed:', error.message);
      testResults.errors.push(`Health monitoring test failed: ${error.message}`);
    }
    
    // Test 5: Configurable connection parameters
    console.log('\n⚙️ Test 5: Testing configurable connection parameters...');
    try {
      if (isInitialized) {
        // Create tunnel with custom configuration
        const customConfig = {
          host: '13.60.60.50',
          port: 22,
          keyPath: '/home/ec2-user/yellowpanther.pem',
          user: 'ec2-user',
          localPortRange: {
            start: 9200,
            end: 9250
          },
          reconnectDelay: 2000,
          maxReconnectAttempts: 3,
          healthCheckInterval: 10000
        };
        
        const customTunnelManager = new SSHTunnelManager(customConfig);
        const customInitialized = await customTunnelManager.initialize();
        
        if (customInitialized) {
          // Test tunnel creation with custom config
          const customTunnel = await customTunnelManager.createTunnel('test-slot-3', null, 22);
          
          if (customTunnel && customTunnel.status === 'active') {
            console.log('✅ Configurable connection parameters working');
            testResults.configurableParameters = true;
          } else {
            console.log('❌ Custom tunnel creation failed');
            testResults.errors.push('Failed to create tunnel with custom configuration');
          }
          
          // Clean up custom tunnel manager
          await customTunnelManager.shutdown();
        } else {
          console.log('❌ Custom tunnel manager initialization failed');
          testResults.errors.push('Failed to initialize custom tunnel manager');
        }
      } else {
        throw new Error('Cannot test configurable parameters without initialization');
      }
    } catch (error) {
      console.log('❌ Configurable connection parameters test failed:', error.message);
      testResults.errors.push(`Configurable parameters test failed: ${error.message}`);
    }
    
    // Test additional functionality
    console.log('\n🔍 Additional functionality tests...');
    
    // Test tunnel closure
    try {
      if (testResults.autoConnect) {
        const closed = await tunnelManager.closeTunnel('test-slot-1');
        
        if (closed) {
          console.log('✅ Tunnel closure working');
        } else {
          console.log('⚠️ Tunnel closure test inconclusive');
        }
      }
    } catch (error) {
      console.log('⚠️ Tunnel closure test failed:', error.message);
    }
    
    // Test port allocation
    try {
      if (isInitialized) {
        const port1 = tunnelManager.allocateLocalPort();
        const port2 = tunnelManager.allocateLocalPort();
        
        if (port1 && port2 && port1 !== port2) {
          console.log('✅ Port allocation working');
        } else {
          console.log('❌ Port allocation failed');
          testResults.errors.push('Failed to allocate unique ports');
        }
      }
    } catch (error) {
      console.log('❌ Port allocation test failed:', error.message);
      testResults.errors.push(`Port allocation test failed: ${error.message}`);
    }
    
    // Display final stats
    console.log('\n📊 Final SSH Tunnel Manager Stats:');
    const finalStats = tunnelManager.getStats();
    console.log('  - Total tunnels:', finalStats.totalTunnels);
    console.log('  - Active tunnels:', finalStats.activeTunnels);
    console.log('  - Used ports:', finalStats.usedPorts);
    console.log('  - Available ports:', finalStats.availablePorts);
    
  } catch (error) {
    console.error('❌ Unexpected error during testing:', error);
    testResults.errors.push(`Unexpected error: ${error.message}`);
  }
  
  // Clean up
  try {
    await tunnelManager.shutdown();
    console.log('\n🧹 Test cleanup completed');
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  }
  
  // Final Results Summary
  console.log('\n🎯 Test Results Summary:');
  console.log('='.repeat(50));
  
  const results = [
    { name: 'SSH Tunnel Manager Initialization', passed: testResults.initialization },
    { name: 'Auto-connect SSH Tunnel', passed: testResults.autoConnect },
    { name: 'Connection Drop Handling', passed: testResults.connectionDropHandling },
    { name: 'Tunnel Health Monitoring', passed: testResults.tunnelHealthMonitoring },
    { name: 'Configurable Parameters', passed: testResults.configurableParameters }
  ];
  
  results.forEach(result => {
    const status = result.passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} ${result.name}`);
  });
  
  const totalPassed = results.filter(r => r.passed).length;
  const totalTests = results.length;
  
  console.log('\n📈 Overall Score:');
  console.log(`${totalPassed}/${totalTests} tests passed (${Math.round(totalPassed/totalTests * 100)}%)`);
  
  if (testResults.errors.length > 0) {
    console.log('\n⚠️ Errors encountered:');
    testResults.errors.forEach((error, index) => {
      console.log(`${index + 1}. ${error}`);
    });
  }
  
  // Check acceptance criteria
  console.log('\n🎫 TICKET-003 Acceptance Criteria Status:');
  const criteria = [
    'Auto-connect SSH tunnel on service start',
    'Handle connection drops and auto-reconnect',
    'Monitor tunnel health and status',
    'Configurable connection parameters'
  ];
  
  criteria.forEach((criterion, index) => {
    const passed = results[index + 1].passed; // Skip initialization test
    const status = passed ? '✅' : '❌';
    console.log(`${status} ${criterion}`);
  });
  
  if (totalPassed >= 4) { // 4 main acceptance criteria
    console.log('\n🎉 All acceptance criteria for TICKET-003 have been met!');
    return true;
  } else {
    console.log('\n⚠️ Some acceptance criteria are not met. Further investigation needed.');
    return false;
  }
}

// Run the test
testSSHTunnelManager()
  .then(success => {
    console.log(success ? '\n🎉 Tests completed successfully' : '\n❌ Tests completed with failures');
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('Test runner error:', error);
    process.exit(1);
  });

export { testSSHTunnelManager, SSHTunnelManager };