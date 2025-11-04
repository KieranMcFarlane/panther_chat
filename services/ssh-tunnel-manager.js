/**
 * SSH Tunnel Management Service
 * 
 * Manages persistent SSH tunnels for EC2 connectivity with auto-reconnect capabilities
 * Implements TICKET-003 acceptance criteria
 */

import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import { EventEmitter } from 'events';

const execAsync = promisify(exec);

class SSHTunnelManager extends EventEmitter {
  constructor(config = {}) {
    super();
    
    // Configuration with defaults
    this.config = {
      host: config.host || process.env.SSH_HOST || '13.60.60.50',
      port: config.port || process.env.SSH_PORT || 22,
      keyPath: config.keyPath || process.env.SSH_KEY_PATH || '/home/ec2-user/yellowpanther.pem',
      user: config.user || process.env.SSH_USER || 'ec2-user',
      localPortRange: {
        start: config.localPortStart || 9000,
        end: config.localPortEnd || 9500
      },
      reconnectDelay: config.reconnectDelay || 5000,
      maxReconnectAttempts: config.maxReconnectAttempts || 10,
      healthCheckInterval: config.healthCheckInterval || 30000,
      ...config
    };
    
    this.tunnels = new Map();
    this.healthCheckTimer = null;
    this.isInitialized = false;
    this.reconnectAttempts = new Map();
    this.usedPorts = new Set();
    
    // Bind methods
    this.createTunnel = this.createTunnel.bind(this);
    this.closeTunnel = this.closeTunnel.bind(this);
    this.startHealthMonitoring = this.startHealthMonitoring.bind(this);
    this.stopHealthMonitoring = this.stopHealthMonitoring.bind(this);
    this.handleTunnelExit = this.handleTunnelExit.bind(this);
    this.reconnectTunnel = this.reconnectTunnel.bind(this);
    
    console.log('🚇 SSH Tunnel Manager initialized with config:', {
      host: this.config.host,
      port: this.config.port,
      keyPath: this.config.keyPath,
      user: this.config.user,
      localPortRange: this.config.localPortRange
    });
  }
  
  async initialize() {
    try {
      console.log('🔧 Initializing SSH Tunnel Manager...');
      
      // Validate SSH key exists and has proper permissions
      await this.validateSSHKey();
      
      // Start health monitoring
      this.startHealthMonitoring();
      
      this.isInitialized = true;
      console.log('✅ SSH Tunnel Manager initialized successfully');
      
      this.emit('initialized', { success: true });
      return true;
      
    } catch (error) {
      console.error('❌ Failed to initialize SSH Tunnel Manager:', error);
      this.emit('initialized', { success: false, error: error.message });
      return false;
    }
  }
  
  async validateSSHKey() {
    try {
      // Check if we're in development/testing mode
      if (process.env.NODE_ENV === 'development' || process.env.TEST_MODE) {
        console.log('🧪 Development mode detected - skipping SSH key validation');
        return true;
      }
      
      // Check if key file exists
      await fs.access(this.config.keyPath);
      console.log('✅ SSH key file exists:', this.config.keyPath);
      
      // Check key permissions (should be 400 or 600)
      const stats = await fs.stat(this.config.keyPath);
      const permissions = stats.mode & 0o777;
      
      if (permissions !== 0o400 && permissions !== 0o600) {
        console.warn('⚠️ SSH key permissions should be 400 or 600');
        // Try to fix permissions
        try {
          await execAsync(`chmod 600 "${this.config.keyPath}"`);
          console.log('✅ Fixed SSH key permissions to 600');
        } catch (permError) {
          console.warn('⚠️ Could not fix SSH key permissions:', permError.message);
        }
      } else {
        console.log('✅ SSH key permissions are correct:', permissions.toString(8));
      }
      
      return true;
    } catch (error) {
      // In development mode, we can proceed without real SSH key
      if (process.env.NODE_ENV === 'development' || process.env.TEST_MODE) {
        console.log('🧪 Development mode - proceeding without SSH key');
        return true;
      }
      throw new Error(`SSH key validation failed: ${error.message}`);
    }
  }
  
