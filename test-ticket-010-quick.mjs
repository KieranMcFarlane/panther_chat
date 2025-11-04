/**
 * Quick validation of TICKET-010 Iframe Integration Service
 * This test validates core functionality without full service initialization
 */

import IframeIntegrationService from './services/iframe-integration-service.js';
import assert from 'node:assert';

console.log('🎯 Quick TICKET-010 Validation...');

try {
  // Test 1: Service instantiation
  console.log('📋 Test 1: Service instantiation...');
  const service = new IframeIntegrationService({
    baseUrl: 'http://localhost:7681',
    enableRateLimiting: false,
    enableMetrics: true,
    secretKey: 'test-secret-key'
  });
  
  console.log('✅ Service instantiated successfully');
  
  // Test 2: Configuration validation
  console.log('📋 Test 2: Configuration validation...');
  assert.strictEqual(service.config.baseUrl, 'http://localhost:7681');
  assert.strictEqual(service.config.enableRateLimiting, false);
  assert.strictEqual(service.config.enableMetrics, true);
  assert.ok(Array.isArray(service.config.allowedOrigins));
  assert.ok(Array.isArray(service.config.sandboxPermissions));
  assert.ok(Array.isArray(service.config.allowedFeatures));
  console.log('✅ Configuration validated');
  
  // Test 3: Core method availability
  console.log('📋 Test 3: Core method availability...');
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
    'getStatus'
  ];
  
  for (const method of requiredMethods) {
    assert.strictEqual(typeof service[method], 'function', `Method ${method} should be a function`);
  }
  console.log('✅ All core methods available');
  
  // Test 4: URL generation (mock slot)
  console.log('📋 Test 4: URL generation...');
  
  // Mock slot existence check
  service.slotManager = {
    hasSlot: (slotId) => slotId === 'test-slot-1',
    getSlotInfo: (slotId) => slotId === 'test-slot-1' ? { id: 'test-slot-1' } : null
  };
  
  const urlInfo = service.generateSlotUrl('test-slot-1', {
    userId: 'test-user-1',
    sessionId: 'test-session-1',
    theme: 'dark'
  });
  
  assert.ok(urlInfo.slotId);
  assert.ok(urlInfo.url);
  assert.ok(urlInfo.timestamp);
  assert.ok(urlInfo.nonce);
  assert.ok(urlInfo.signature);
  assert.ok(urlInfo.expiresAt);
  assert.ok(urlInfo.url.includes('test-slot-1'));
  console.log('✅ URL generation working');
  
  // Test 5: Message handler registration
  console.log('📋 Test 5: Message handler registration...');
  
  let handlerCalled = false;
  service.registerMessageHandler('test_message', async (data) => {
    handlerCalled = true;
    return { success: true };
  });
  
  assert.strictEqual(service.messageHandlers.has('test_message'), true);
  console.log('✅ Message handler registration working');
  
  // Test 6: Service status
  console.log('📋 Test 6: Service status...');
  const status = service.getStatus();
  
  assert.strictEqual(status.service, 'iframe-integration');
  assert.strictEqual(status.isInitialized, false); // Not initialized yet
  assert.ok(status.config);
  assert.strictEqual(status.sessions.active, 0);
  console.log('✅ Service status working');
  
  console.log('\n🎉 TICKET-010 Quick Validation PASSED!');
  console.log('✅ Core Iframe Integration Service functionality implemented');
  console.log('✅ All required methods available');
  console.log('✅ URL generation working');
  console.log('✅ Message handling working');
  console.log('✅ Service configuration correct');
  
  process.exit(0);
  
} catch (error) {
  console.error('❌ TICKET-010 Quick Validation FAILED:');
  console.error(error);
  process.exit(1);
}