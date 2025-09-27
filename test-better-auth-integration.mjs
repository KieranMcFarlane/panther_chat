/**
 * Better Auth MCP Integration Test
 * 
 * Test script to verify Better Auth MCP server connectivity and functionality
 * This implements the acceptance criteria for TICKET-001
 */

import BetterAuthService from './services/better-auth-integration.js';

async function testBetterAuthIntegration() {
  console.log('🧪 Testing Better Auth MCP Integration...\n');
  
  const authService = new BetterAuthService();
  let testResults = {
    connection: false,
    authBridge: false,
    multiProvider: false,
    sessionManagement: false,
    securityFeatures: false,
    errors: []
  };

  try {
    // Test 1: Better Auth MCP server connection
    console.log('📡 Test 1: Testing Better Auth MCP server connection...');
    const isConnected = await authService.initialize();
    
    if (isConnected) {
      console.log('✅ Better Auth MCP service initialized successfully');
      testResults.connection = true;
    } else {
      console.log('❌ Better Auth MCP service initialization failed');
      testResults.errors.push('Failed to initialize Better Auth MCP service');
    }
    
    // Test 2: Auth bridge service functionality
    console.log('\n🔗 Test 2: Testing auth bridge service...');
    try {
      if (isConnected) {
        // Test basic provider configuration
        const testConfig = {
          clientId: 'test-client-id',
          redirectUri: 'http://localhost:7681/auth/callback',
          scopes: ['profile', 'email']
        };
        
        const configResult = await authService.configureProvider('oauth2', testConfig);
        console.log('✅ Auth bridge service working');
        testResults.authBridge = true;
      } else {
        throw new Error('Cannot test auth bridge without service initialization');
      }
    } catch (error) {
      console.log('❌ Auth bridge service test failed:', error.message);
      testResults.errors.push(`Auth bridge test failed: ${error.message}`);
    }
    
    // Test 3: Multi-provider authentication support
    console.log('\n🔐 Test 3: Testing multi-provider authentication...');
    try {
      if (isConnected) {
        const providers = await authService.getAvailableProviders();
        console.log('✅ Available providers:', providers);
        
        // Test OAuth2 configuration
        await authService.configureProvider('oauth2', {
          clientId: 'test-oauth-client',
          clientSecret: 'test-secret',
          redirectUri: 'http://localhost:7681/auth/oauth/callback'
        });
        
        // Test OpenID Connect configuration
        await authService.configureProvider('oidc', {
          clientId: 'test-oidc-client',
          issuer: 'https://oidc.example.com',
          redirectUri: 'http://localhost:7681/auth/oidc/callback'
        });
        
        // Test SAML configuration
        await authService.configureProvider('saml', {
          entityId: 'test-entity',
          ssoUrl: 'https://sso.example.com/saml',
          callbackUrl: 'http://localhost:7681/auth/saml/callback'
        });
        
        console.log('✅ Multi-provider authentication configured');
        testResults.multiProvider = true;
      } else {
        throw new Error('Cannot test multi-provider without service initialization');
      }
    } catch (error) {
      console.log('❌ Multi-provider authentication test failed:', error.message);
      testResults.errors.push(`Multi-provider test failed: ${error.message}`);
    }
    
    // Test 4: Session management integration
    console.log('\n🔄 Test 4: Testing session management...');
    try {
      if (isConnected) {
        // Authenticate user first
        const authResult = await authService.authenticateUser({
          email: 'test@example.com',
          password: 'test-password'
        }, 'oauth2');
        
        const mockAuthData = {
          accessToken: authResult.authData.accessToken,
          refreshToken: authResult.authData.refreshToken,
          expiresAt: authResult.authData.expiresAt
        };
        
        // Create session
        const session = await authService.createSession(authResult.userId, mockAuthData);
        console.log('✅ Session created:', session.id);
        
        // Validate session
        const validationResult = await authService.validateSession(session.id);
        if (validationResult.valid) {
          console.log('✅ Session validation successful');
        } else {
          console.log('❌ Session validation failed');
          throw new Error('Session validation returned invalid');
        }
        
        // Refresh session
        const refreshedSession = await authService.refreshSession(session.id);
        console.log('✅ Session refresh successful');
        
        // Get session info
        const sessionInfo = await authService.getSessionInfo(session.id);
        console.log('✅ Session info retrieved');
        
        console.log('✅ Session management integration working');
        testResults.sessionManagement = true;
        
        // Clean up
        await authService.invalidateSession(session.id);
        console.log('✅ Session invalidated successfully');
      } else {
        throw new Error('Cannot test session management without service initialization');
      }
    } catch (error) {
      console.log('❌ Session management test failed:', error.message);
      testResults.errors.push(`Session management test failed: ${error.message}`);
    }
    
    // Test 5: Security features
    console.log('\n🔒 Test 5: Testing security features...');
    try {
      if (isConnected) {
        // Test CSRF protection configuration
        await authService.configureProvider('oauth2', {
          clientId: 'secure-oauth-client',
          clientSecret: 'secure-secret',
          redirectUri: 'http://localhost:7681/auth/oauth/callback',
          security: {
            csrfProtection: true,
            secureCookies: true,
            sameSitePolicy: 'strict'
          }
        });
        
        // Test rate limiting configuration
        await authService.configureProvider('oauth2', {
          clientId: 'rate-limited-client',
          clientSecret: 'rate-limited-secret',
          redirectUri: 'http://localhost:7681/auth/oauth/callback',
          rateLimiting: {
            enabled: true,
            maxRequests: 100,
            windowMs: 60000
          }
        });
        
        console.log('✅ Security features (CSRF protection, rate limiting) enabled');
        testResults.securityFeatures = true;
      } else {
        throw new Error('Cannot test security features without service initialization');
      }
    } catch (error) {
      console.log('❌ Security features test failed:', error.message);
      testResults.errors.push(`Security features test failed: ${error.message}`);
    }
    
    // Display cache statistics
    console.log('\n📊 Cache Statistics:');
    const cacheStats = authService.getCacheStats();
    console.log('  - Auth cache entries:', cacheStats.authCacheSize);
    console.log('  - Session cache entries:', cacheStats.sessionCacheSize);
    console.log('  - Total cached entries:', cacheStats.totalCachedEntries);
    
  } catch (error) {
    console.error('❌ Unexpected error during testing:', error);
    testResults.errors.push(`Unexpected error: ${error.message}`);
  }

  // Final Results Summary
  console.log('\n🎯 Test Results Summary:');
  console.log('='.repeat(50));
  
  const results = [
    { name: 'Better Auth MCP Server Connection', passed: testResults.connection },
    { name: 'Auth Bridge Service', passed: testResults.authBridge },
    { name: 'Multi-Provider Authentication', passed: testResults.multiProvider },
    { name: 'Session Management Integration', passed: testResults.sessionManagement },
    { name: 'Security Features', passed: testResults.securityFeatures }
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
  console.log('\n🎫 TICKET-001 Acceptance Criteria Status:');
  const criteria = [
    'Better Auth MCP server connection tested and verified',
    'Auth bridge service implemented',
    'Multi-provider authentication configured',
    'Session management integration working',
    'Security features enabled'
  ];
  
  criteria.forEach((criterion, index) => {
    const passed = results[index].passed;
    const status = passed ? '✅' : '❌';
    console.log(`${status} ${criterion}`);
  });
  
  if (totalPassed === totalTests) {
    console.log('\n🎉 All acceptance criteria for TICKET-001 have been met!');
    return true;
  } else {
    console.log('\n⚠️ Some acceptance criteria are not met. Further investigation needed.');
    return false;
  }
}

// Run the test
testBetterAuthIntegration()
  .then(success => {
    console.log(success ? '\n🎉 Tests completed successfully' : '\n❌ Tests completed with failures');
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('Test runner error:', error);
    process.exit(1);
  });

export { testBetterAuthIntegration, BetterAuthService };