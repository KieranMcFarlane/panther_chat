/**
 * 🎰 Slot Registry & State Management Service
 * 
 * Implements intelligent slot allocation, load balancing, and state management
 * for the ClaudeBox Multi-Slot architecture (TICKET-007)
 * 
 * Features:
 * - Automatic slot assignment for users
 * - Load balancing across available slots  
 * - Resource usage monitoring
 * - Slot cleanup and recycling
 * - State persistence and recovery
 */

import EventEmitter from 'events';
import { v4 as uuidv4 } from 'uuid';

class SlotRegistryService extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      // Slot allocation settings
      maxSlots: 50,                           // Maximum concurrent slots
      defaultSlotTimeout: 1800000,            // Default slot timeout (30 minutes)
      idleTimeout: 900000,                    // Idle timeout (15 minutes)
      
      // Load balancing settings
      loadBalancing: {
        strategy: 'least-connections',         // 'least-connections', 'round-robin', 'resource-based'
        maxSlotsPerUser: 3,                   // Maximum slots per user
        preferReuse: true,                    // Prefer reusing existing slots
        healthCheckInterval: 30000,           // Health check interval
        failedSlotThreshold: 3,               // Failed slot attempts before blacklist
      },
      
      // Resource limits and monitoring
      resourceLimits: {
        maxMemoryPerSlot: 512,                // MB per slot
        maxCpuPerSlot: 50,                    // CPU percentage per slot
        maxDiskPerSlot: 1024,                 // MB per slot
        maxNetworkConnections: 100,           // Connections per slot
        maxConcurrentOperations: 10          // Concurrent operations per slot
      },
      
      // Cleanup and recycling
      cleanup: {
        interval: 300000,                     // Cleanup interval (5 minutes)
        maxAge: 86400000,                     // Maximum slot age (24 hours)
        zombieTimeout: 600000,                // Zombie slot timeout (10 minutes)
        enableAutoRecycling: true,            // Enable automatic slot recycling
        retentionPeriod: 604800000           // Retention period for metrics (7 days)
      },
      
      // Persistence settings
      storage: {
        type: 'file',                         // 'file' or 'memory'
        dataDirectory: './data/slots',
        backupInterval: 3600000,              // Backup interval (1 hour)
        compression: true                     // Enable compression
      },
      
      ...config
    };
    
    // Core registry data structures
    this.slotRegistry = new Map();             // Slot registry: slotId -> Slot
    this.userSlots = new Map();               // User slots: userId -> Set<slotId>
    this.availableSlots = new Set();          // Available slots pool
    this.assignedSlots = new Set();          // Assigned slots
    this.blacklistedSlots = new Set();        // Blacklisted (failed) slots
    this.resourceMetrics = new Map();         // Resource usage metrics
    this.allocationHistory = [];              // Allocation history for analytics
    
    // Load balancing state
    this.loadBalancer = {
      currentStrategy: this.config.loadBalancing.strategy,
      slotWeights: new Map(),                // Slot weights for weighted strategies
      connectionCounts: new Map(),            // Active connections per slot
      lastUsed: new Map(),                   // Last used timestamp per slot
      healthStatus: new Map()                 // Health status per slot
    };
    
    // Service references
    this.authService = null;
    this.slotManager = null;
    this.userService = null;
    
    // Internal state
    this.isInitialized = false;
    this.isRunning = false;
    this.startTime = null;
    this.metrics = {
      totalAllocations: 0,
      totalDeallocations: 0,
      failedAllocations: 0,
      currentLoad: 0,
      averageResponseTime: 0
    };
    
    // Timers
    this.healthCheckTimer = null;
    this.cleanupTimer = null;
    this.backupTimer = null;
  }
  
  /**
   * Initialize the Slot Registry Service
   */
  async initialize() {
    try {
      console.log('🎰 Initializing Slot Registry & State Management Service...');
      
      // Initialize storage
      await this.initializeStorage();
      
      // Load existing state
      await this.loadRegistryState();
      
      // Initialize load balancer
      this.initializeLoadBalancer();
      
      // Start background processes
      this.startBackgroundProcesses();
      
      this.isInitialized = true;
      this.startTime = Date.now();
      
      console.log('✅ Slot Registry & State Management Service initialized successfully');
      this.emit('initialized', {
        timestamp: new Date(),
        config: this.config,
        registrySize: this.slotRegistry.size,
        availableSlots: this.availableSlots.size
      });
      
    } catch (error) {
      console.error('❌ Failed to initialize Slot Registry Service:', error);
      throw error;
    }
  }
  
  /**
   * Initialize storage backend
   */
  async initializeStorage() {
    if (this.config.storage.type === 'file') {
      const fs = await import('fs');
      const path = await import('path');
      
      // Ensure data directory exists
      if (!fs.existsSync(this.config.storage.dataDirectory)) {
        fs.mkdirSync(this.config.storage.dataDirectory, { recursive: true });
      }
      
      this.storagePath = path.join(this.config.storage.dataDirectory, 'slot-registry.json');
    }
  }
  
  /**
   * Initialize load balancer
   */
  initializeLoadBalancer() {
    this.loadBalancer.currentStrategy = this.config.loadBalancing.strategy;
    
    // Initialize slot weights for resource-based balancing
    this.slotRegistry.forEach((slot, slotId) => {
      this.updateSlotWeight(slotId);
    });
  }
  
  /**
   * Start background processes
   */
  startBackgroundProcesses() {
    // Health check timer
    this.healthCheckTimer = setInterval(() => {
      this.performHealthChecks();
    }, this.config.loadBalancing.healthCheckInterval);
    
    // Cleanup timer
    this.cleanupTimer = setInterval(() => {
      this.performCleanup();
    }, this.config.cleanup.interval);
    
    // Backup timer
    if (this.config.storage.backupInterval > 0) {
      this.backupTimer = setInterval(() => {
        this.backupRegistryState();
      }, this.config.storage.backupInterval);
    }
  }
  
  /**
   * TICKET-007: Automatic slot assignment for users
   */
  async allocateSlot(userId, options = {}) {
    try {
      console.log(`🎯 Allocating slot for user ${userId}...`);
      
      if (!this.isInitialized) {
        throw new Error('Slot Registry Service not initialized');
      }
      
      // Check user limits
      const userSlotCount = this.getUserSlotCount(userId);
      if (userSlotCount >= this.config.loadBalancing.maxSlotsPerUser) {
        throw new Error(`User ${userId} has reached maximum slot limit (${this.config.loadBalancing.maxSlotsPerUser})`);
      }
      
      // Find available slot using load balancing strategy
      let slot = await this.findAvailableSlot(userId, options);
      
      // If no available slot, create new one
      if (!slot) {
        slot = await this.createSlot(userId, options);
      }
      
      // Assign slot to user
      await this.assignSlot(slot, userId, options);
      
      // Update metrics
      this.metrics.totalAllocations++;
      this.metrics.currentLoad = this.assignedSlots.size / this.config.maxSlots;
      
      // Log allocation
      this.logAllocation(userId, slot, 'allocated');
      
      console.log(`✅ Slot ${slot.id} allocated to user ${userId}`);
      
      return {
        success: true,
        slot: this.getSafeSlotData(slot),
        allocation: {
          userId,
          slotId: slot.id,
          allocatedAt: new Date(),
          strategy: this.loadBalancer.currentStrategy,
          resourceUsage: this.getResourceUsage(slot.id)
        }
      };
      
    } catch (error) {
      this.metrics.failedAllocations++;
      console.error('❌ Slot allocation failed:', error);
      throw error;
    }
  }
  
  /**
   * Find available slot using load balancing strategy
   */
  async findAvailableSlot(userId, options = {}) {
    const strategy = options.strategy || this.loadBalancer.currentStrategy;
    
    switch (strategy) {
      case 'least-connections':
        return await this.findLeastConnectionsSlot(userId, options);
      case 'round-robin':
        return await this.findRoundRobinSlot(userId, options);
      case 'resource-based':
        return await this.findResourceBasedSlot(userId, options);
      default:
        return await this.findLeastConnectionsSlot(userId, options);
    }
  }
  
  /**
   * Least connections load balancing
   */
  async findLeastConnectionsSlot(userId, options = {}) {
    let bestSlot = null;
    let minConnections = Infinity;
    
    for (const slotId of this.availableSlots) {
      const slot = this.slotRegistry.get(slotId);
      if (!slot || this.blacklistedSlots.has(slotId)) continue;
      
      const connections = this.loadBalancer.connectionCounts.get(slotId) || 0;
      
      // Prefer slots with fewer connections
      if (connections < minConnections) {
        minConnections = connections;
        bestSlot = slot;
      }
    }
    
    return bestSlot;
  }
  
  /**
   * Round-robin load balancing
   */
  async findRoundRobinSlot(userId, options = {}) {
    const availableSlots = Array.from(this.availableSlots)
      .filter(slotId => !this.blacklistedSlots.has(slotId))
      .map(slotId => this.slotRegistry.get(slotId))
      .filter(Boolean);
    
    if (availableSlots.length === 0) return null;
    
    // Simple round-robin selection
    const index = this.metrics.totalAllocations % availableSlots.length;
    return availableSlots[index];
  }
  
  /**
   * Resource-based load balancing
   */
  async findResourceBasedSlot(userId, options = {}) {
    let bestSlot = null;
    let bestScore = -1;
    
    for (const slotId of this.availableSlots) {
      const slot = this.slotRegistry.get(slotId);
      if (!slot || this.blacklistedSlots.has(slotId)) continue;
      
      const score = this.calculateSlotScore(slotId);
      
      if (score > bestScore) {
        bestScore = score;
        bestSlot = slot;
      }
    }
    
    return bestSlot;
  }
  
  /**
   * Calculate slot score for resource-based balancing
   */
  calculateSlotScore(slotId) {
    const metrics = this.resourceMetrics.get(slotId) || {};
    const connections = this.loadBalancer.connectionCounts.get(slotId) || 0;
    
    // Calculate resource availability score (0-1)
    const memoryScore = 1 - (metrics.memory || 0) / this.config.resourceLimits.maxMemoryPerSlot;
    const cpuScore = 1 - (metrics.cpu || 0) / this.config.resourceLimits.maxCpuPerSlot;
    const connectionScore = 1 - connections / this.config.resourceLimits.maxNetworkConnections;
    
    // Weighted average
    return (memoryScore * 0.4 + cpuScore * 0.3 + connectionScore * 0.3);
  }
  
  /**
   * Create new slot
   */
  async createSlot(userId, options = {}) {
    const slotId = `slot_${uuidv4()}`;
    
    const slot = {
      id: slotId,
      userId: null,
      status: 'creating',
      type: options.type || 'standard',
      priority: options.priority || 'normal',
      createdAt: new Date(),
      updatedAt: new Date(),
      allocatedAt: null,
      lastUsedAt: null,
      timeout: options.timeout || this.config.defaultSlotTimeout,
      resourceLimits: { ...this.config.resourceLimits, ...options.resourceLimits },
      metadata: {
        createdBy: 'slot-registry',
        strategy: this.loadBalancer.currentStrategy,
        ...options.metadata
      },
      state: {
        phase: 'initializing',
        health: 'healthy',
        performance: {
          cpu: 0,
          memory: 0,
          disk: 0,
          network: 0
        },
        connections: 0,
        operations: 0
      }
    };
    
    // Add to registry
    this.slotRegistry.set(slotId, slot);
    this.availableSlots.add(slotId);
    
    // Initialize resource metrics
    this.resourceMetrics.set(slotId, {
      timestamp: new Date(),
      memory: 0,
      cpu: 0,
      disk: 0,
      network: 0,
      connections: 0,
      operations: 0
    });
    
    // Initialize load balancer data
    this.loadBalancer.connectionCounts.set(slotId, 0);
    this.loadBalancer.lastUsed.set(slotId, Date.now());
    this.loadBalancer.healthStatus.set(slotId, 'healthy');
    
    // Emit creation event
    this.emit('slotCreated', { slotId, slot });
    
    return slot;
  }
  
  /**
   * Assign slot to user
   */
  async assignSlot(slot, userId, options = {}) {
    // Update slot
    slot.userId = userId;
    slot.status = 'assigned';
    slot.allocatedAt = new Date();
    slot.updatedAt = new Date();
    
    // Update user slots mapping
    if (!this.userSlots.has(userId)) {
      this.userSlots.set(userId, new Set());
    }
    this.userSlots.get(userId).add(slot.id);
    
    // Update slot pools
    this.availableSlots.delete(slot.id);
    this.assignedSlots.add(slot.id);
    
    // Update load balancer
    this.loadBalancer.connectionCounts.set(slot.id, 
      (this.loadBalancer.connectionCounts.get(slot.id) || 0) + 1);
    this.loadBalancer.lastUsed.set(slot.id, Date.now());
    
    // Update slot weight
    this.updateSlotWeight(slot.id);
    
    // Save state
    await this.saveRegistryState();
    
    // Emit assignment event
    this.emit('slotAssigned', { slotId: slot.id, userId, slot });
  }
  
  /**
   * Deallocate slot
   */
  async deallocateSlot(slotId, options = {}) {
    try {
      const slot = this.slotRegistry.get(slotId);
      if (!slot) {
        throw new Error(`Slot ${slotId} not found`);
      }
      
      console.log(`🔓 Deallocating slot ${slotId}...`);
      
      // Remove from user slots mapping
      if (slot.userId && this.userSlots.has(slot.userId)) {
        this.userSlots.get(slot.userId).delete(slotId);
      }
      
      // Update slot status
      slot.status = 'deallocating';
      slot.updatedAt = new Date();
      
      // Remove from assigned slots
      this.assignedSlots.delete(slotId);
      
      // Update load balancer
      this.loadBalancer.connectionCounts.delete(slotId);
      this.loadBalancer.lastUsed.delete(slotId);
      
      // Check if slot should be recycled or destroyed
      if (this.shouldRecycleSlot(slot)) {
        await this.recycleSlot(slot);
      } else {
        await this.destroySlot(slot);
      }
      
      // Update metrics
      this.metrics.totalDeallocations++;
      this.metrics.currentLoad = this.assignedSlots.size / this.config.maxSlots;
      
      // Log deallocation
      this.logAllocation(slot.userId || 'unknown', slot, 'deallocated');
      
      // Save state
      await this.saveRegistryState();
      
      console.log(`✅ Slot ${slotId} deallocated successfully`);
      
      return { success: true, slotId, deallocatedAt: new Date() };
      
    } catch (error) {
      console.error('❌ Slot deallocation failed:', error);
      throw error;
    }
  }
  
  /**
   * Check if slot should be recycled
   */
  shouldRecycleSlot(slot) {
    const age = Date.now() - slot.createdAt.getTime();
    return age < this.config.cleanup.maxAge && 
           slot.state.health === 'healthy' &&
           !this.blacklistedSlots.has(slot.id);
  }
  
  /**
   * Recycle slot for reuse
   */
  async recycleSlot(slot) {
    // Reset slot state
    slot.userId = null;
    slot.status = 'available';
    slot.allocatedAt = null;
    slot.updatedAt = new Date();
    slot.state.phase = 'ready';
    slot.metadata.recycledAt = new Date();
    
    // Add to available slots
    this.availableSlots.add(slot.id);
    
    // Reset resource metrics
    this.resourceMetrics.set(slot.id, {
      timestamp: new Date(),
      memory: 0,
      cpu: 0,
      disk: 0,
      network: 0,
      connections: 0,
      operations: 0
    });
    
    // Emit recycle event
    this.emit('slotRecycled', { slotId: slot.id, slot });
  }
  
  /**
   * Destroy slot completely
   */
  async destroySlot(slot) {
    // Remove from registry
    this.slotRegistry.delete(slot.id);
    this.availableSlots.delete(slot.id);
    this.blacklistedSlots.delete(slot.id);
    this.resourceMetrics.delete(slot.id);
    this.loadBalancer.healthStatus.delete(slot.id);
    
    // Emit destroy event
    this.emit('slotDestroyed', { slotId: slot.id, slot });
  }
  
  /**
   * Update slot weight for load balancing
   */
  updateSlotWeight(slotId) {
    const score = this.calculateSlotScore(slotId);
    this.loadBalancer.slotWeights.set(slotId, score);
  }
  
  /**
   * Perform health checks on all slots
   */
  async performHealthChecks() {
    const healthChecks = [];
    
    for (const [slotId, slot] of this.slotRegistry) {
      if (slot.status === 'assigned' || slot.status === 'available') {
        healthChecks.push(this.checkSlotHealth(slotId));
      }
    }
    
    await Promise.allSettled(healthChecks);
  }
  
  /**
   * Check individual slot health
   */
  async checkSlotHealth(slotId) {
    try {
      const slot = this.slotRegistry.get(slotId);
      if (!slot) return;
      
      // Check timeout
      if (slot.allocatedAt && Date.now() - slot.allocatedAt.getTime() > slot.timeout) {
        await this.deallocateSlot(slotId, { reason: 'timeout' });
        return;
      }
      
      // Check idle timeout
      const lastUsed = this.loadBalancer.lastUsed.get(slotId) || 0;
      if (Date.now() - lastUsed > this.config.idleTimeout) {
        await this.deallocateSlot(slotId, { reason: 'idle' });
        return;
      }
      
      // Update health status
      this.loadBalancer.healthStatus.set(slotId, 'healthy');
      slot.state.health = 'healthy';
      
    } catch (error) {
      console.error(`❌ Health check failed for slot ${slotId}:`, error);
      
      // Blacklist failed slots
      const failures = (this.loadBalancer.healthStatus.get(slotId) === 'failed') ? 
        (slot.metadata.failures || 0) + 1 : 1;
      
      slot.metadata.failures = failures;
      
      if (failures >= this.config.loadBalancing.failedSlotThreshold) {
        this.blacklistedSlots.add(slotId);
        this.loadBalancer.healthStatus.set(slotId, 'blacklisted');
        slot.state.health = 'failed';
      } else {
        this.loadBalancer.healthStatus.set(slotId, 'failed');
        slot.state.health = 'unhealthy';
      }
    }
  }
  
  /**
   * Perform cleanup operations
   */
  async performCleanup() {
    try {
      const cleanupTime = Date.now();
      let cleanedCount = 0;
      
      // Clean up zombie slots
      for (const [slotId, slot] of this.slotRegistry) {
        if (slot.status === 'assigned' && slot.userId) {
          const lastUsed = this.loadBalancer.lastUsed.get(slotId) || 0;
          if (cleanupTime - lastUsed > this.config.cleanup.zombieTimeout) {
            await this.deallocateSlot(slotId, { reason: 'zombie' });
            cleanedCount++;
          }
        }
      }
      
      // Clean up old allocation history
      const cutoffTime = cleanupTime - this.config.cleanup.retentionPeriod;
      this.allocationHistory = this.allocationHistory.filter(
        entry => entry.timestamp > cutoffTime
      );
      
      // Clean up old metrics
      for (const [slotId, metrics] of this.resourceMetrics) {
        if (cleanupTime - metrics.timestamp > this.config.cleanup.retentionPeriod) {
          this.resourceMetrics.delete(slotId);
        }
      }
      
      console.log(`🧹 Cleanup completed: ${cleanedCount} slots cleaned`);
      
    } catch (error) {
      console.error('❌ Cleanup failed:', error);
    }
  }
  
  /**
   * Resource usage monitoring
   */
  updateResourceMetrics(slotId, metrics) {
    const existing = this.resourceMetrics.get(slotId) || {};
    this.resourceMetrics.set(slotId, {
      ...existing,
      ...metrics,
      timestamp: new Date()
    });
    
    // Update slot weight for load balancing
    this.updateSlotWeight(slotId);
    
    // Emit metrics update
    this.emit('resourceMetricsUpdated', { slotId, metrics });
  }
  
  /**
   * Get resource usage for slot
   */
  getResourceUsage(slotId) {
    return this.resourceMetrics.get(slotId) || {
      memory: 0,
      cpu: 0,
      disk: 0,
      network: 0,
      connections: 0,
      operations: 0
    };
  }
  
  /**
   * Get user slot count
   */
  getUserSlotCount(userId) {
    return this.userSlots.get(userId)?.size || 0;
  }
  
  /**
   * Get user slots
   */
  getUserSlots(userId) {
    const slotIds = this.userSlots.get(userId) || new Set();
    return Array.from(slotIds)
      .map(slotId => this.slotRegistry.get(slotId))
      .filter(Boolean)
      .map(slot => this.getSafeSlotData(slot));
  }
  
  /**
   * Get safe slot data (no sensitive information)
   */
  getSafeSlotData(slot) {
    if (!slot) return null;
    
    return {
      id: slot.id,
      userId: slot.userId,
      status: slot.status,
      type: slot.type,
      priority: slot.priority,
      createdAt: slot.createdAt,
      allocatedAt: slot.allocatedAt,
      lastUsedAt: slot.lastUsedAt,
      timeout: slot.timeout,
      resourceLimits: slot.resourceLimits,
      state: {
        phase: slot.state.phase,
        health: slot.state.health,
        performance: slot.state.performance
      },
      metadata: {
        strategy: slot.metadata.strategy,
        recycledAt: slot.metadata.recycledAt
      }
    };
  }
  
  /**
   * Get registry statistics
   */
  getRegistryStats() {
    const totalSlots = this.slotRegistry.size;
    const availableCount = this.availableSlots.size;
    const assignedCount = this.assignedSlots.size;
    const blacklistedCount = this.blacklistedSlots.size;
    
    return {
      totalSlots,
      availableSlots: availableCount,
      assignedSlots: assignedCount,
      blacklistedSlots: blacklistedCount,
      utilizationRate: totalSlots > 0 ? assignedCount / totalSlots : 0,
      averageSlotsPerUser: this.userSlots.size > 0 ? 
        Array.from(this.userSlots.values()).reduce((sum, slots) => sum + slots.size, 0) / this.userSlots.size : 0,
      loadBalancing: {
        strategy: this.loadBalancer.currentStrategy,
        connectionDistribution: Object.fromEntries(this.loadBalancer.connectionCounts),
        healthDistribution: Object.fromEntries(this.loadBalancer.healthStatus)
      },
      metrics: { ...this.metrics },
      uptime: this.startTime ? Date.now() - this.startTime : 0
    };
  }
  
  /**
   * Log allocation event
   */
  logAllocation(userId, slot, action) {
    this.allocationHistory.push({
      timestamp: new Date(),
      userId,
      slotId: slot.id,
      action,
      strategy: this.loadBalancer.currentStrategy,
      resourceUsage: this.getResourceUsage(slot.id)
    });
    
    // Emit allocation event
    this.emit('allocationEvent', { userId, slotId: slot.id, action });
  }
  
  /**
   * Load registry state from storage
   */
  async loadRegistryState() {
    if (this.config.storage.type !== 'file' || !this.storagePath) return;
    
    try {
      const fs = await import('fs');
      
      if (fs.existsSync(this.storagePath)) {
        const data = fs.readFileSync(this.storagePath, 'utf8');
        const state = JSON.parse(data);
        
        // Restore registry state
        this.restoreRegistryState(state);
        
        console.log(`📂 Loaded registry state with ${this.slotRegistry.size} slots`);
      }
    } catch (error) {
      console.warn('⚠️ Failed to load registry state:', error);
    }
  }
  
  /**
   * Restore registry state from saved data
   */
  restoreRegistryState(state) {
    // Clear current state
    this.slotRegistry.clear();
    this.userSlots.clear();
    this.availableSlots.clear();
    this.assignedSlots.clear();
    this.blacklistedSlots.clear();
    this.resourceMetrics.clear();
    
    // Restore slots
    if (state.slots) {
      for (const [slotId, slotData] of Object.entries(state.slots)) {
        const slot = {
          ...slotData,
          createdAt: new Date(slotData.createdAt),
          updatedAt: new Date(slotData.updatedAt),
          allocatedAt: slotData.allocatedAt ? new Date(slotData.allocatedAt) : null,
          lastUsedAt: slotData.lastUsedAt ? new Date(slotData.lastUsedAt) : null
        };
        this.slotRegistry.set(slotId, slot);
      }
    }
    
    // Restore user slots
    if (state.userSlots) {
      for (const [userId, slotIds] of Object.entries(state.userSlots)) {
        this.userSlots.set(userId, new Set(slotIds));
      }
    }
    
    // Restore slot sets
    if (state.availableSlots) {
      state.availableSlots.forEach(slotId => this.availableSlots.add(slotId));
    }
    if (state.assignedSlots) {
      state.assignedSlots.forEach(slotId => this.assignedSlots.add(slotId));
    }
    if (state.blacklistedSlots) {
      state.blacklistedSlots.forEach(slotId => this.blacklistedSlots.add(slotId));
    }
    
    // Restore metrics
    if (state.metrics) {
      Object.assign(this.metrics, state.metrics);
    }
    
    // Restore resource metrics
    if (state.resourceMetrics) {
      for (const [slotId, metrics] of Object.entries(state.resourceMetrics)) {
        metrics.timestamp = new Date(metrics.timestamp);
        this.resourceMetrics.set(slotId, metrics);
      }
    }
    
    // Restore load balancer state
    if (state.loadBalancer) {
      Object.assign(this.loadBalancer, state.loadBalancer);
      this.loadBalancer.connectionCounts = new Map(Object.entries(this.loadBalancer.connectionCounts));
      this.loadBalancer.lastUsed = new Map(Object.entries(this.loadBalancer.lastUsed));
      this.loadBalancer.healthStatus = new Map(Object.entries(this.loadBalancer.healthStatus));
      this.loadBalancer.slotWeights = new Map(Object.entries(this.loadBalancer.slotWeights));
    }
  }
  
  /**
   * Save registry state to storage
   */
  async saveRegistryState() {
    if (this.config.storage.type !== 'file' || !this.storagePath) return;
    
    try {
      const fs = await import('fs');
      
      const state = {
        slots: Object.fromEntries(this.slotRegistry),
        userSlots: Object.fromEntries(
          Array.from(this.userSlots.entries()).map(([userId, slots]) => [userId, Array.from(slots)])
        ),
        availableSlots: Array.from(this.availableSlots),
        assignedSlots: Array.from(this.assignedSlots),
        blacklistedSlots: Array.from(this.blacklistedSlots),
        resourceMetrics: Object.fromEntries(this.resourceMetrics),
        loadBalancer: {
          currentStrategy: this.loadBalancer.currentStrategy,
          connectionCounts: Object.fromEntries(this.loadBalancer.connectionCounts),
          lastUsed: Object.fromEntries(this.loadBalancer.lastUsed),
          healthStatus: Object.fromEntries(this.loadBalancer.healthStatus),
          slotWeights: Object.fromEntries(this.loadBalancer.slotWeights)
        },
        metrics: this.metrics,
        savedAt: new Date()
      };
      
      fs.writeFileSync(this.storagePath, JSON.stringify(state, null, 2));
      
    } catch (error) {
      console.error('❌ Failed to save registry state:', error);
    }
  }
  
  /**
   * Backup registry state
   */
  async backupRegistryState() {
    if (this.config.storage.type !== 'file') return;
    
    try {
      const fs = await import('fs');
      const path = await import('path');
      
      const backupPath = path.join(
        this.config.storage.dataDirectory,
        `backup-${Date.now()}.json`
      );
      
      await this.saveRegistryState();
      
      if (fs.existsSync(this.storagePath)) {
        fs.copyFileSync(this.storagePath, backupPath);
        console.log(`💾 Registry state backed up to ${backupPath}`);
      }
      
    } catch (error) {
      console.error('❌ Failed to backup registry state:', error);
    }
  }
  
  /**
   * Shutdown the service
   */
  async shutdown() {
    try {
      console.log('🛑 Shutting down Slot Registry & State Management Service...');
      
      // Stop background processes
      if (this.healthCheckTimer) clearInterval(this.healthCheckTimer);
      if (this.cleanupTimer) clearInterval(this.cleanupTimer);
      if (this.backupTimer) clearInterval(this.backupTimer);
      
      // Save final state
      await this.saveRegistryState();
      
      // Clear all data
      this.slotRegistry.clear();
      this.userSlots.clear();
      this.availableSlots.clear();
      this.assignedSlots.clear();
      this.blacklistedSlots.clear();
      this.resourceMetrics.clear();
      
      this.isInitialized = false;
      this.isRunning = false;
      
      console.log('✅ Slot Registry & State Management Service shutdown complete');
      
    } catch (error) {
      console.error('❌ Failed to shutdown Slot Registry Service:', error);
      throw error;
    }
  }
}

export default SlotRegistryService;