  async createTunnel(slotId, localPort, remotePort, options = {}) {
    try {
      if (!this.isInitialized) {
        throw new Error('SSH Tunnel Manager not initialized');
      }
      
      // Check if tunnel already exists
      if (this.tunnels.has(slotId)) {
        console.log(`⚠️ Tunnel for slot ${slotId} already exists`);
        return this.tunnels.get(slotId);
      }
      
      // Auto-allocate local port if not provided
      if (!localPort) {
        localPort = this.allocateLocalPort();
      }
      
      // Set default remote port if not provided
      if (!remotePort) {
        remotePort = 22; // Default SSH port
      }
      
      // Check if local port is available
      if (this.usedPorts.has(localPort)) {
        throw new Error(`Local port ${localPort} is already in use`);
      }
      
      console.log(`🔧 Creating SSH tunnel for slot ${slotId}: ${localPort}:${this.config.host}:${remotePort}`);
      
      // Build SSH command
      const sshArgs = [
        '-i', this.config.keyPath,
        '-o', 'StrictHostKeyChecking=no',
        '-o', 'UserKnownHostsFile=/dev/null',
        '-o', 'ServerAliveInterval=30',
        '-o', 'ServerAliveCountMax=3',
        '-o', 'ExitOnForwardFailure=yes',
        '-N', // No command execution
        '-L', `${localPort}:localhost:${remotePort}`,
        '-p', this.config.port.toString(),
        `${this.config.user}@${this.config.host}`
      ];
      
      // Create SSH process
      let tunnelProcess;
      
      if (process.env.NODE_ENV === 'development' || process.env.TEST_MODE) {
        // Mock SSH process for testing
        tunnelProcess = {
          killed: false,
          stdout: { on: () => {} },
          stderr: { on: () => {} },
          on: (event, callback) => {
            if (event === 'exit') {
              // Simulate process exit after some time for testing
              setTimeout(() => {
                if (!tunnelProcess.killed) {
                  callback(0, null);
                }
              }, 30000); // Exit after 30 seconds for testing
            }
          },
          kill: (signal) => {
            console.log(`🧪 Mock SSH process killed with signal: ${signal}`);
            tunnelProcess.killed = true;
          }
        };
        console.log('🧪 Created mock SSH process for testing');
      } else {
        // Create real SSH process
        tunnelProcess = spawn('ssh', sshArgs, {
          stdio: ['ignore', 'pipe', 'pipe']
        });
      }
      
      const tunnel = {
        slotId,
        localPort,
        remotePort,
        process: tunnelProcess,
        status: 'connecting',
        createdAt: new Date(),
        lastActivity: new Date(),
        options: { ...options }
      };
      
      // Set up process event handlers
      tunnelProcess.on('exit', (code, signal) => {
        this.handleTunnelExit(slotId, code, signal);
      });
      
      tunnelProcess.on('error', (error) => {
        console.error(`❌ SSH tunnel error for slot ${slotId}:`, error);
        this.emit('tunnelError', { slotId, error: error.message });
      });
      
      // Wait for tunnel to establish
      const established = await this.waitForTunnelEstablishment(tunnel);
      
      if (established) {
        tunnel.status = 'active';
        this.tunnels.set(slotId, tunnel);
        this.usedPorts.add(localPort);
        this.reconnectAttempts.set(slotId, 0);
        
        console.log(`✅ SSH tunnel established for slot ${slotId}: ${localPort} -> ${remotePort}`);
        this.emit('tunnelCreated', { slotId, localPort, remotePort, status: 'active' });
        
        return tunnel;
      } else {
        throw new Error('Failed to establish SSH tunnel');
      }
      
    } catch (error) {
      console.error(`❌ Failed to create SSH tunnel for slot ${slotId}:`, error);
      this.emit('tunnelError', { slotId, error: error.message });
      throw error;
    }
  }
  
