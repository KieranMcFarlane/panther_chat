/**
 * TTYD Service Integration
 * 
 * Provides terminal access through SSH tunnels with authentication and session management
 * Implements TICKET-004 acceptance criteria
 */

import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import { EventEmitter } from 'events';
import crypto from 'crypto';
import SSHTunnelManager from './ssh-tunnel-manager.js';

const execAsync = promisify(exec);

class TTYDService extends EventEmitter {
  constructor(config = {}) {
    super();
    
    // Configuration with defaults
    this.config = {
      ttydPath: config.ttydPath || process.env.TTYD_PATH || 'ttyd',
      sessionTimeout: config.sessionTimeout || parseInt(process.env.TTYD_SESSION_TIMEOUT) || 1800000, // 30 minutes
      maxSessions: config.maxSessions || parseInt(process.env.TTYD_MAX_SESSIONS) || 10,
      basePort: config.basePort || parseInt(process.env.TTYD_BASE_PORT) || 7000,
      sshTunnelConfig: config.sshTunnelConfig || {},
      enableAuth: config.enableAuth !== false,
      enableSSL: config.enableSSL !== false,
      ...config
    };
    
    this.sessions = new Map();
    this.usedPorts = new Set();
    this.ttydProcesses = new Map();
    this.tunnelManager = new SSHTunnelManager(this.config.sshTunnelConfig);
    this.sessionCleanupTimer = null;
    this.isInitialized = false;
    
    // Bind methods
    this.createSession = this.createSession.bind(this);
    this.terminateSession = this.terminateSession.bind(this);
    this.startSessionCleanup = this.startSessionCleanup.bind(this);
    this.handleTTYDExit = this.handleTTYDExit.bind(this);
    
    // Set up tunnel event listeners
    this.tunnelManager.on('tunnelCreated', (data) => {
      this.emit('tunnelCreated', data);
    });
    
    this.tunnelManager.on('tunnelError', (data) => {
      this.emit('tunnelError', data);
    });
    
    this.tunnelManager.on('tunnelDisconnected', (data) => {
      this.emit('tunnelDisconnected', data);
    });
    
    this.tunnelManager.on('tunnelReconnected', (data) => {
      this.emit('tunnelReconnected', data);
    });
    
    console.log('💻 TTYD Service initialized with config:', {
      sessionTimeout: this.config.sessionTimeout,
      maxSessions: this.config.maxSessions,
      basePort: this.config.basePort,
      enableAuth: this.config.enableAuth,
      enableSSL: this.config.enableSSL
    });
  }
  
  async initialize() {
    try {
      console.log('🔧 Initializing TTYD Service...');
      
      // Check if ttyd is available
      if (!process.env.TEST_MODE) {
        await this.checkTTYDAvailability();
      }
      
      // Initialize SSH tunnel manager
      const tunnelInitialized = await this.tunnelManager.initialize();
      if (!tunnelInitialized) {
        throw new Error('Failed to initialize SSH tunnel manager');
      }
      
      // Start session cleanup
      this.startSessionCleanup();
      
      this.isInitialized = true;
      console.log('✅ TTYD Service initialized successfully');
      
      this.emit('initialized', { success: true });
      return true;
      
    } catch (error) {
      console.error('❌ Failed to initialize TTYD Service:', error);
      this.emit('initialized', { success: false, error: error.message });
      return false;
    }
  }
  
  async checkTTYDAvailability() {
    try {
      console.log('🔍 Checking TTYD availability...');
      
      const result = await execAsync('which ttyd', { timeout: 5000 });
      if (!result.stdout.trim()) {
        throw new Error('ttyd not found in PATH');
      }
      
      // Check ttyd version
      const versionResult = await execAsync('ttyd --version', { timeout: 5000 });
      console.log('✅ TTYD is available:', versionResult.stdout.trim());
      
      return true;
      
    } catch (error) {
      if (process.env.NODE_ENV === 'development' || process.env.TEST_MODE) {
        console.log('🧪 Development mode - proceeding without real ttyd');
        return true;
      }
      throw new Error(`TTYD availability check failed: ${error.message}`);
    }
  }
  
