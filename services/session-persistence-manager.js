#!/usr/bin/env node

/**
 * 🔄 Session Persistence Manager with Better Auth Integration
 * 
 * TICKET-008: Session Persistence with Better Auth
 * 
 * Manages session state preservation across slot restarts with Better Auth integration
 */

import EventEmitter from 'events';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

class SessionPersistenceManager extends EventEmitter {
  constructor(options = {}) {
    super();
    this.betterAuth = options.betterAuth;
    this.storageManager = options.storageManager;
    this.backupInterval = options.backupInterval || 5 * 60 * 1000; // 5 minutes
    this.maxBackups = options.maxBackups || 10;
    this.backupDirectory = options.backupDirectory || './data/backups/sessions';
    
    this.activeSessions = new Map();
    this.backupSchedule = new Map();
    this.sessionBackups = new Map();
    
    this.setupEventHandlers();
  }

  /**
   * Initialize the session persistence manager
   */
  async initialize() {
    // Create backup directory
    await fs.mkdir(this.backupDirectory, { recursive: true });
    
    // Load existing session backups
    await this.loadExistingBackups();
    
    // Start periodic backup process
    this.startBackupScheduler();
    
    console.log('✅ Session Persistence Manager initialized');
  }

  /**
   * Setup event handlers for session lifecycle
   */
  setupEventHandlers() {
    // Check if EventEmitter methods are available
    if (typeof this.on !== 'function') {
      console.warn('⚠️ EventEmitter.on method not available, skipping event handler setup');
      return;
    }
    
    // Check if handler methods exist before binding
    const handlers = [
      'handleSlotCreated',
      'handleSlotDestroyed', 
      'handleSlotRestarted',
      'handleSlotSessionUpdated'
    ];
    
    for (const handler of handlers) {
      if (typeof this[handler] !== 'function') {
        console.warn(`⚠️ Handler method ${handler} not found, skipping event handler setup`);
        return;
      }
    }
    
    // Listen for slot events
    this.on('slotCreated', this.handleSlotCreated.bind(this));
    this.on('slotDestroyed', this.handleSlotDestroyed.bind(this));
    this.on('slotRestarted', this.handleSlotRestarted.bind(this));
    this.on('slotSessionUpdated', this.handleSlotSessionUpdated.bind(this));
    
    // Listen for Better Auth events - EnhancedAuthService extends EventEmitter
    if (this.betterAuth && typeof this.betterAuth.on === 'function') {
      const authHandlers = [
        'handleBetterAuthSessionCreated',
        'handleBetterAuthSessionRefreshed',
        'handleBetterAuthSessionExpired'
      ];
      
      for (const handler of authHandlers) {
        if (typeof this[handler] !== 'function') {
          console.warn(`⚠️ Auth handler method ${handler} not found, skipping`);
          continue;
        }
      }
      
      this.betterAuth.on('sessionCreated', this.handleBetterAuthSessionCreated.bind(this));
      this.betterAuth.on('sessionRefreshed', this.handleBetterAuthSessionRefreshed.bind(this));
      this.betterAuth.on('sessionExpired', this.handleBetterAuthSessionExpired.bind(this));
    }
  }

  /**
   * Handle new slot creation - start session tracking
   */
  async handleSlotCreated(slotData) {
    const { slotId, userId, sessionId } = slotData;
    
    // Register session for tracking
    this.activeSessions.set(slotId, {
      slotId,
      userId,
      sessionId,
      createdAt: Date.now(),
      lastBackup: null,
      backupCount: 0
    });
    
    // Start periodic backups for this session
    this.startSessionBackups(slotId);
    
    console.log(`📝 Started session tracking for slot ${slotId}`);
  }

  /**
   * Handle slot destruction - create final backup
   */
  async handleSlotDestroyed(slotData) {
    const { slotId } = slotData;
    
    // Create final backup
    await this.createBackup(slotId, { type: 'destruction' });
    
    // Stop session tracking
    this.stopSessionBackups(slotId);
    this.activeSessions.delete(slotId);
    
    console.log(`💾 Created final backup for slot ${slotId}`);
  }