  async waitForTunnelEstablishment(tunnel, timeout = 10000) {
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        resolve(false);
      }, timeout);
      
      // Check if process is still running after a short delay
      setTimeout(() => {
        if (tunnel.process && !tunnel.process.killed) {
          clearTimeout(timer);
          resolve(true);
        } else {
          clearTimeout(timer);
          resolve(false);
        }
      }, 2000);
    });
  }
  
  allocateLocalPort() {
    const { start, end } = this.config.localPortRange;
    
    for (let port = start; port <= end; port++) {
      if (!this.usedPorts.has(port)) {
        return port;
      }
    }
    
    throw new Error('No available local ports in range');
  }
  
  async closeTunnel(slotId) {
    try {
      const tunnel = this.tunnels.get(slotId);
      
      if (!tunnel) {
        console.log(`⚠️ No tunnel found for slot ${slotId}`);
        return false;
      }
      
      console.log(`🔧 Closing SSH tunnel for slot ${slotId}`);
      
      // Kill the SSH process
      if (tunnel.process && !tunnel.process.killed) {
        tunnel.process.kill('SIGTERM');
        
        // Wait for graceful shutdown
        await new Promise((resolve) => {
          setTimeout(resolve, 2000);
        });
        
        // Force kill if still running
        if (!tunnel.process.killed) {
          tunnel.process.kill('SIGKILL');
        }
      }
      
      // Clean up
      this.tunnels.delete(slotId);
      this.usedPorts.delete(tunnel.localPort);
      this.reconnectAttempts.delete(slotId);
      
      console.log(`✅ SSH tunnel closed for slot ${slotId}`);
      this.emit('tunnelClosed', { slotId });
      
      return true;
      
    } catch (error) {
      console.error(`❌ Failed to close SSH tunnel for slot ${slotId}:`, error);
      this.emit('tunnelError', { slotId, error: error.message });
      throw error;
    }
  }
  
  handleTunnelExit(slotId, code, signal) {
    const tunnel = this.tunnels.get(slotId);
    
    if (!tunnel) {
      return;
    }
    
    console.log(`📡 SSH tunnel for slot ${slotId} exited: code=${code}, signal=${signal}`);
    
    // Clean up port allocation
    this.usedPorts.delete(tunnel.localPort);
    
    // Update tunnel status
    tunnel.status = 'disconnected';
    tunnel.process = null;
    
    this.emit('tunnelDisconnected', { slotId, code, signal });
    
    // Auto-reconnect if not manually closed
    if (code !== 0 && signal !== 'SIGTERM') {
      this.reconnectTunnel(slotId);
    }
  }
  
  async reconnectTunnel(slotId) {
    const tunnel = this.tunnels.get(slotId);
    
    if (!tunnel) {
      return;
    }
    
    const attempts = this.reconnectAttempts.get(slotId) || 0;
    
    if (attempts >= this.config.maxReconnectAttempts) {
      console.error(`❌ Max reconnection attempts reached for slot ${slotId}`);
      this.emit('tunnelError', { 
        slotId, 
        error: `Max reconnection attempts (${this.config.maxReconnectAttempts}) reached` 
      });
      return;
    }
    
    this.reconnectAttempts.set(slotId, attempts + 1);
    
    console.log(`🔄 Reconnecting SSH tunnel for slot ${slotId} (attempt ${attempts + 1}/${this.config.maxReconnectAttempts})`);
    
    // Wait before reconnecting
    await new Promise((resolve) => {
      setTimeout(resolve, this.config.reconnectDelay);
    });
    
    try {
      // Remove old tunnel
      this.tunnels.delete(slotId);
      
      // Create new tunnel
      await this.createTunnel(slotId, tunnel.localPort, tunnel.remotePort, tunnel.options);
      
      // Reset attempts on successful reconnect
      this.reconnectAttempts.set(slotId, 0);
      
      this.emit('tunnelReconnected', { slotId });
      
    } catch (error) {
      console.error(`❌ Failed to reconnect tunnel for slot ${slotId}:`, error);
      
      // Schedule another attempt
      setTimeout(() => {
        this.reconnectTunnel(slotId);
      }, this.config.reconnectDelay);
    }
  }
  
  startHealthMonitoring() {
    if (this.healthCheckTimer) {
      return;
    }
    
    console.log('🏥 Starting SSH tunnel health monitoring...');
    
    this.healthCheckTimer = setInterval(() => {
      this.checkTunnelHealth();
    }, this.config.healthCheckInterval);
    
    // Initial health check
    this.checkTunnelHealth();
  }
  
  stopHealthMonitoring() {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
      console.log('🛑 SSH tunnel health monitoring stopped');
    }
  }
  
  async checkTunnelHealth() {
    const healthResults = [];
    
    for (const [slotId, tunnel] of this.tunnels) {
      try {
        const isHealthy = await this.isTunnelHealthy(tunnel);
        
        if (!isHealthy) {
          console.warn(`⚠️ SSH tunnel for slot ${slotId} is unhealthy`);
          
          if (tunnel.status === 'active') {
            tunnel.status = 'unhealthy';
            this.emit('tunnelUnhealthy', { slotId });
            
            // Trigger reconnection
            this.reconnectTunnel(slotId);
          }
        } else {
          if (tunnel.status === 'unhealthy') {
            tunnel.status = 'active';
            this.emit('tunnelHealthy', { slotId });
          }
        }
        
        healthResults.push({ slotId, status: isHealthy ? 'healthy' : 'unhealthy' });
        
      } catch (error) {
        console.error(`❌ Health check failed for slot ${slotId}:`, error);
        healthResults.push({ slotId, status: 'error', error: error.message });
      }
    }
    
    return healthResults;
  }
  
  async isTunnelHealthy(tunnel) {
    try {
      // Check if process is still running
      if (!tunnel.process || tunnel.process.killed) {
        return false;
      }
      
      // In test mode, assume tunnel is healthy
      if (process.env.NODE_ENV === 'development' || process.env.TEST_MODE) {
        return true;
      }
      
      // Try to connect to local port
      const result = await execAsync(`nc -z localhost ${tunnel.localPort}`, {
        timeout: 5000
      });
      
      return true;
      
    } catch (error) {
      return false;
    }
  }
  
  getTunnelStatus(slotId) {
    const tunnel = this.tunnels.get(slotId);
    
    if (!tunnel) {
      return null;
    }
    
    return {
      slotId,
      localPort: tunnel.localPort,
      remotePort: tunnel.remotePort,
      status: tunnel.status,
      createdAt: tunnel.createdAt,
      lastActivity: tunnel.lastActivity,
      reconnectAttempts: this.reconnectAttempts.get(slotId) || 0
    };
  }
  
  getAllTunnelStatuses() {
    const statuses = [];
    
    for (const [slotId, tunnel] of this.tunnels) {
      statuses.push(this.getTunnelStatus(slotId));
    }
    
    return statuses;
  }
  
  getStats() {
    return {
      totalTunnels: this.tunnels.size,
      activeTunnels: Array.from(this.tunnels.values()).filter(t => t.status === 'active').length,
      usedPorts: this.usedPorts.size,
      availablePorts: (this.config.localPortRange.end - this.config.localPortRange.start + 1) - this.usedPorts.size,
      reconnectAttempts: Object.fromEntries(this.reconnectAttempts)
    };
  }
  
  async shutdown() {
    console.log('🛑 Shutting down SSH Tunnel Manager...');
    
    // Stop health monitoring
    this.stopHealthMonitoring();
    
    // Close all tunnels
    const closePromises = Array.from(this.tunnels.keys()).map(slotId => 
      this.closeTunnel(slotId).catch(error => {
        console.error(`❌ Error closing tunnel for slot ${slotId}:`, error);
      })
    );
    
    await Promise.all(closePromises);
    
    this.isInitialized = false;
    console.log('✅ SSH Tunnel Manager shutdown complete');
  }
}

export default SSHTunnelManager;