  async createSession(userId, options = {}) {
    try {
      if (!this.isInitialized) {
        throw new Error('TTYD Service not initialized');
      }
      
      // Check session limit (only count active sessions)
      const activeSessions = Array.from(this.sessions.values()).filter(s => s.status === 'active').length;
      if (activeSessions >= this.config.maxSessions) {
        throw new Error('Maximum session limit reached');
      }
      
      // Check if user already has active session
      const existingSession = this.getUserSession(userId);
      if (existingSession) {
        console.log(`🔄 User ${userId} already has active session ${existingSession.sessionId}`);
        return existingSession;
      }
      
      // Generate session ID
      const sessionId = this.generateSessionId();
      
      // Allocate TTYD port
      const ttydPort = this.allocateTTYDPort();
      
      // Create SSH tunnel for this session
      const sshTunnelPort = options.sshPort || 22;
      const tunnel = await this.tunnelManager.createTunnel(sessionId, null, sshTunnelPort);
      
      console.log(`🔧 Creating TTYD session ${sessionId} for user ${userId}`);
      
      // Build TTYD command
      const ttydArgs = [
        '-p', ttydPort.toString(),
        '-t', this.config.sessionTimeout.toString(),
        '-a', '127.0.0.1',
        '-W'  // Enable WebSockets
      ];
      
      // Add SSL if enabled
      if (this.config.enableSSL) {
        ttydArgs.push('--ssl');
        ttydArgs.push('--ssl-cert', '/path/to/cert.pem');
        ttydArgs.push('--ssl-key', '/path/to/key.pem');
      }
      
      // Add authentication if enabled
      if (this.config.enableAuth) {
        const authToken = this.generateAuthToken(sessionId, userId);
        ttydArgs.push('-c', authToken);
      }
      
      // Add command to connect through SSH tunnel
      ttydArgs.push('ssh', '-p', tunnel.localPort.toString());
      ttydArgs.push('-o', 'StrictHostKeyChecking=no');
      ttydArgs.push(`${this.config.sshTunnelConfig.user || 'ec2-user'}@localhost`);
      
      // Create TTYD process
      let ttydProcess;
      
      if (process.env.NODE_ENV === 'development' || process.env.TEST_MODE) {
        // Mock TTYD process for testing
        ttydProcess = {
          killed: false,
          stdout: { on: () => {} },
          stderr: { on: () => {} },
          on: (event, callback) => {
            if (event === 'exit') {
              // Simulate process exit after session timeout
              setTimeout(() => {
                if (!ttydProcess.killed) {
                  callback(0, null);
                }
              }, this.config.sessionTimeout);
            }
          },
          kill: (signal) => {
            console.log(`🧪 Mock TTYD process killed with signal: ${signal}`);
            ttydProcess.killed = true;
          }
        };
        console.log('🧪 Created mock TTYD process for testing');
      } else {
        // Create real TTYD process
        ttydProcess = spawn(this.config.ttydPath, ttydArgs, {
          stdio: ['ignore', 'pipe', 'pipe']
        });
      }
      
      const session = {
        sessionId,
        userId,
        ttydPort,
        ttydProcess,
        tunnel,
        status: 'starting',
        createdAt: new Date(),
        lastActivity: new Date(),
        options: { ...options }
      };
      
      // Set up process event handlers
      ttydProcess.on('exit', (code, signal) => {
        this.handleTTYDExit(sessionId, code, signal);
      });
      
      ttydProcess.on('error', (error) => {
        console.error(`❌ TTYD process error for session ${sessionId}:`, error);
        this.emit('sessionError', { sessionId, error: error.message });
      });
      
      // Wait for TTYD to start
      const started = await this.waitForTTYDStart(session);
      
      if (started) {
        session.status = 'active';
        this.sessions.set(sessionId, session);
        this.ttydProcesses.set(sessionId, ttydProcess);
        
        console.log(`✅ TTYD session ${sessionId} started for user ${userId} on port ${ttydPort}`);
        
        this.emit('sessionCreated', {
          sessionId,
          userId,
          ttydPort,
          status: 'active',
          accessUrl: this.getAccessUrl(session)
        });
        
        return session;
      } else {
        throw new Error('Failed to start TTYD session');
      }
      
    } catch (error) {
      console.error(`❌ Failed to create TTYD session for user ${userId}:`, error);
      this.emit('sessionError', { userId, error: error.message });
      throw error;
    }
  }
  
