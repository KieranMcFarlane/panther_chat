/**
 * Complete User Registration System Test
 * 
 * Tests the complete user registration flow with Better Auth integration
 * including registration, login, profile management, and security features.
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Test configuration
const TEST_CONFIG = {
  testUsers: [
    {
      email: 'testuser1@example.com',
      username: 'testuser1',
      password: 'SecurePass123!',
      displayName: 'Test User 1',
      role: 'USER',
      profile: {
        bio: 'Test user for registration system',
        preferences: { theme: 'dark', language: 'en' }
      }
    },
    {
      email: 'admin@example.com',
      username: 'admin',
      password: 'AdminPass123!',
      displayName: 'Admin User',
      role: 'ADMIN',
      profile: {
        bio: 'Administrator user',
        preferences: { theme: 'light', language: 'en' }
      }
    }
  ],
  testProviders: ['oauth2', 'local']
};

class UserRegistrationTest {
  constructor() {
    this.userService = null;
    this.authService = null;
    this.testResults = [];
    this.startTime = null;
  }

  async initialize() {
    try {
      console.log('🧪 Initializing User Registration Test...');
      
      // Import services
      const { default: UserManagementService } = await import('./services/user-management-service.js');
      const { default: EnhancedAuthService } = await import('./services/enhanced-auth-service.js');
      
      // Initialize services
      this.userService = new UserManagementService({
        enableRegistration: true,
        requireEmailVerification: false, // Disable for testing
        storage: {
          type: 'memory', // Use memory storage for testing
          backupInterval: 0 // Disable backups for testing
        },
        security: {
          passwordMinLength: 8,
          maxLoginAttempts: 3,
          lockoutDuration: 30000 // 30 seconds for testing
        }
      });
      
      this.authService = new EnhancedAuthService({
        sessionTimeout: 300000, // 5 minutes for testing
        refreshTokenTimeout: 3600000, // 1 hour for testing
        enableRateLimiting: true
      });
      
      await this.userService.initialize();
      console.log('✅ Test services initialized');
      
      return true;
      
    } catch (error) {
      console.error('❌ Failed to initialize test services:', error);
      return false;
    }
  }

  async runTests() {
    this.startTime = Date.now();
    console.log('🚀 Starting User Registration System Tests...\n');
    
    const testSuites = [
      { name: 'User Registration', tests: this.testUserRegistration.bind(this) },
      { name: 'User Login', tests: this.testUserLogin.bind(this) },
      { name: 'Profile Management', tests: this.testProfileManagement.bind(this) },
      { name: 'Security Features', tests: this.testSecurityFeatures.bind(this) },
      { name: 'Rate Limiting', tests: this.testRateLimiting.bind(this) },
      { name: 'Activity Tracking', tests: this.testActivityTracking.bind(this) }
    ];
    
    let totalPassed = 0;
    let totalFailed = 0;
    
    for (const suite of testSuites) {
      console.log(`📋 Running ${suite.name} Tests...`);
      console.log('═'.repeat(50));
      
      try {
        const results = await suite.tests();
        const passed = results.filter(r => r.passed).length;
        const failed = results.filter(r => !r.passed).length;
        
        totalPassed += passed;
        totalFailed += failed;
        
        this.testResults.push({ suite: suite.name, results });
        
        console.log(`✅ ${suite.name} Tests: ${passed} passed, ${failed} failed\n`);
        
      } catch (error) {
        console.error(`❌ ${suite.name} Tests failed:`, error.message);
        totalFailed++;
        this.testResults.push({ 
          suite: suite.name, 
          results: [{ 
            name: 'Suite Execution', 
            passed: false, 
            error: error.message 
          }] 
        });
      }
    }
    
    await this.generateTestReport(totalPassed, totalFailed);
  }

  async testUserRegistration() {
    const results = [];
    
    // Test 1: Valid user registration
    try {
      console.log('🔍 Testing valid user registration...');
      const result = await this.userService.registerUser(
        TEST_CONFIG.testUsers[0],
        'oauth2',
        { ipAddress: '127.0.0.1', userAgent: 'test-agent' }
      );
      
      if (result.success && result.userId && result.user) {
        results.push({
          name: 'Valid User Registration',
          passed: true,
          details: `User registered with ID: ${result.userId}`
        });
        console.log('✅ Valid user registration successful');
      } else {
        results.push({
          name: 'Valid User Registration',
          passed: false,
          error: 'Registration failed or returned invalid result'
        });
      }
    } catch (error) {
      results.push({
        name: 'Valid User Registration',
        passed: false,
        error: error.message
      });
    }
    
    // Test 2: Duplicate email registration
    try {
      console.log('🔍 Testing duplicate email registration...');
      const result = await this.userService.registerUser(
        TEST_CONFIG.testUsers[0],
        'oauth2',
        { ipAddress: '127.0.0.1', userAgent: 'test-agent' }
      );
      
      if (!result.success && result.message?.includes('already exists')) {
        results.push({
          name: 'Duplicate Email Prevention',
          passed: true,
          details: 'Duplicate email correctly rejected'
        });
        console.log('✅ Duplicate email prevention working');
      } else {
        results.push({
          name: 'Duplicate Email Prevention',
          passed: false,
          error: 'Duplicate email was not prevented'
        });
      }
    } catch (error) {
      if (error.message.includes('already exists')) {
        results.push({
          name: 'Duplicate Email Prevention',
          passed: true,
          details: 'Duplicate email correctly rejected'
        });
        console.log('✅ Duplicate email prevention working');
      } else {
        results.push({
          name: 'Duplicate Email Prevention',
          passed: false,
          error: error.message
        });
      }
    }
    
    // Test 3: Invalid email format
    try {
      console.log('🔍 Testing invalid email format...');
      const invalidUser = {
        ...TEST_CONFIG.testUsers[1],
        email: 'invalid-email'
      };
      
      await this.userService.registerUser(
        invalidUser,
        'oauth2',
        { ipAddress: '127.0.0.1', userAgent: 'test-agent' }
      );
      
      results.push({
        name: 'Invalid Email Validation',
        passed: false,
        error: 'Invalid email was accepted'
      });
    } catch (error) {
      if (error.message.includes('Invalid email')) {
        results.push({
          name: 'Invalid Email Validation',
          passed: true,
          details: 'Invalid email correctly rejected'
        });
        console.log('✅ Invalid email validation working');
      } else {
        results.push({
          name: 'Invalid Email Validation',
          passed: false,
          error: `Unexpected error: ${error.message}`
        });
      }
    }
    
    // Test 4: Weak password validation
    try {
      console.log('🔍 Testing weak password validation...');
      const weakUser = {
        ...TEST_CONFIG.testUsers[1],
        email: 'weak@example.com',
        password: 'weak'
      };
      
      await this.userService.registerUser(
        weakUser,
        'local',
        { ipAddress: '127.0.0.1', userAgent: 'test-agent' }
      );
      
      results.push({
        name: 'Weak Password Validation',
        passed: false,
        error: 'Weak password was accepted'
      });
    } catch (error) {
      if (error.message.includes('Password must')) {
        results.push({
          name: 'Weak Password Validation',
          passed: true,
          details: 'Weak password correctly rejected'
        });
        console.log('✅ Weak password validation working');
      } else {
        results.push({
          name: 'Weak Password Validation',
          passed: false,
          error: `Unexpected error: ${error.message}`
        });
      }
    }
    
    return results;
  }

  async testUserLogin() {
    const results = [];
    
    // Test 1: Valid user login
    try {
      console.log('🔍 Testing valid user login...');
      const result = await this.userService.loginUser(
        { email: TEST_CONFIG.testUsers[0].email, password: TEST_CONFIG.testUsers[0].password },
        'oauth2',
        { ipAddress: '127.0.0.1', userAgent: 'test-agent' }
      );
      
      if (result.success && result.userId && result.authSession) {
        results.push({
          name: 'Valid User Login',
          passed: true,
          details: `User logged in with session: ${result.authSession.sessionId}`
        });
        console.log('✅ Valid user login successful');
      } else {
        results.push({
          name: 'Valid User Login',
          passed: false,
          error: 'Login failed or returned invalid result'
        });
      }
    } catch (error) {
      results.push({
        name: 'Valid User Login',
        passed: false,
        error: error.message
      });
    }
    
    // Test 2: Invalid credentials login
    try {
      console.log('🔍 Testing invalid credentials login...');
      await this.userService.loginUser(
        { email: TEST_CONFIG.testUsers[0].email, password: 'wrongpassword' },
        'oauth2',
        { ipAddress: '127.0.0.1', userAgent: 'test-agent' }
      );
      
      results.push({
        name: 'Invalid Credentials Rejection',
        passed: false,
        error: 'Invalid credentials were accepted'
      });
    } catch (error) {
      if (error.message.includes('Authentication failed') || error.message.includes('Invalid credentials')) {
        results.push({
          name: 'Invalid Credentials Rejection',
          passed: true,
          details: 'Invalid credentials correctly rejected'
        });
        console.log('✅ Invalid credentials rejection working');
      } else {
        results.push({
          name: 'Invalid Credentials Rejection',
          passed: false,
          error: `Unexpected error: ${error.message}`
        });
      }
    }
    
    // Test 3: Non-existent user login
    try {
      console.log('🔍 Testing non-existent user login...');
      await this.userService.loginUser(
        { email: 'nonexistent@example.com', password: 'anypassword' },
        'oauth2',
        { ipAddress: '127.0.0.1', userAgent: 'test-agent' }
      );
      
      results.push({
        name: 'Non-existent User Rejection',
        passed: false,
        error: 'Non-existent user login was accepted'
      });
    } catch (error) {
      if (error.message.includes('not found') || error.message.includes('Authentication failed')) {
        results.push({
          name: 'Non-existent User Rejection',
          passed: true,
          details: 'Non-existent user correctly rejected'
        });
        console.log('✅ Non-existent user rejection working');
      } else {
        results.push({
          name: 'Non-existent User Rejection',
          passed: false,
          error: `Unexpected error: ${error.message}`
        });
      }
    }
    
    return results;
  }

  async testProfileManagement() {
    const results = [];
    
    // Get the first registered user for profile tests
    let user = await this.userService.getUserByEmail(TEST_CONFIG.testUsers[0].email);
    if (!user) {
      results.push({
        name: 'Profile Management Setup',
        passed: false,
        error: 'No test user available for profile tests'
      });
      return results;
    }
    
    // Test 1: Update user profile
    try {
      console.log('🔍 Testing profile update...');
      const profileUpdate = {
        bio: 'Updated bio for testing',
        preferences: { theme: 'light', language: 'es' },
        customFields: { location: 'Test City' }
      };
      
      const result = await this.userService.updateUserProfile(user.id, profileUpdate);
      
      if (result.success && result.profile) {
        results.push({
          name: 'Profile Update',
          passed: true,
          details: 'Profile updated successfully'
        });
        console.log('✅ Profile update successful');
      } else {
        results.push({
          name: 'Profile Update',
          passed: false,
          error: 'Profile update failed'
        });
      }
    } catch (error) {
      results.push({
        name: 'Profile Update',
        passed: false,
        error: error.message
      });
    }
    
    // Test 2: Update user settings
    try {
      console.log('🔍 Testing settings update...');
      const settingsUpdate = {
        notifications: false,
        theme: 'dark',
        language: 'fr',
        timezone: 'Europe/Paris'
      };
      
      const result = await this.userService.updateUserSettings(user.id, settingsUpdate);
      
      if (result.success && result.settings) {
        results.push({
          name: 'Settings Update',
          passed: true,
          details: 'Settings updated successfully'
        });
        console.log('✅ Settings update successful');
      } else {
        results.push({
          name: 'Settings Update',
          passed: false,
          error: 'Settings update failed'
        });
      }
    } catch (error) {
      results.push({
        name: 'Settings Update',
        passed: false,
        error: error.message
      });
    }
    
    // Test 3: Get user profile
    try {
      console.log('🔍 Testing profile retrieval...');
      const profile = await this.userService.getUserProfile(user.id);
      
      if (profile && profile.bio && profile.preferences) {
        results.push({
          name: 'Profile Retrieval',
          passed: true,
          details: 'Profile retrieved successfully'
        });
        console.log('✅ Profile retrieval successful');
      } else {
        results.push({
          name: 'Profile Retrieval',
          passed: false,
          error: 'Profile retrieval returned invalid data'
        });
      }
    } catch (error) {
      results.push({
        name: 'Profile Retrieval',
        passed: false,
        error: error.message
      });
    }
    
    return results;
  }

  async testSecurityFeatures() {
    const results = [];
    
    // Test 1: Password requirements validation
    try {
      console.log('🔍 Testing password requirements...');
      const validation = this.userService.validateUserData({
        email: 'test@example.com',
        password: 'weak',
        username: 'testuser'
      });
      
      if (!validation.valid && validation.errors.some(e => e.includes('Password must'))) {
        results.push({
          name: 'Password Requirements',
          passed: true,
          details: 'Password requirements properly validated'
        });
        console.log('✅ Password requirements validation working');
      } else {
        results.push({
          name: 'Password Requirements',
          passed: false,
          error: 'Password requirements not properly validated'
        });
      }
    } catch (error) {
      results.push({
        name: 'Password Requirements',
        passed: false,
        error: error.message
      });
    }
    
    // Test 2: Email validation
    try {
      console.log('🔍 Testing email validation...');
      const validation = this.userService.validateUserData({
        email: 'invalid-email',
        password: 'ValidPass123!',
        username: 'testuser'
      });
      
      if (!validation.valid && validation.errors.some(e => e.includes('Invalid email'))) {
        results.push({
          name: 'Email Validation',
          passed: true,
          details: 'Email format properly validated'
        });
        console.log('✅ Email validation working');
      } else {
        results.push({
          name: 'Email Validation',
          passed: false,
          error: 'Email validation not working'
        });
      }
    } catch (error) {
      results.push({
        name: 'Email Validation',
        passed: false,
        error: error.message
      });
    }
    
    // Test 3: User data sanitization (safe user data)
    try {
      console.log('🔍 Testing user data sanitization...');
      const user = await this.userService.getUserByEmail(TEST_CONFIG.testUsers[0].email);
      
      if (user) {
        const safeUser = this.userService.getSafeUserData(user);
        
        if (safeUser && !safeUser.authId && !safeUser.settings && !safeUser.metadata) {
          results.push({
            name: 'User Data Sanitization',
            passed: true,
            details: 'Sensitive user data properly sanitized'
          });
          console.log('✅ User data sanitization working');
        } else {
          results.push({
            name: 'User Data Sanitization',
            passed: false,
            error: 'Sensitive user data not properly sanitized'
          });
        }
      } else {
        results.push({
          name: 'User Data Sanitization',
          passed: false,
          error: 'No test user available'
        });
      }
    } catch (error) {
      results.push({
        name: 'User Data Sanitization',
        passed: false,
        error: error.message
      });
    }
    
    return results;
  }

  async testRateLimiting() {
    const results = [];
    
    // Test 1: Registration rate limiting
    try {
      console.log('🔍 Testing registration rate limiting...');
      
      // Try to register multiple users quickly
      const registrations = [];
      for (let i = 0; i < 5; i++) {
        try {
          const testUser = {
            ...TEST_CONFIG.testUsers[1],
            email: `ratetest${i}@example.com`,
            username: `ratetest${i}`
          };
          
          const result = await this.userService.registerUser(
            testUser,
            'oauth2',
            { ipAddress: '127.0.0.1', userAgent: 'test-agent' }
          );
          
          registrations.push(result);
        } catch (error) {
          registrations.push({ error: error.message });
        }
      }
      
      // Check if any registrations were rate limited
      const rateLimited = registrations.some(r => r.error?.includes('rate limit exceeded'));
      
      if (rateLimited) {
        results.push({
          name: 'Registration Rate Limiting',
          passed: true,
          details: 'Registration rate limiting is working'
        });
        console.log('✅ Registration rate limiting working');
      } else {
        results.push({
          name: 'Registration Rate Limiting',
          passed: false,
          error: 'Registration rate limiting not detected'
        });
      }
    } catch (error) {
      results.push({
        name: 'Registration Rate Limiting',
        passed: false,
        error: error.message
      });
    }
    
    // Test 2: Login attempt rate limiting
    try {
      console.log('🔍 Testing login rate limiting...');
      
      // Try multiple failed logins
      const loginAttempts = [];
      for (let i = 0; i < 4; i++) {
        try {
          await this.userService.loginUser(
            { email: TEST_CONFIG.testUsers[0].email, password: 'wrongpassword' },
            'oauth2',
            { ipAddress: '127.0.0.1', userAgent: 'test-agent' }
          );
          loginAttempts.push({ success: true });
        } catch (error) {
          loginAttempts.push({ error: error.message });
        }
      }
      
      // Check if account was locked
      const accountLocked = loginAttempts.some(attempt => 
        attempt.error?.includes('Account locked') || attempt.error?.includes('too many failed attempts')
      );
      
      if (accountLocked) {
        results.push({
          name: 'Login Rate Limiting',
          passed: true,
          details: 'Login rate limiting is working'
        });
        console.log('✅ Login rate limiting working');
      } else {
        results.push({
          name: 'Login Rate Limiting',
          passed: false,
          error: 'Login rate limiting not detected'
        });
      }
    } catch (error) {
      results.push({
        name: 'Login Rate Limiting',
        passed: false,
        error: error.message
      });
    }
    
    return results;
  }

  async testActivityTracking() {
    const results = [];
    
    // Get the first registered user
    let user = await this.userService.getUserByEmail(TEST_CONFIG.testUsers[0].email);
    if (!user) {
      results.push({
        name: 'Activity Tracking Setup',
        passed: false,
        error: 'No test user available for activity tests'
      });
      return results;
    }
    
    // Test 1: Activity logging
    try {
      console.log('🔍 Testing activity logging...');
      
      // Perform some actions that should generate activity logs
      await this.userService.updateUserProfile(user.id, { bio: 'Test activity logging' });
      await this.userService.updateUserSettings(user.id, { theme: 'dark' });
      
      // Get activity log
      const activities = await this.userService.getUserActivity(user.id, 10);
      
      if (activities.length >= 2) {
        const profileUpdates = activities.filter(a => a.activity === 'profile_updated');
        const settingsUpdates = activities.filter(a => a.activity === 'settings_updated');
        
        if (profileUpdates.length > 0 && settingsUpdates.length > 0) {
          results.push({
            name: 'Activity Logging',
            passed: true,
            details: `Logged ${activities.length} activities including profile and settings updates`
          });
          console.log('✅ Activity logging working');
        } else {
          results.push({
            name: 'Activity Logging',
            passed: false,
            error: 'Expected activity types not found in logs'
          });
        }
      } else {
        results.push({
          name: 'Activity Logging',
          passed: false,
          error: `Expected at least 2 activities, found ${activities.length}`
        });
      }
    } catch (error) {
      results.push({
        name: 'Activity Logging',
        passed: false,
        error: error.message
      });
    }
    
    // Test 2: Activity log structure
    try {
      console.log('🔍 Testing activity log structure...');
      const activities = await this.userService.getUserActivity(user.id, 1);
      
      if (activities.length > 0) {
        const activity = activities[0];
        
        if (activity.id && activity.userId && activity.activity && activity.timestamp) {
          results.push({
            name: 'Activity Log Structure',
            passed: true,
            details: 'Activity log entries have proper structure'
          });
          console.log('✅ Activity log structure correct');
        } else {
          results.push({
            name: 'Activity Log Structure',
            passed: false,
            error: 'Activity log entries missing required fields'
          });
        }
      } else {
        results.push({
          name: 'Activity Log Structure',
          passed: false,
          error: 'No activities found to test structure'
        });
      }
    } catch (error) {
      results.push({
        name: 'Activity Log Structure',
        passed: false,
        error: error.message
      });
    }
    
    return results;
  }

  async generateTestReport(passed, failed) {
    const endTime = Date.now();
    const duration = endTime - this.startTime;
    
    console.log('═'.repeat(60));
    console.log('🧪 TEST REPORT');
    console.log('═'.repeat(60));
    console.log(`Total Tests Run: ${passed + failed}`);
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`⏱️ Duration: ${duration}ms`);
    console.log(`📊 Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);
    console.log('');
    
    // Detailed results
    for (const suiteResult of this.testResults) {
      console.log(`📋 ${suiteResult.suite} Results:`);
      for (const test of suiteResult.results) {
        const status = test.passed ? '✅' : '❌';
        const message = test.passed ? test.details : test.error;
        console.log(`  ${status} ${test.name}: ${message}`);
      }
      console.log('');
    }
    
    // Service statistics
    if (this.userService) {
      const stats = this.userService.getStats();
      console.log('📊 Service Statistics:');
      console.log(`  Total Users: ${stats.totalUsers}`);
      console.log(`  Total Registrations: ${stats.totalRegistrations}`);
      console.log(`  Total Logins: ${stats.totalLogins}`);
      console.log(`  Active Rate Limiters: ${stats.activeRateLimiters}`);
      console.log(`  Total Activities: ${stats.totalActivities}`);
    }
    
    console.log('═'.repeat(60));
    console.log('🏁 Test execution completed');
  }

  async cleanup() {
    try {
      if (this.userService) {
        await this.userService.shutdown();
      }
      console.log('🧹 Test cleanup completed');
    } catch (error) {
      console.error('❌ Cleanup failed:', error);
    }
  }
}

// Main test execution
async function runTests() {
  const test = new UserRegistrationTest();
  
  try {
    // Initialize test
    const initialized = await test.initialize();
    if (!initialized) {
      console.error('❌ Failed to initialize test environment');
      process.exit(1);
    }
    
    // Run tests
    await test.runTests();
    
  } catch (error) {
    console.error('❌ Test execution failed:', error);
    process.exit(1);
  } finally {
    // Cleanup
    await test.cleanup();
  }
}

// Run tests if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests().catch(console.error);
}

export default UserRegistrationTest;