  /**
   * Handle slot restart - restore session from backup
   */
  async handleSlotRestarted(slotData) {
    const { slotId, userId } = slotData;
    
    // Attempt to restore session from backup
    const restored = await this.restoreSession(slotId, userId);
    
    if (restored) {
      console.log(`✅ Session restored for slot ${slotId}`);
      this.emit('sessionRestored', { slotId, userId, backup: restored });
    } else {
      console.log(`⚠️ No backup found for slot ${slotId}, starting fresh session`);
      this.emit('sessionRestoreFailed', { slotId, userId });
    }
  }

  /**
   * Handle slot session updated - update session tracking
   */
  async handleSlotSessionUpdated(slotData) {
    const { slotId, sessionId, userId } = slotData;
    
    // Update session tracking
    if (this.activeSessions.has(slotId)) {
      const sessionInfo = this.activeSessions.get(slotId);
      sessionInfo.sessionId = sessionId;
      sessionInfo.userId = userId;
      sessionInfo.lastUpdated = Date.now();
      
      console.log(`📝 Session updated for slot ${slotId}`);
    }
  }

  /**
   * Handle Better Auth session created
   */
  async handleBetterAuthSessionCreated(sessionData) {
    const { sessionId, userId } = sessionData;
    
    // Find associated slots and update session tracking
    for (const [slotId, sessionInfo] of this.activeSessions) {
      if (sessionInfo.userId === userId) {
        sessionInfo.sessionId = sessionId;
        sessionInfo.authSession = sessionData;
        
        // Create initial backup with auth session
        await this.createBackup(slotId, { type: 'auth_session_created' });
        
        break;
      }
    }
  }

  /**
   * Handle Better Auth session refreshed
   */
  async handleBetterAuthSessionRefreshed(sessionData) {
    const { sessionId, userId } = sessionData;
    
    // Update all active sessions for this user
    for (const [slotId, sessionInfo] of this.activeSessions) {
      if (sessionInfo.userId === userId && sessionInfo.sessionId === sessionId) {
        sessionInfo.authSession = sessionData;
        
        // Update backup with refreshed session
        await this.createBackup(slotId, { type: 'auth_session_refreshed' });
      }
    }
  }

  /**
   * Handle Better Auth session expired
   */
  async handleBetterAuthSessionExpired(sessionData) {
    const { sessionId, userId } = sessionData;
    
    // Mark sessions as expired and create backup
    for (const [slotId, sessionInfo] of this.activeSessions) {
      if (sessionInfo.userId === userId && sessionInfo.sessionId === sessionId) {
        sessionInfo.sessionExpired = true;
        
        await this.createBackup(slotId, { type: 'auth_session_expired' });
      }
    }
  }

  /**
   * Create a session backup
   */
  async createBackup(slotId, options = {}) {
    const sessionInfo = this.activeSessions.get(slotId);
    if (!sessionInfo) {
      throw new Error(`No active session found for slot ${slotId}`);
    }

    try {
      // Get current slot state
      const slotState = await this.captureSlotState(slotId);
      
      // Get Better Auth session state if available
      let authSessionState = null;
      if (sessionInfo.authSession && this.betterAuth && this.betterAuth.getSessionInfo) {
        authSessionState = await this.betterAuth.getSessionInfo(sessionInfo.sessionId);
      }

      // Create backup object
      const backup = {
        id: crypto.randomUUID(),
        slotId,
        userId: sessionInfo.userId,
        sessionId: sessionInfo.sessionId,
        timestamp: Date.now(),
        type: options.type || 'periodic',
        
        // Slot state
        slotState,
        
        // Better Auth session state
        authSession: authSessionState,
        
        // Session metadata
        sessionInfo: {
          createdAt: sessionInfo.createdAt,
          lastBackup: sessionInfo.lastBackup,
          backupCount: sessionInfo.backupCount + 1
        },
        
        // Backup metadata
        backupMetadata: {
          reason: options.reason || 'Scheduled backup',
          triggeredBy: options.triggeredBy || 'system'
        }
      };

      // Save backup to storage
      const backupPath = await this.saveBackup(backup);
      
      // Update session tracking
      sessionInfo.lastBackup = Date.now();
      sessionInfo.backupCount++;
      
      // Store backup reference
      this.sessionBackups.set(slotId, backup);
      
      // Cleanup old backups if needed
      await this.cleanupOldBackups(slotId);
      
      console.log(`💾 Session backup created for slot ${slotId}: ${backupPath}`);
      
      this.emit('backupCreated', { slotId, backup, path: backupPath });
      
      return backup;
      
    } catch (error) {
      console.error(`❌ Failed to create backup for slot ${slotId}:`, error);
      this.emit('backupFailed', { slotId, error });
      throw error;
    }
  }

