#!/usr/bin/env node

/**
 * 🧪 Simple User Management Test
 * Tests the core user management functionality directly
 */

import UserManagementService from './services/user-management-service.js';
import EnhancedAuthService from './services/enhanced-auth-service.js';

async function simpleUserTest() {
  console.log('🚀 Starting Simple User Management Test...');
  
  let authService, userService;
  
  try {
    // Initialize services
    console.log('🔧 Initializing services...');
    authService = new EnhancedAuthService();
    await authService.initialize();
    
    userService = new UserManagementService();
    await userService.initialize();
    
    console.log('✅ Services initialized successfully');
    
    // Test user data
    const testUser = {
      email: 'simple-test@example.com',
      username: 'simpletestuser',
      password: 'SecurePass123!',
      displayName: 'Simple Test User',
      role: 'USER'
    };
    
    console.log('🧪 Testing User Registration...');
    const registerResult = await userService.registerUser(testUser, 'oauth2');
    console.log('📝 Registration Result:', JSON.stringify(registerResult, null, 2));
    
    if (!registerResult.success) {
      throw new Error(`Registration failed: ${registerResult.message || 'Unknown error'}`);
    }
    
    const userId = registerResult.userId;
    console.log(`✅ User registered with ID: ${userId}`);
    
    console.log('🧪 Testing User Login...');
    const loginResult = await userService.loginUser(
      {
        email: testUser.email,
        password: testUser.password
      },
      'oauth2',
      {
        ipAddress: '127.0.0.1',
        userAgent: 'Simple Test'
      }
    );
    console.log('🔐 Login Result:', JSON.stringify(loginResult, null, 2));
    
    if (!loginResult.success) {
      throw new Error(`Login failed: ${loginResult.message || 'Unknown error'}`);
    }
    
    console.log('🧪 Testing Get User Profile...');
    const profile = await userService.getUserProfile(userId);
    console.log('👤 User Profile:', JSON.stringify(profile, null, 2));
    
    console.log('🧪 Testing Update User Profile...');
    const updateResult = await userService.updateUserProfile(userId, {
      bio: 'Updated bio from simple test',
      preferences: {
        theme: 'dark',
        language: 'en',
        notifications: true
      }
    });
    console.log('✏️ Profile Update Result:', JSON.stringify(updateResult, null, 2));
    
    console.log('🧪 Testing Get User Activity...');
    const activity = await userService.getUserActivity(userId, 10);
    console.log('📊 User Activity:', JSON.stringify(activity, null, 2));
    
    console.log('🧪 Testing Get User Settings...');
    const settings = await userService.getUserSettings(userId);
    console.log('⚙️ User Settings:', JSON.stringify(settings, null, 2));
    
    console.log('🧪 Testing Update User Settings...');
    const settingsUpdateResult = await userService.updateUserSettings(userId, {
      timezone: 'UTC',
      privacyLevel: 'enhanced',
      emailNotifications: true
    });
    console.log('⚙️ Settings Update Result:', JSON.stringify(settingsUpdateResult, null, 2));
    
    console.log('🧪 Testing Get User by Email...');
    const userByEmail = await userService.getUserByEmail(testUser.email);
    console.log('📧 User by Email:', JSON.stringify(userService.getSafeUserData(userByEmail), null, 2));
    
    console.log('🧪 Testing Service Statistics...');
    const stats = {
      totalUsers: userService.totalUsers,
      totalRegistrations: userService.totalRegistrations,
      totalLogins: userService.totalLogins,
      activeRateLimiters: userService.rateLimiters.size,
      totalActivities: userService.activityLogs.size
    };
    console.log('📈 Service Statistics:', JSON.stringify(stats, null, 2));
    
    console.log('✅ All user management tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Simple User Test failed:', error.message);
    console.error('Stack:', error.stack);
    throw error;
  } finally {
    // Cleanup
    console.log('🛑 Shutting down services...');
    if (userService) await userService.shutdown();
    if (authService) await authService.shutdown();
    console.log('✅ Simple user test completed');
  }
}

// Run the test
simpleUserTest().catch(error => {
  console.error('💥 Simple User Test crashed:', error);
  process.exit(1);
});