#!/usr/bin/env node

/**
 * 🧪 Live API Test for User Management System
 * Tests the complete user management API with real HTTP requests
 */

import { createServer } from 'http';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Dynamic imports for ES modules
const routerModule = await import('./services/router-service.js');
const userModule = await import('./services/user-management-service.js');
const authModule = await import('./services/enhanced-auth-service.js');

const RouterService = routerModule.default;
const UserManagementService = userModule.default;
const EnhancedAuthService = authModule.default;

async function liveAPITest() {
  console.log('🚀 Starting Live API Test...');
  
  let router, authService, userService;
  
  try {
    // Initialize services
    console.log('🔧 Initializing services...');
    authService = new EnhancedAuthService();
    await authService.initialize();
    
    userService = new UserManagementService();
    await userService.initialize();
    
    router = new RouterService({ port: 3001 });
    await router.initialize();
    router.setAuthService(authService);
    router.setUserService(userService);
    
    await router.start();
    
    console.log('✅ Services started on port 3001');
    
    // Test data
    const testUser = {
      email: 'live-test@example.com',
      username: 'livetestuser',
      password: 'SecurePass123!',
      displayName: 'Live Test User',
      role: 'USER'
    };
    
    console.log('🧪 Testing User Registration...');
    const registerResponse = await fetch('http://localhost:3001/users/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userData: testUser,
        authProvider: 'oauth2'
      })
    });
    
    const registerResult = await registerResponse.json();
    console.log('📝 Registration Response:', JSON.stringify(registerResult, null, 2));
    
    if (!registerResult.success) {
      throw new Error(`Registration failed: ${registerResult.message || registerResult.error}`);
    }
    
    const { userId } = registerResult;
    
    console.log('🧪 Testing User Login...');
    const loginResponse = await fetch('http://localhost:3001/users/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        credentials: {
          email: testUser.email,
          password: testUser.password
        },
        authProvider: 'oauth2'
      })
    });
    
    const loginResult = await loginResponse.json();
    console.log('🔐 Login Response:', JSON.stringify(loginResult, null, 2));
    
    if (!loginResult.success) {
      throw new Error(`Login failed: ${loginResult.message || loginResult.error}`);
    }
    
    console.log('🧪 Testing Get User Profile...');
    const profileResponse = await fetch(`http://localhost:3001/users/${userId}/profile`);
    const profileResult = await profileResponse.json();
    console.log('👤 Profile Response:', JSON.stringify(profileResult, null, 2));
    
    console.log('🧪 Testing Update User Profile...');
    const updateResponse = await fetch(`http://localhost:3001/users/${userId}/profile`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bio: 'Updated bio from live test',
        preferences: {
          theme: 'dark',
          language: 'en',
          notifications: true
        }
      })
    });
    
    const updateResult = await updateResponse.json();
    console.log('✏️ Profile Update Response:', JSON.stringify(updateResult, null, 2));
    
    console.log('🧪 Testing Get User Activity...');
    const activityResponse = await fetch(`http://localhost:3001/users/${userId}/activity`);
    const activityResult = await activityResponse.json();
    console.log('📊 Activity Response:', JSON.stringify(activityResult, null, 2));
    
    console.log('🧪 Testing System Stats...');
    const statsResponse = await fetch('http://localhost:3001/system/stats');
    const statsResult = await statsResponse.json();
    console.log('📈 System Stats:', JSON.stringify(statsResult, null, 2));
    
    console.log('✅ All API tests completed successfully!');
    
  } catch (error) {
    console.error('❌ API Test failed:', error.message);
    throw error;
  } finally {
    // Cleanup
    console.log('🛑 Shutting down services...');
    if (router) await router.stop();
    if (userService) await userService.shutdown();
    if (authService) await authService.shutdown();
    console.log('✅ Live API test completed');
  }
}

// Run the test
liveAPITest().catch(error => {
  console.error('💥 Live API Test crashed:', error);
  process.exit(1);
});