  /**
   * Capture current slot state
   */
  async captureSlotState(slotId) {
    // This would integrate with the slot registry service
    // For now, we'll return a mock structure
    
    return {
      workDirectory: await this.backupWorkDirectory(slotId),
      claudeConfig: await this.exportClaudeConfig(slotId),
      environmentVariables: await this.captureEnvironmentVariables(slotId),
      runningProcesses: await this.captureRunningProcesses(slotId),
      openFiles: await this.captureOpenFiles(slotId),
      networkConnections: await this.captureNetworkConnections(slotId)
    };
  }

  /**
   * Backup work directory
   */
  async backupWorkDirectory(slotId) {
    // Get user's work directory for this slot
    const workDir = `/home/claudebox-users/${slotId}/workspace`;
    
    // Create compressed backup
    const backupPath = path.join(this.backupDirectory, `${slotId}_workdir_${Date.now()}.tar.gz`);
    
    // Use tar to create compressed backup
    await new Promise((resolve, reject) => {
      const tar = require('child_process').spawn('tar', [
        '-czf', backupPath, '-C', workDir, '.'
      ]);
      
      tar.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`tar exited with code ${code}`));
      });
    });
    
    return backupPath;
  }

  /**
   * Export Claude configuration
   */
  async exportClaudeConfig(slotId) {
    const configDir = `/home/claudebox-users/${slotId}/.claude`;
    const configFile = path.join(configDir, 'config.json');
    
    try {
      const configContent = await fs.readFile(configFile, 'utf8');
      return JSON.parse(configContent);
    } catch (error) {
      // Return default config if file doesn't exist
      return {
        model: 'claude-3-sonnet-20240229',
        temperature: 0.7,
        maxTokens: 4000,
        tools: ['filesystem', 'web', 'neo4j']
      };
    }
  }

  /**
   * Capture environment variables
   */
  async captureEnvironmentVariables(slotId) {
    // Get environment variables specific to this slot
    const envVars = {};
    
    // System environment variables
    const systemEnv = ['PATH', 'HOME', 'USER', 'SHELL'];
    for (const env of systemEnv) {
      if (process.env[env]) {
        envVars[env] = process.env[env];
      }
    }
    
    // Slot-specific environment variables
    const slotEnv = {
      'SLOT_ID': slotId,
      'CLAUUDEBOX_SLOT': slotId,
      'WORKSPACE': `/home/claudebox-users/${slotId}/workspace`,
      'NODE_ENV': 'development'
    };
    
    return { ...envVars, ...slotEnv };
  }

  /**
   * Capture running processes
   */
  async captureRunningProcesses(slotId) {
    // This would integrate with PM2 to get running processes for this slot
    // For now, return mock data
    return [
      {
        name: 'claude-process',
        pid: 12345,
        status: 'online',
        cpu: 2.5,
        memory: 512
      }
    ];
  }

  /**
   * Capture open files
   */
  async captureOpenFiles(slotId) {
    // This would use lsof or similar to capture open files
    // For now, return mock data
    return [
      '/workspace/src/app.js',
      '/workspace/package.json',
      '/workspace/README.md'
    ];
  }

  /**
   * Capture network connections
   */
  async captureNetworkConnections(slotId) {
    // This would use netstat or similar to capture network connections
    // For now, return mock data
    return [
      {
        localPort: 3000,
        remoteAddress: '127.0.0.1',
        state: 'ESTABLISHED'
      }
    ];
  }

  /**
   * Save backup to storage
   */
  async saveBackup(backup) {
    const filename = `${backup.slotId}_backup_${backup.id}_${Date.now()}.json`;
    const backupPath = path.join(this.backupDirectory, filename);
    
    await fs.writeFile(backupPath, JSON.stringify(backup, null, 2));
    
    return backupPath;
  }

  /**
   * Restore session from backup
   */
  async restoreSession(slotId, userId) {
    // Find the most recent backup for this slot
    const backup = await this.findLatestBackup(slotId, userId);
    
    if (!backup) {
      return null;
    }

    try {
      // Restore Better Auth session first
      if (backup.authSession && this.betterAuth) {
        await this.restoreBetterAuthSession(backup.authSession);
      }
      
      // Restore work directory
      await this.restoreWorkDirectory(slotId, backup.slotState.workDirectory);
      
      // Restore Claude configuration
      await this.restoreClaudeConfig(slotId, backup.slotState.claudeConfig);
      
      // Restore environment variables
      await this.restoreEnvironmentVariables(slotId, backup.slotState.environmentVariables);
      
      // Restart processes if needed
      await this.restoreProcesses(slotId, backup.slotState.runningProcesses);
      
      // Update session tracking
      if (this.activeSessions.has(slotId)) {
        const sessionInfo = this.activeSessions.get(slotId);
        sessionInfo.sessionId = backup.sessionId;
        sessionInfo.authSession = backup.authSession;
      }
      
      console.log(`✅ Session restored for slot ${slotId} from backup ${backup.id}`);
      
      this.emit('sessionRestored', { slotId, userId, backup });
      
      return backup;
      
    } catch (error) {
      console.error(`❌ Failed to restore session for slot ${slotId}:`, error);
      this.emit('sessionRestoreFailed', { slotId, userId, error });
      throw error;
    }
  }

  /**
   * Restore Better Auth session
   */
  async restoreBetterAuthSession(authSession) {
    if (!this.betterAuth || !this.betterAuth.restoreSession) {
      console.log('⚠️ Better Auth restoreSession not available, skipping session restore');
      return;
    }

    try {
      // Restore session using Better Auth
      await this.betterAuth.restoreSession(authSession);
      
      console.log('✅ Better Auth session restored');
    } catch (error) {
      console.error('❌ Failed to restore Better Auth session:', error);
      // Don't throw error for mock service issues
    }
  }

  /**
   * Restore work directory
   */
  async restoreWorkDirectory(slotId, workDirectoryBackup) {
    const workDir = `/home/claudebox-users/${slotId}/workspace`;
    
    // Ensure directory exists
    await fs.mkdir(workDir, { recursive: true });
    
    // Extract backup
    await new Promise((resolve, reject) => {
      const tar = require('child_process').spawn('tar', [
        '-xzf', workDirectoryBackup, '-C', workDir
      ]);
      
      tar.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`tar exited with code ${code}`));
      });
    });
    
    console.log(`✅ Work directory restored for slot ${slotId}`);
  }

  /**
   * Restore Claude configuration
   */
  async restoreClaudeConfig(slotId, claudeConfig) {
    const configDir = `/home/claudebox-users/${slotId}/.claude`;
    const configFile = path.join(configDir, 'config.json');
    
    await fs.mkdir(configDir, { recursive: true });
    await fs.writeFile(configFile, JSON.stringify(claudeConfig, null, 2));
    
    console.log(`✅ Claude configuration restored for slot ${slotId}`);
  }

  /**
   * Restore environment variables
   */
  async restoreEnvironmentVariables(slotId, environmentVariables) {
    // Environment variables would be set when restarting the slot process
    // For now, just log them
    console.log(`📝 Environment variables for slot ${slotId}:`, Object.keys(environmentVariables));
  }

  /**
   * Restore processes
   */
  async restoreProcesses(slotId, processes) {
    // This would integrate with PM2 to restart processes
    console.log(`🔄 Processes to restore for slot ${slotId}:`, processes.length);
  }

  /**
   * Find latest backup for a slot
   */
  async findLatestBackup(slotId, userId) {
    // Check in-memory backups first
    const backup = this.sessionBackups.get(slotId);
    if (backup && backup.userId === userId) {
      return backup;
    }
    
    // Check filesystem backups
    const backups = await this.listBackups(slotId);
    const userBackups = backups.filter(b => b.userId === userId);
    
    if (userBackups.length === 0) {
      return null;
    }
    
    // Return most recent backup
    return userBackups.sort((a, b) => b.timestamp - a.timestamp)[0];
  }

  /**
   * List all backups for a slot
   */
  async listBackups(slotId) {
    const files = await fs.readdir(this.backupDirectory);
    const slotBackups = [];
    
    for (const file of files) {
      if (file.startsWith(`${slotId}_backup_`) && file.endsWith('.json')) {
        try {
          const content = await fs.readFile(path.join(this.backupDirectory, file), 'utf8');
          const backup = JSON.parse(content);
          slotBackups.push(backup);
        } catch (error) {
          console.warn(`⚠️ Failed to parse backup file ${file}:`, error);
        }
      }
    }
    
    return slotBackups.sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Start periodic backups for a session
   */
  startSessionBackups(slotId) {
    const interval = setInterval(async () => {
      try {
        await this.createBackup(slotId, { type: 'periodic' });
      } catch (error) {
        console.error(`❌ Periodic backup failed for slot ${slotId}:`, error);
      }
    }, this.backupInterval);
    
    this.backupSchedule.set(slotId, interval);
  }

  /**
   * Stop periodic backups for a session
   */
  stopSessionBackups(slotId) {
    const interval = this.backupSchedule.get(slotId);
    if (interval) {
      clearInterval(interval);
      this.backupSchedule.delete(slotId);
    }
  }

  /**
   * Start backup scheduler
   */
  startBackupScheduler() {
    // Schedule already handled by individual session intervals
    console.log('⏰ Backup scheduler started');
  }

  /**
   * Load existing backups from filesystem
   */
  async loadExistingBackups() {
    try {
      const files = await fs.readdir(this.backupDirectory);
      
      for (const file of files) {
        if (file.endsWith('_backup_') && file.endsWith('.json')) {
          try {
            const content = await fs.readFile(path.join(this.backupDirectory, file), 'utf8');
            const backup = JSON.parse(content);
            this.sessionBackups.set(backup.slotId, backup);
          } catch (error) {
            console.warn(`⚠️ Failed to load backup ${file}:`, error);
          }
        }
      }
      
      console.log(`📂 Loaded ${this.sessionBackups.size} existing backups`);
    } catch (error) {
      console.warn('⚠️ Failed to load existing backups:', error);
    }
  }

  /**
   * Cleanup old backups
   */
  async cleanupOldBackups(slotId) {
    const backups = await this.listBackups(slotId);
    
    if (backups.length > this.maxBackups) {
      // Keep only the most recent backups
      const toDelete = backups.slice(this.maxBackups);
      
      for (const backup of toDelete) {
        try {
          const filename = `${backup.slotId}_backup_${backup.id}_${backup.timestamp}.json`;
          await fs.unlink(path.join(this.backupDirectory, filename));
          console.log(`🗑️ Deleted old backup: ${filename}`);
        } catch (error) {
          console.warn(`⚠️ Failed to delete backup:`, error);
        }
      }
    }
  }

  /**
   * Get session persistence statistics
   */
  getStatistics() {
    return {
      activeSessions: this.activeSessions.size,
      totalBackups: this.sessionBackups.size,
      backupScheduleSize: this.backupSchedule.size,
      averageBackupCount: Array.from(this.activeSessions.values())
        .reduce((sum, session) => sum + session.backupCount, 0) / Math.max(this.activeSessions.size, 1)
    };
  }

  /**
   * Shutdown the session persistence manager
   */
  async shutdown() {
    console.log('🛑 Shutting down Session Persistence Manager...');
    
    // Create final backups for all active sessions
    for (const [slotId] of this.activeSessions) {
      try {
        await this.createBackup(slotId, { type: 'shutdown' });
      } catch (error) {
        console.error(`❌ Final backup failed for slot ${slotId}:`, error);
      }
    }
    
    // Stop all backup schedules
    for (const [slotId, interval] of this.backupSchedule) {
      clearInterval(interval);
    }
    
    // Clear data structures
    this.activeSessions.clear();
    this.backupSchedule.clear();
    this.sessionBackups.clear();
    
    console.log('✅ Session Persistence Manager shutdown complete');
  }
}

export default SessionPersistenceManager;