  async waitForTTYDStart(session, timeout = 10000) {
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        resolve(false);
      }, timeout);
      
      // Check if process is still running after a short delay
      setTimeout(() => {
        if (session.ttydProcess && !session.ttydProcess.killed) {
          clearTimeout(timer);
          resolve(true);
        } else {
          clearTimeout(timer);
          resolve(false);
        }
      }, 2000);
    });
  }
  
  allocateTTYDPort() {
    const startPort = this.config.basePort;
    
    for (let port = startPort; port < startPort + this.config.maxSessions; port++) {
      if (!this.usedPorts.has(port)) {
        this.usedPorts.add(port);
        return port;
      }
    }
    
    throw new Error('No available TTYD ports');
  }
  
  generateSessionId() {
    return `ttyd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  generateAuthToken(sessionId, userId) {
    const timestamp = Date.now();
    const data = `${sessionId}:${userId}:${timestamp}`;
    return crypto.createHash('sha256').update(data).digest('hex');
  }
  
  getAccessUrl(session) {
    const protocol = this.config.enableSSL ? 'https' : 'http';
    const host = process.env.TTYD_HOST || 'localhost';
    const port = session.ttydPort;
    
    let url = `${protocol}://${host}:${port}`;
    
    if (this.config.enableAuth) {
      const token = this.generateAuthToken(session.sessionId, session.userId);
      url += `?token=${token}`;
    }
    
    return url;
  }
  
  getUserSession(userId) {
    for (const [sessionId, session] of this.sessions) {
      if (session.userId === userId && session.status === 'active') {
        return session;
      }
    }
    return null;
  }
  
  getSession(sessionId) {
    return this.sessions.get(sessionId);
  }
  
  async terminateSession(sessionId, reason = 'manual') {
    try {
      const session = this.sessions.get(sessionId);
      
      if (!session) {
        console.log(`⚠️ No session found with ID ${sessionId}`);
        return false;
      }
      
      console.log(`🔧 Terminating TTYD session ${sessionId} (${reason})`);
      
      // Kill TTYD process
      if (session.ttydProcess && !session.ttydProcess.killed) {
        session.ttydProcess.kill('SIGTERM');
        
        // Wait for graceful shutdown
        await new Promise((resolve) => {
          setTimeout(resolve, 2000);
        });
        
        // Force kill if still running
        if (!session.ttydProcess.killed) {
          session.ttydProcess.kill('SIGKILL');
        }
      }
      
      // Close SSH tunnel
      if (session.tunnel) {
        await this.tunnelManager.closeTunnel(sessionId);
      }
      
      // Clean up
      this.sessions.delete(sessionId);
      this.ttydProcesses.delete(sessionId);
      this.usedPorts.delete(session.ttydPort);
      
      session.status = 'terminated';
      session.terminatedAt = new Date();
      session.terminationReason = reason;
      
      console.log(`✅ TTYD session ${sessionId} terminated (${reason})`);
      this.emit('sessionTerminated', { sessionId, reason, session });
      
      return true;
      
    } catch (error) {
      console.error(`❌ Failed to terminate TTYD session ${sessionId}:`, error);
      this.emit('sessionError', { sessionId, error: error.message });
      throw error;
    }
  }
  
  handleTTYDExit(sessionId, code, signal) {
    const session = this.sessions.get(sessionId);
    
    if (!session) {
      return;
    }
    
    console.log(`📡 TTYD session ${sessionId} exited: code=${code}, signal=${signal}`);
    
    // Clean up
    this.ttydProcesses.delete(sessionId);
    this.usedPorts.delete(session.ttydPort);
    
    // Update session status
    session.status = 'exited';
    session.exitedAt = new Date();
    session.exitCode = code;
    session.exitSignal = signal;
    
    this.emit('sessionExited', { sessionId, code, signal, session });
    
    // Close SSH tunnel
    if (session.tunnel) {
      this.tunnelManager.closeTunnel(sessionId).catch(error => {
        console.error(`❌ Error closing tunnel for session ${sessionId}:`, error);
      });
    }
    
    // Remove session from sessions map
    this.sessions.delete(sessionId);
  }
  
  startSessionCleanup() {
    if (this.sessionCleanupTimer) {
      return;
    }
    
    console.log('🧹 Starting TTYD session cleanup...');
    
    this.sessionCleanupTimer = setInterval(() => {
      this.cleanupExpiredSessions();
    }, 60000); // Check every minute
    
    // Initial cleanup
    this.cleanupExpiredSessions();
  }
  
  cleanupExpiredSessions() {
    const now = Date.now();
    const expiredSessions = [];
    
    for (const [sessionId, session] of this.sessions) {
      const inactiveTime = now - session.lastActivity.getTime();
      
      if (inactiveTime > this.config.sessionTimeout) {
        expiredSessions.push(sessionId);
      }
    }
    
    for (const sessionId of expiredSessions) {
      console.log(`⏰ Session ${sessionId} expired due to inactivity`);
      this.terminateSession(sessionId, 'timeout').catch(error => {
        console.error(`❌ Error cleaning up expired session ${sessionId}:`, error);
      });
    }
  }
  
  updateSessionActivity(sessionId) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastActivity = new Date();
      this.emit('sessionActivity', { sessionId, userId: session.userId });
    }
  }
  
  getSessionStatus(sessionId) {
    const session = this.sessions.get(sessionId);
    
    if (!session) {
      return null;
    }
    
    const tunnelStatus = this.tunnelManager.getTunnelStatus(sessionId);
    
    return {
      sessionId,
      userId: session.userId,
      ttydPort: session.ttydPort,
      status: session.status,
      createdAt: session.createdAt,
      lastActivity: session.lastActivity,
      accessUrl: session.status === 'active' ? this.getAccessUrl(session) : null,
      tunnel: tunnelStatus,
      inactiveTime: Date.now() - session.lastActivity.getTime()
    };
  }
  
  getAllSessionStatuses() {
    const statuses = [];
    
    for (const [sessionId, session] of this.sessions) {
      statuses.push(this.getSessionStatus(sessionId));
    }
    
    return statuses;
  }
  
  getStats() {
    const activeSessions = Array.from(this.sessions.values()).filter(s => s.status === 'active').length;
    return {
      totalSessions: this.sessions.size,
      activeSessions: activeSessions,
      usedPorts: this.usedPorts.size,
      availablePorts: this.config.maxSessions - this.usedPorts.size,
      maxSessions: this.config.maxSessions,
      sessionTimeout: this.config.sessionTimeout,
      tunnelStats: this.tunnelManager.getStats()
    };
  }
  
  async shutdown() {
    console.log('🛑 Shutting down TTYD Service...');
    
    // Stop session cleanup
    if (this.sessionCleanupTimer) {
      clearInterval(this.sessionCleanupTimer);
      this.sessionCleanupTimer = null;
    }
    
    // Terminate all sessions
    const terminatePromises = Array.from(this.sessions.keys()).map(sessionId => 
      this.terminateSession(sessionId, 'shutdown').catch(error => {
        console.error(`❌ Error terminating session ${sessionId}:`, error);
      })
    );
    
    await Promise.all(terminatePromises);
    
    // Shutdown tunnel manager
    await this.tunnelManager.shutdown();
    
    this.isInitialized = false;
    console.log('✅ TTYD Service shutdown complete');
  }
}

export default TTYDService;