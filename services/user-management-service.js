/**
 * User Management Service with Better Auth MCP Integration
 * 
 * Complete user registration, profile management, and authentication
 * using Better Auth MCP server for enhanced security and multi-provider support.
 * 
 * Implements TICKET-006 requirements for User Management API
 */

import EventEmitter from 'events';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import EnhancedAuthService from './enhanced-auth-service.js';

class UserManagementService extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      dataDirectory: config.dataDirectory || './data/users',
      maxUsers: config.maxUsers || 1000,
      sessionTimeout: config.sessionTimeout || 3600000, // 1 hour
      refreshTokenTimeout: config.refreshTokenTimeout || 604800000, // 7 days
      enableRegistration: config.enableRegistration !== false,
      requireEmailVerification: config.requireEmailVerification !== false,
      enableProfileStorage: config.enableProfileStorage !== false,
      enableActivityTracking: config.enableActivityTracking !== false,
      defaultRole: config.defaultRole || 'USER',
      allowedRoles: config.allowedRoles || ['GUEST', 'USER', 'OPERATOR', 'ADMIN'],
      storage: {
        type: config.storage?.type || 'file', // 'file' or 'memory'
        backupInterval: config.storage?.backupInterval || 3600000, // 1 hour
        retentionDays: config.storage?.retentionDays || 30
      },
      security: {
        passwordMinLength: config.security?.passwordMinLength || 8,
        passwordRequireSpecial: config.security?.passwordRequireSpecial !== false,
        passwordRequireNumbers: config.security?.passwordRequireNumbers !== false,
        passwordRequireUppercase: config.security?.passwordRequireUppercase !== false,
        maxLoginAttempts: config.security?.maxLoginAttempts || 5,
        lockoutDuration: config.security?.lockoutDuration || 900000, // 15 minutes
        enableRateLimiting: config.security?.enableRateLimiting !== false
      },
      ...config
    };
    
    // Data storage
    this.users = new Map(); // userId -> user data
    this.profiles = new Map(); // userId -> profile data
    this.activities = new Map(); // userId -> activity log
    this.rateLimiters = new Map(); // ip/email -> rate limit data
    this.loginAttempts = new Map(); // email -> login attempt data
    
    // Service references
    this.authService = null;
    
    // State management
    this.isInitialized = false;
    this.isRunning = false;
    this.totalUsers = 0;
    this.totalRegistrations = 0;
    this.totalLogins = 0;
    
    // Background processes
    this.backupIntervalId = null;
    this.cleanupIntervalId = null;
  }

  /**
   * Initialize the User Management Service
   */
  async initialize() {
    try {
      console.log('👤 Initializing User Management Service...');
      
      // Initialize Enhanced Authentication Service
      this.authService = new EnhancedAuthService({
        sessionTimeout: this.config.sessionTimeout,
        refreshTokenTimeout: this.config.refreshTokenTimeout,
        maxConcurrentSessions: 10,
        enableRateLimiting: this.config.security.enableRateLimiting,
        enableIPTracking: true,
        enableDeviceFingerprinting: true
      });
      
      await this.authService.initialize();
      console.log('✅ Enhanced Authentication Service connected');
      
      // Initialize storage
      await this.initializeStorage();
      
      // Load existing user data
      await this.loadUserData();
      
      // Set up event listeners
      this.setupEventListeners();
      
      // Start background processes
      this.startBackgroundProcesses();
      
      this.isInitialized = true;
      console.log('✅ User Management Service initialized successfully');
      
      this.emit('initialized', {
        timestamp: new Date(),
        totalUsers: this.totalUsers,
        config: this.config
      });
      
      return true;
      
    } catch (error) {
      console.error('❌ Failed to initialize User Management Service:', error);
      throw error;
    }
  }

  /**
   * Initialize storage system
   */
  async initializeStorage() {
    try {
      if (this.config.storage.type === 'file') {
        // Create data directory if it doesn't exist
        await fs.mkdir(this.config.dataDirectory, { recursive: true });
        
        // Create subdirectories
        await fs.mkdir(path.join(this.config.dataDirectory, 'profiles'), { recursive: true });
        await fs.mkdir(path.join(this.config.dataDirectory, 'activities'), { recursive: true });
        await fs.mkdir(path.join(this.config.dataDirectory, 'backups'), { recursive: true });
        
        console.log('✅ File storage initialized');
      } else {
        console.log('✅ Memory storage initialized');
      }
    } catch (error) {
      console.error('❌ Failed to initialize storage:', error);
      throw error;
    }
  }

  /**
   * Load existing user data from storage
   */
  async loadUserData() {
    try {
      if (this.config.storage.type === 'file') {
        const usersFile = path.join(this.config.dataDirectory, 'users.json');
        
        try {
          const data = await fs.readFile(usersFile, 'utf-8');
          const usersData = JSON.parse(data);
          
          // Load users
          for (const [userId, userData] of Object.entries(usersData.users || {})) {
            this.users.set(userId, userData);
          }
          
          // Load profiles
          for (const [userId, profileData] of Object.entries(usersData.profiles || {})) {
            this.profiles.set(userId, profileData);
          }
          
          this.totalUsers = this.users.size;
          console.log(`📂 Loaded ${this.totalUsers} existing users`);
          
        } catch (error) {
          if (error.code !== 'ENOENT') {
            console.warn('⚠️ Failed to load existing user data:', error.message);
          }
          // File doesn't exist - start fresh
          console.log('📂 Starting with fresh user database');
        }
      }
    } catch (error) {
      console.error('❌ Failed to load user data:', error);
      throw error;
    }
  }

  /**
   * Save user data to storage
   */
  async saveUserData() {
    try {
      if (this.config.storage.type === 'file') {
        const usersFile = path.join(this.config.dataDirectory, 'users.json');
        const data = {
          users: Object.fromEntries(this.users),
          profiles: Object.fromEntries(this.profiles),
          metadata: {
            totalUsers: this.totalUsers,
            totalRegistrations: this.totalRegistrations,
            totalLogins: this.totalLogins,
            lastUpdated: new Date().toISOString()
          }
        };
        
        await fs.writeFile(usersFile, JSON.stringify(data, null, 2));
        console.log('💾 User data saved successfully');
      }
    } catch (error) {
      console.error('❌ Failed to save user data:', error);
      throw error;
    }
  }

  /**
   * Set up event listeners
   */
  setupEventListeners() {
    // Listen to authentication events
    if (this.authService) {
      this.authService.on('userAuthenticated', (data) => {
        this.handleUserAuthenticated(data);
      });
      
      this.authService.on('authenticationFailed', (data) => {
        this.handleAuthenticationFailed(data);
      });
      
      this.authService.on('sessionTerminated', (data) => {
        this.handleSessionTerminated(data);
      });
      
      this.authService.on('securityEvent', (data) => {
        this.handleSecurityEvent(data);
      });
    }
  }

  /**
   * Start background processes
   */
  startBackgroundProcesses() {
    // Backup interval
    if (this.config.storage.type === 'file') {
      this.backupIntervalId = setInterval(() => {
        this.performBackup();
      }, this.config.storage.backupInterval);
    }
    
    // Cleanup interval
    this.cleanupIntervalId = setInterval(() => {
      this.performCleanup();
    }, 3600000); // Clean up every hour
    
    console.log('⚡ Background processes started');
  }

  /**
   * Complete User Registration Flow with Better Auth
   */
  async registerUser(userData, authProvider = 'oauth2', options = {}) {
    try {
      if (!this.isInitialized) {
        throw new Error('User Management Service not initialized');
      }
      
      if (!this.config.enableRegistration) {
        throw new Error('User registration is currently disabled');
      }
      
      console.log(`📝 Registering new user with ${authProvider} provider...`);
      
      // Validate user data
      const validation = this.validateUserData(userData);
      if (!validation.valid) {
        throw new Error(`Invalid user data: ${validation.errors.join(', ')}`);
      }
      
      // Check if user already exists
      if (userData.email && await this.getUserByEmail(userData.email)) {
        throw new Error('User with this email already exists');
      }
      
      // Rate limiting check
      if (options.ipAddress) {
        await this.checkRegistrationRateLimit(options.ipAddress);
      }
      
      // Generate user ID
      const userId = this.generateUserId();
      
      // Create user data structure
      const user = {
        id: userId,
        email: userData.email,
        username: userData.username || userData.email.split('@')[0],
        displayName: userData.displayName || userData.username || userData.email.split('@')[0],
        role: userData.role || this.config.defaultRole,
        authProvider,
        authId: null, // Will be set after Better Auth registration
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
        emailVerified: !this.config.requireEmailVerification,
        settings: {
          notifications: userData.settings?.notifications || true,
          theme: userData.settings?.theme || 'default',
          language: userData.settings?.language || 'en',
          timezone: userData.settings?.timezone || 'UTC'
        },
        metadata: {
          registrationSource: options.source || 'direct',
          ipAddress: options.ipAddress,
          userAgent: options.userAgent,
          deviceFingerprint: options.deviceFingerprint
        }
      };
      
      // Create user profile
      const profile = {
        userId,
        bio: userData.profile?.bio || '',
        avatar: userData.profile?.avatar || '',
        preferences: userData.profile?.preferences || {},
        social: userData.profile?.social || {},
        customFields: userData.profile?.customFields || {}
      };
      
      // Register with Better Auth first
      let authResult;
      try {
        authResult = await this.registerWithBetterAuth(userData, authProvider, {
          userId,
          ipAddress: options.ipAddress,
          userAgent: options.userAgent,
          deviceFingerprint: options.deviceFingerprint
        });
        
        user.authId = authResult.userId;
        user.status = 'active';
        
      } catch (error) {
        console.warn('⚠️ Better Auth registration failed:', error.message);
        // In development mode, we can still create the user
        if (process.env.NODE_ENV === 'development' || process.env.TEST_MODE) {
          console.log('🧪 Development mode - continuing with local user creation');
          user.authId = userId; // Use local ID as fallback
          user.status = 'active';
        } else {
          throw new Error(`Failed to register with authentication provider: ${error.message}`);
        }
      }
      
      // Store user data
      this.users.set(userId, user);
      this.profiles.set(userId, profile);
      
      // Log registration activity
      await this.logUserActivity(userId, 'registration', {
        authProvider,
        ipAddress: options.ipAddress,
        userAgent: options.userAgent
      });
      
      this.totalUsers++;
      this.totalRegistrations++;
      
      // Save user data
      await this.saveUserData();
      
      console.log(`✅ User ${userId} registered successfully with ${authProvider}`);
      
      this.emit('userRegistered', {
        userId,
        email: user.email,
        authProvider,
        role: user.role,
        timestamp: new Date()
      });
      
      return {
        success: true,
        userId,
        user: this.getSafeUserData(user),
        profile,
        authSession: authResult,
        message: 'User registered successfully'
      };
      
    } catch (error) {
      console.error('❌ User registration failed:', error);
      this.emit('registrationFailed', {
        error: error.message,
        userData: { email: userData.email, authProvider },
        timestamp: new Date()
      });
      throw error;
    }
  }

  /**
   * Register user with Better Auth
   */
  async registerWithBetterAuth(userData, authProvider, options = {}) {
    try {
      // Prepare authentication credentials based on provider
      let credentials;
      
      switch (authProvider) {
        case 'oauth2':
          credentials = {
            email: userData.email,
            password: userData.password || this.generateSecurePassword(),
            provider: userData.oauthProvider || 'google'
          };
          break;
          
        case 'local':
          credentials = {
            email: userData.email,
            password: userData.password
          };
          break;
          
        case 'api_key':
          credentials = {
            apiKey: userData.apiKey,
            email: userData.email
          };
          break;
          
        default:
          throw new Error(`Unsupported authentication provider: ${authProvider}`);
      }
      
      // Authenticate with Better Auth
      const authResult = await this.authService.authenticateUser(
        credentials,
        authProvider,
        {
          ipAddress: options.ipAddress,
          userAgent: options.userAgent,
          deviceFingerprint: options.deviceFingerprint,
          metadata: {
            registration: true,
            source: 'user_management_service'
          }
        }
      );
      
      if (!authResult.success) {
        throw new Error(authResult.error || 'Authentication failed');
      }
      
      return authResult;
      
    } catch (error) {
      console.error('❌ Better Auth registration failed:', error);
      throw error;
    }
  }

  /**
   * User Login with Better Auth
   */
  async loginUser(credentials, authProvider, options = {}) {
    try {
      if (!this.isInitialized) {
        throw new Error('User Management Service not initialized');
      }
      
      console.log(`🔐 User login attempt with ${authProvider} provider...`);
      
      // Check rate limiting
      if (credentials.email) {
        await this.checkLoginRateLimit(credentials.email, options.ipAddress);
      }
      
      // Authenticate with Better Auth
      const authResult = await this.authService.authenticateUser(
        credentials,
        authProvider,
        {
          ipAddress: options.ipAddress,
          userAgent: options.userAgent,
          deviceFingerprint: options.deviceFingerprint
        }
      );
      
      if (!authResult.success) {
        await this.handleFailedLogin(credentials.email, options.ipAddress);
        throw new Error(authResult.error || 'Authentication failed');
      }
      
      // Find user by auth ID
      let user = await this.getUserByAuthId(authResult.userId);
      
      // If not found by auth ID, try by email
      if (!user && credentials.email) {
        user = await this.getUserByEmail(credentials.email);
        if (user) {
          // Update user's auth ID if not already set
          user.authId = authResult.userId;
          this.users.set(user.id, user);
          await this.saveUserData();
        }
      }
      
      if (!user) {
        throw new Error('User not found');
      }
      
      // Update user login data
      user.lastLoginAt = new Date();
      user.lastLoginIp = options.ipAddress;
      user.status = 'active';
      this.users.set(user.id, user);
      
      // Log login activity
      await this.logUserActivity(user.id, 'login', {
        authProvider,
        ipAddress: options.ipAddress,
        userAgent: options.userAgent
      });
      
      this.totalLogins++;
      
      // Clear failed login attempts
      this.loginAttempts.delete(credentials.email);
      
      console.log(`✅ User ${user.id} logged in successfully`);
      
      this.emit('userLoggedIn', {
        userId: user.id,
        email: user.email,
        authProvider,
        timestamp: new Date()
      });
      
      return {
        success: true,
        userId: user.id,
        user: this.getSafeUserData(user),
        profile: this.profiles.get(user.id),
        authSession: authResult,
        message: 'Login successful'
      };
      
    } catch (error) {
      console.error('❌ User login failed:', error);
      throw error;
    }
  }

  /**
   * Get user by email
   */
  async getUserByEmail(email) {
    for (const [userId, user] of this.users.entries()) {
      if (user.email === email) {
        return user;
      }
    }
    return null;
  }

  /**
   * Get user by auth ID
   */
  async getUserByAuthId(authId) {
    for (const [userId, user] of this.users.entries()) {
      if (user.authId === authId) {
        return user;
      }
    }
    return null;
  }

  /**
   * Get user by ID
   */
  async getUserById(userId) {
    return this.users.get(userId) || null;
  }

  /**
   * Get user profile
   */
  async getUserProfile(userId) {
    return this.profiles.get(userId) || null;
  }

  /**
   * Update user profile
   */
  async updateUserProfile(userId, profileData) {
    try {
      const user = await this.getUserById(userId);
      if (!user) {
        throw new Error('User not found');
      }
      
      const currentProfile = this.profiles.get(userId) || {};
      const updatedProfile = {
        ...currentProfile,
        ...profileData,
        userId,
        updatedAt: new Date()
      };
      
      this.profiles.set(userId, updatedProfile);
      
      // Update user data
      user.updatedAt = new Date();
      this.users.set(userId, user);
      
      await this.saveUserData();
      
      await this.logUserActivity(userId, 'profile_updated', {
        updatedFields: Object.keys(profileData)
      });
      
      console.log(`✅ Profile updated for user ${userId}`);
      
      return {
        success: true,
        profile: updatedProfile,
        message: 'Profile updated successfully'
      };
      
    } catch (error) {
      console.error('❌ Failed to update user profile:', error);
      throw error;
    }
  }

  /**
   * Update user settings
   */
  async updateUserSettings(userId, settings) {
    try {
      const user = await this.getUserById(userId);
      if (!user) {
        throw new Error('User not found');
      }
      
      user.settings = {
        ...user.settings,
        ...settings
      };
      user.updatedAt = new Date();
      
      this.users.set(userId, user);
      await this.saveUserData();
      
      await this.logUserActivity(userId, 'settings_updated', {
        updatedFields: Object.keys(settings)
      });
      
      console.log(`✅ Settings updated for user ${userId}`);
      
      return {
        success: true,
        settings: user.settings,
        message: 'Settings updated successfully'
      };
      
    } catch (error) {
      console.error('❌ Failed to update user settings:', error);
      throw error;
    }
  }

  /**
   * Get user activity log
   */
  async getUserActivity(userId, limit = 50) {
    const activities = this.activities.get(userId) || [];
    return activities.slice(-limit);
  }

  /**
   * Get user sessions
   */
  async getUserSessions(userId) {
    const user = await this.getUserById(userId);
    if (!user || !this.authService) {
      return [];
    }
    
    return this.authService.getUserSessions(userId);
  }

  /**
   * Log user activity
   */
  async logUserActivity(userId, activity, metadata = {}) {
    const activityEntry = {
      id: this.generateActivityId(),
      userId,
      activity,
      metadata,
      timestamp: new Date()
    };
    
    if (!this.activities.has(userId)) {
      this.activities.set(userId, []);
    }
    
    this.activities.get(userId).push(activityEntry);
    
    // Keep only recent activities (last 1000)
    const userActivities = this.activities.get(userId);
    if (userActivities.length > 1000) {
      this.activities.set(userId, userActivities.slice(-1000));
    }
    
    this.emit('userActivity', activityEntry);
  }

  /**
   * Validate user data
   */
  validateUserData(userData) {
    const errors = [];
    
    // Email validation
    if (!userData.email) {
      errors.push('Email is required');
    } else if (!this.isValidEmail(userData.email)) {
      errors.push('Invalid email format');
    }
    
    // Password validation (if provided)
    if (userData.password) {
      if (userData.password.length < this.config.security.passwordMinLength) {
        errors.push(`Password must be at least ${this.config.security.passwordMinLength} characters`);
      }
      
      if (this.config.security.passwordRequireUppercase && !/[A-Z]/.test(userData.password)) {
        errors.push('Password must contain at least one uppercase letter');
      }
      
      if (this.config.security.passwordRequireNumbers && !/\d/.test(userData.password)) {
        errors.push('Password must contain at least one number');
      }
      
      if (this.config.security.passwordRequireSpecial && !/[!@#$%^&*(),.?":{}|<>]/.test(userData.password)) {
        errors.push('Password must contain at least one special character');
      }
    }
    
    // Username validation (if provided)
    if (userData.username) {
      if (userData.username.length < 3) {
        errors.push('Username must be at least 3 characters');
      }
      if (!/^[a-zA-Z0-9_]+$/.test(userData.username)) {
        errors.push('Username can only contain letters, numbers, and underscores');
      }
    }
    
    // Role validation
    if (userData.role && !this.config.allowedRoles.includes(userData.role)) {
      errors.push(`Invalid role. Allowed roles: ${this.config.allowedRoles.join(', ')}`);
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Check registration rate limit
   */
  async checkRegistrationRateLimit(ipAddress) {
    const key = `reg:${ipAddress}`;
    const now = Date.now();
    const windowMs = 900000; // 15 minutes
    const maxAttempts = 3;
    
    const data = this.rateLimiters.get(key) || {
      attempts: 0,
      resetTime: now + windowMs,
      blocked: false
    };
    
    if (now > data.resetTime) {
      data.attempts = 0;
      data.resetTime = now + windowMs;
      data.blocked = false;
    }
    
    if (data.blocked) {
      throw new Error('Registration rate limit exceeded. Please try again later.');
    }
    
    data.attempts++;
    
    if (data.attempts > maxAttempts) {
      data.blocked = true;
      this.rateLimiters.set(key, data);
      throw new Error('Registration rate limit exceeded. Please try again later.');
    }
    
    this.rateLimiters.set(key, data);
  }

  /**
   * Check login rate limit
   */
  async checkLoginRateLimit(email, ipAddress) {
    const key = `login:${email}`;
    const now = Date.now();
    
    const data = this.loginAttempts.get(key) || {
      attempts: 0,
      firstAttempt: now,
      locked: false,
      lockTime: null
    };
    
    if (data.locked && now - data.lockTime < this.config.security.lockoutDuration) {
      const remainingTime = Math.ceil((this.config.security.lockoutDuration - (now - data.lockTime)) / 60000);
      throw new Error(`Account locked due to too many failed attempts. Try again in ${remainingTime} minutes.`);
    }
    
    if (data.locked && now - data.lockTime >= this.config.security.lockoutDuration) {
      // Reset lockout
      data.attempts = 0;
      data.locked = false;
      data.lockTime = null;
      data.firstAttempt = now;
    }
    
    this.loginAttempts.set(key, data);
  }

  /**
   * Handle failed login
   */
  async handleFailedLogin(email, ipAddress) {
    const key = `login:${email}`;
    const data = this.loginAttempts.get(key) || {
      attempts: 0,
      firstAttempt: Date.now(),
      locked: false,
      lockTime: null
    };
    
    data.attempts++;
    
    if (data.attempts >= this.config.security.maxLoginAttempts) {
      data.locked = true;
      data.lockTime = Date.now();
      
      this.emit('accountLocked', {
        email,
        ipAddress,
        attempts: data.attempts,
        timestamp: new Date()
      });
    }
    
    this.loginAttempts.set(key, data);
  }

  /**
   * Get safe user data (excluding sensitive information)
   */
  getSafeUserData(user) {
    const {
      authId,
      settings,
      metadata,
      ...safeUser
    } = user;
    
    return {
      ...safeUser,
      hasSettings: Object.keys(settings).length > 0,
      lastLoginAt: user.lastLoginAt || null,
      accountAge: Math.floor((Date.now() - new Date(user.createdAt).getTime()) / (1000 * 60 * 60 * 24)) // days
    };
  }

  /**
   * Event Handlers
   */
  handleUserAuthenticated(data) {
    console.log(`🔐 User authenticated: ${data.userId}`);
    this.emit('userActivity', {
      userId: data.userId,
      activity: 'authentication',
      timestamp: new Date()
    });
  }

  handleAuthenticationFailed(data) {
    console.log(`❌ Authentication failed: ${data.provider}`);
    this.emit('securityEvent', {
      type: 'authentication_failed',
      data,
      timestamp: new Date()
    });
  }

  handleSessionTerminated(data) {
    console.log(`🔓 Session terminated: ${data.sessionId}`);
    this.emit('userActivity', {
      userId: data.userId,
      sessionId: data.sessionId,
      activity: 'session_termination',
      timestamp: new Date()
    });
  }

  handleSecurityEvent(data) {
    console.log(`🔒 Security event: ${data.eventType}`);
    this.emit('securityEvent', {
      ...data,
      timestamp: new Date()
    });
  }

  /**
   * Background processes
   */
  async performBackup() {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupFile = path.join(this.config.dataDirectory, 'backups', `users-backup-${timestamp}.json`);
      
      const backupData = {
        users: Object.fromEntries(this.users),
        profiles: Object.fromEntries(this.profiles),
        activities: Object.fromEntries(this.activities),
        metadata: {
          backupTimestamp: timestamp,
          totalUsers: this.totalUsers,
          totalRegistrations: this.totalRegistrations,
          totalLogins: this.totalLogins
        }
      };
      
      await fs.writeFile(backupFile, JSON.stringify(backupData, null, 2));
      console.log(`💾 Backup completed: ${backupFile}`);
      
    } catch (error) {
      console.error('❌ Backup failed:', error);
    }
  }

  async performCleanup() {
    try {
      console.log('🧹 Performing cleanup...');
      
      const now = Date.now();
      const cutoffTime = now - (this.config.storage.retentionDays * 24 * 60 * 60 * 1000);
      
      // Clean up old activities
      let cleanedActivities = 0;
      for (const [userId, activities] of this.activities.entries()) {
        const filteredActivities = activities.filter(activity => 
          new Date(activity.timestamp).getTime() > cutoffTime
        );
        
        if (filteredActivities.length !== activities.length) {
          cleanedActivities += activities.length - filteredActivities.length;
          this.activities.set(userId, filteredActivities);
        }
      }
      
      // Clean up old rate limiters
      let cleanedRateLimiters = 0;
      for (const [key, data] of this.rateLimiters.entries()) {
        if (now > data.resetTime) {
          this.rateLimiters.delete(key);
          cleanedRateLimiters++;
        }
      }
      
      // Clean up old login attempts
      let cleanedLoginAttempts = 0;
      for (const [key, data] of this.loginAttempts.entries()) {
        if (!data.locked && now - data.firstAttempt > 86400000) { // 24 hours
          this.loginAttempts.delete(key);
          cleanedLoginAttempts++;
        }
      }
      
      console.log(`🧹 Cleanup completed: ${cleanedActivities} activities, ${cleanedRateLimiters} rate limiters, ${cleanedLoginAttempts} login attempts`);
      
    } catch (error) {
      console.error('❌ Cleanup failed:', error);
    }
  }

  /**
   * Get service statistics
   */
  getStats() {
    return {
      isInitialized: this.isInitialized,
      isRunning: this.isRunning,
      totalUsers: this.totalUsers,
      totalRegistrations: this.totalRegistrations,
      totalLogins: this.totalLogins,
      activeRateLimiters: this.rateLimiters.size,
      activeLoginAttempts: this.loginAttempts.size,
      totalActivities: Array.from(this.activities.values()).reduce((sum, acts) => sum + acts.length, 0),
      config: this.config
    };
  }

  /**
   * Utility methods
   */
  generateUserId() {
    return `user_${uuidv4()}`;
  }

  generateActivityId() {
    return `act_${crypto.randomBytes(16).toString('hex')}`;
  }

  generateSecurePassword() {
    return crypto.randomBytes(16).toString('hex');
  }

  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Shutdown the service
   */
  async shutdown() {
    console.log('🛑 Shutting down User Management Service...');
    
    this.isRunning = false;
    
    // Clear intervals
    if (this.backupIntervalId) {
      clearInterval(this.backupIntervalId);
    }
    if (this.cleanupIntervalId) {
      clearInterval(this.cleanupIntervalId);
    }
    
    // Save final data
    await this.saveUserData().catch(error => {
      console.error('❌ Failed to save user data during shutdown:', error);
    });
    
    // Shutdown auth service
    if (this.authService) {
      await this.authService.shutdown().catch(error => {
        console.error('❌ Error shutting down auth service:', error);
      });
    }
    
    console.log('✅ User Management Service shutdown complete');
  }
}

// Export for use in other modules
export default UserManagementService;