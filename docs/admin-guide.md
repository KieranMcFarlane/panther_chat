# ClaudeBox Multi-Slot System - Administrator Guide

## 🎯 Administrator Overview

This guide provides comprehensive information for system administrators managing the ClaudeBox Multi-Slot platform. As an administrator, you have full control over system configuration, user management, monitoring, and maintenance.

## 🏗️ System Architecture

### Core Components

#### 1. Authentication Layer
- **Better Auth MCP Integration**: Enhanced authentication with multiple providers
- **Session Management**: Secure token-based session handling
- **User Directory**: Centralized user management
- **Access Control**: Role-based permissions and policies

#### 2. Slot Management
- **Slot Registry**: Central slot allocation and tracking
- **Resource Manager**: CPU, memory, and storage allocation
- **Process Monitor**: Real-time slot health monitoring
- **Auto-scaling**: Dynamic resource provisioning

#### 3. Infrastructure Layer
- **PM2 Process Manager**: Service lifecycle management
- **SSH Tunnel Manager**: Secure remote connectivity
- **TTYD Service**: Web-based terminal access
- **Load Balancer**: Traffic distribution across instances

#### 4. Monitoring & Logging
- **Health Monitor**: System health checks and alerts
- **Analytics Engine**: Usage metrics and performance data
- **Log Aggregation**: Centralized log collection
- **Alerting System**: Notification and escalation

## 🔧 System Configuration

### Initial Setup

#### 1. Server Requirements
```bash
# Minimum Requirements
- CPU: 8 cores (16+ recommended)
- RAM: 16GB (32GB+ recommended)
- Storage: 500GB SSD (1TB+ recommended)
- Network: 1Gbps (10Gbps recommended)
- OS: Ubuntu 22.04 LTS or later

# Recommended Stack
- Node.js 18.x or later
- PM2 5.x or later
- Docker 24.x or later
- Neo4j 5.x or later
```

#### 2. Installation Process
```bash
# 1. Clone the repository
git clone https://github.com/claudebox/multi-slot.git
cd multi-slot

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env
# Edit .env with your configuration

# 4. Install PM2 globally
npm install -g pm2

# 5. Start the system
npm run setup:production
```

#### 3. Environment Configuration
```bash
# .env file example
# Authentication
BETTER_AUTH_MCP_URL=https://mcp.chonkie.ai/better-auth/better-auth-builder/mcp
BETTER_AUTH_API_KEY=your_api_key_here

# Database
NEO4J_URI=bolt://localhost:7687
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=your_password_here

# System Settings
MAX_CONCURRENT_SLOTS=100
DEFAULT_CPU_LIMIT=2
DEFAULT_MEMORY_LIMIT=4
DEFAULT_STORAGE_LIMIT=50

# Security
JWT_SECRET=your_jwt_secret_here
SESSION_SECRET=your_session_secret_here
ENCRYPTION_KEY=your_encryption_key_here

# Monitoring
ENABLE_METRICS=true
METRICS_INTERVAL=30000
ALERT_WEBHOOK_URL=https://your-webhook-url.com
```

### Authentication Configuration

#### 1. Better Auth MCP Setup
```javascript
// services/better-auth-config.js
const betterAuthConfig = {
  providers: {
    oauth2: {
      google: {
        clientId: 'your_google_client_id',
        clientSecret: 'your_google_client_secret',
        redirectUri: 'https://your-domain.com/auth/google/callback'
      },
      github: {
        clientId: 'your_github_client_id',
        clientSecret: 'your_github_client_secret',
        redirectUri: 'https://your-domain.com/auth/github/callback'
      }
    },
    saml: {
      enabled: true,
      identityProviderUrl: 'https://your-idp.com/saml',
      entityId: 'your-entity-id',
      privateKey: fs.readFileSync('path/to/private.key'),
      certificate: fs.readFileSync('path/to/certificate.crt')
    }
  },
  session: {
    duration: 24 * 60 * 60 * 1000, // 24 hours
    refreshEnabled: true,
    refreshTokenDuration: 7 * 24 * 60 * 60 * 1000 // 7 days
  },
  security: {
    enableCSRFProtection: true,
    enableRateLimiting: true,
    maxLoginAttempts: 5,
    lockoutDuration: 15 * 60 * 1000 // 15 minutes
  }
};
```

#### 2. User Role Configuration
```javascript
// roles/user-roles.js
const userRoles = {
  admin: {
    permissions: [
      'system:read',
      'system:write',
      'system:delete',
      'users:read',
      'users:write',
      'users:delete',
      'slots:read',
      'slots:write',
      'slots:delete',
      'billing:read',
      'billing:write'
    ],
    slotLimits: {
      maxSlots: 50,
      maxConcurrentSlots: 10,
      resourceLimits: {
        cpu: 16,
        memory: 32,
        storage: 1000
      }
    }
  },
  user: {
    permissions: [
      'slots:read',
      'slots:write',
      'users:read' // self only
    ],
    slotLimits: {
      maxSlots: 5,
      maxConcurrentSlots: 2,
      resourceLimits: {
        cpu: 4,
        memory: 8,
        storage: 100
      }
    }
  },
  readonly: {
    permissions: [
      'slots:read',
      'users:read' // self only
    ],
    slotLimits: {
      maxSlots: 1,
      maxConcurrentSlots: 1,
      resourceLimits: {
        cpu: 2,
        memory: 4,
        storage: 50
      }
    }
  }
};
```

### Resource Management

#### 1. Resource Allocation
```javascript
// config/resource-limits.js
const resourceLimits = {
  global: {
    maxConcurrentSlots: 100,
    maxTotalCPU: 200,
    maxTotalMemory: 400,
    maxTotalStorage: 5000
  },
  tiers: {
    basic: {
      cpu: 1,
      memory: 2,
      storage: 20,
      networkBandwidth: 100
    },
    standard: {
      cpu: 2,
      memory: 4,
      storage: 50,
      networkBandwidth: 500
    },
    premium: {
      cpu: 4,
      memory: 8,
      storage: 100,
      networkBandwidth: 1000
    },
    enterprise: {
      cpu: 8,
      memory: 16,
      storage: 500,
      networkBandwidth: 2000
    }
  }
};
```

#### 2. Auto-scaling Configuration
```javascript
// config/auto-scaling.js
const autoScalingConfig = {
  enabled: true,
  checkInterval: 30000, // 30 seconds
  scaleUpThreshold: 80, // 80% utilization
  scaleDownThreshold: 20, // 20% utilization
  policies: {
    cpu: {
      scaleUpThreshold: 80,
      scaleDownThreshold: 20,
      cooldownPeriod: 300000 // 5 minutes
    },
    memory: {
      scaleUpThreshold: 85,
      scaleDownThreshold: 25,
      cooldownPeriod: 300000
    },
    slots: {
      scaleUpThreshold: 90,
      scaleDownThreshold: 30,
      cooldownPeriod: 600000 // 10 minutes
    }
  }
};
```

## 👥 User Management

### User Lifecycle Management

#### 1. User Registration
```javascript
// services/user-service.js
class UserService {
  async createUser(userData) {
    const user = {
      id: generateId(),
      email: userData.email,
      username: userData.username,
      role: userData.role || 'user',
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
      settings: {
        notifications: true,
        theme: 'light',
        language: 'en'
      },
      limits: this.getUserLimits(userData.role)
    };
    
    await this.database.insert('users', user);
    await this.sendWelcomeEmail(user);
    return user;
  }
  
  async updateUser(userId, updates) {
    const user = await this.getUserById(userId);
    const updatedUser = {
      ...user,
      ...updates,
      updatedAt: new Date()
    };
    
    await this.database.update('users', { id: userId }, updatedUser);
    return updatedUser;
  }
  
  async deleteUser(userId) {
    // Clean up user data
    await this.cleanupUserSlots(userId);
    await this.cleanupUserSessions(userId);
    await this.database.delete('users', { id: userId });
  }
}
```

#### 2. User Authentication
```javascript
// services/auth-service.js
class AuthService {
  async authenticateUser(credentials, provider) {
    const validation = await this.validateCredentials(credentials, provider);
    if (!validation.valid) {
      throw new Error('Invalid credentials');
    }
    
    const user = await this.userService.getUserByEmail(credentials.email);
    if (!user) {
      throw new Error('User not found');
    }
    
    if (user.status !== 'active') {
      throw new Error('User account is not active');
    }
    
    const session = await this.createSession(user, provider);
    await this.logAuthAttempt(user.id, 'success', provider);
    
    return {
      user,
      session,
      permissions: this.getUserPermissions(user.role)
    };
  }
  
  async validateSession(sessionId) {
    const session = await this.sessionStore.get(sessionId);
    if (!session || session.expiresAt < new Date()) {
      return null;
    }
    
    const user = await this.userService.getUserById(session.userId);
    if (!user || user.status !== 'active') {
      return null;
    }
    
    return { user, session };
  }
}
```

### Role-Based Access Control

#### 1. Permission Management
```javascript
// services/permission-service.js
class PermissionService {
  constructor() {
    this.permissions = {
      'system:read': ['admin'],
      'system:write': ['admin'],
      'system:delete': ['admin'],
      'users:read': ['admin', 'user'],
      'users:write': ['admin'],
      'users:delete': ['admin'],
      'slots:read': ['admin', 'user', 'readonly'],
      'slots:write': ['admin', 'user'],
      'slots:delete': ['admin'],
      'billing:read': ['admin'],
      'billing:write': ['admin']
    };
  }
  
  hasPermission(userRole, permission) {
    const allowedRoles = this.permissions[permission];
    return allowedRoles && allowedRoles.includes(userRole);
  }
  
  getUserPermissions(userRole) {
    return Object.keys(this.permissions).filter(permission => 
      this.hasPermission(userRole, permission)
    );
  }
}
```

#### 2. User Quotas
```javascript
// services/quota-service.js
class QuotaService {
  async checkUserQuota(userId, resourceType, amount) {
    const user = await this.userService.getUserById(userId);
    const currentUsage = await this.getCurrentUsage(userId, resourceType);
    const limit = user.limits[resourceType];
    
    return currentUsage + amount <= limit;
  }
  
  async getCurrentUsage(userId, resourceType) {
    switch (resourceType) {
      case 'slots':
        return await this.countUserSlots(userId);
      case 'cpu':
        return await this.getUserCPUUsage(userId);
      case 'memory':
        return await this.getUserMemoryUsage(userId);
      case 'storage':
        return await this.getUserStorageUsage(userId);
      default:
        return 0;
    }
  }
}
```

## 🖥️ System Administration

### Service Management

#### 1. PM2 Process Management
```bash
# Start all services
pm2 start ecosystem.config.js

# Check service status
pm2 status

# Restart specific service
pm2 restart claudebox-api

# Stop all services
pm2 stop all

# Monitor logs
pm2 logs claudebox-api

# Scale services
pm2 scale claudebox-api 4
```

#### 2. Service Configuration
```javascript
// ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'claudebox-api',
      script: 'src/app.js',
      instances: 'max',
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000
      }
    },
    {
      name: 'claudebox-worker',
      script: 'src/worker.js',
      instances: 2,
      exec_mode: 'cluster'
    },
    {
      name: 'claudebox-monitor',
      script: 'src/monitor.js',
      instances: 1,
      exec_mode: 'fork'
    }
  ]
};
```

### Database Administration

#### 1. Neo4j Management
```bash
# Start Neo4j service
sudo systemctl start neo4j

# Check Neo4j status
sudo systemctl status neo4j

# Access Neo4j browser
# Open http://localhost:7474 in browser

# Backup database
neo4j-admin backup --database=neo4j --to=/path/to/backup

# Restore database
neo4j-admin restore --database=neo4j --from=/path/to/backup
```

#### 2. Database Queries
```cypher
// Find active users
MATCH (u:User {status: 'active'})
RETURN u.id, u.email, u.role, u.createdAt
ORDER BY u.createdAt DESC;

// Find slots by user
MATCH (u:User {id: $userId})-[:HAS_SLOT]->(s:Slot)
RETURN s.id, s.status, s.createdAt;

// Find system metrics
MATCH (m:Metric)
WHERE m.timestamp > timestamp() - duration('P1D')
RETURN m.type, m.value, m.timestamp
ORDER BY m.timestamp DESC;

// Find authentication attempts
MATCH (a:AuthAttempt)
WHERE a.timestamp > timestamp() - duration('P7D')
RETURN a.userId, a.provider, a.status, a.timestamp
ORDER BY a.timestamp DESC;
```

### Backup and Recovery

#### 1. Automated Backups
```javascript
// services/backup-service.js
class BackupService {
  async createBackup() {
    const timestamp = new Date().toISOString();
    const backup = {
      id: generateId(),
      timestamp,
      type: 'full',
      status: 'creating',
      components: {
        database: await this.backupDatabase(),
        user_data: await this.backupUserData(),
        slot_configs: await this.backupSlotConfigs(),
        system_configs: await this.backupSystemConfigs()
      }
    };
    
    try {
      await this.uploadBackup(backup);
      backup.status = 'completed';
      await this.saveBackupRecord(backup);
    } catch (error) {
      backup.status = 'failed';
      backup.error = error.message;
      await this.saveBackupRecord(backup);
      throw error;
    }
    
    return backup;
  }
  
  async restoreFromBackup(backupId) {
    const backup = await this.getBackup(backupId);
    if (!backup || backup.status !== 'completed') {
      throw new Error('Backup not found or incomplete');
    }
    
    // Stop services before restore
    await this.stopServices();
    
    try {
      await this.restoreDatabase(backup.components.database);
      await this.restoreUserData(backup.components.user_data);
      await this.restoreSlotConfigs(backup.components.slot_configs);
      await this.restoreSystemConfigs(backup.components.system_configs);
      
      // Start services after restore
      await this.startServices();
      
      return { success: true, message: 'Backup restored successfully' };
    } catch (error) {
      await this.startServices(); // Ensure services are running
      throw error;
    }
  }
}
```

#### 2. Backup Schedule
```javascript
// config/backup-schedule.js
const backupSchedule = {
  enabled: true,
  schedules: [
    {
      name: 'daily_backup',
      frequency: '0 2 * * *', // 2:00 AM daily
      type: 'incremental',
      retention: 30 // days
    },
    {
      name: 'weekly_backup',
      frequency: '0 3 * * 0', // 3:00 AM Sunday
      type: 'full',
      retention: 12 // weeks
    },
    {
      name: 'monthly_backup',
      frequency: '0 4 1 * *', // 4:00 AM 1st of month
      type: 'full',
      retention: 12 // months
    }
  ],
  storage: {
    type: 's3',
    bucket: 'claudebox-backups',
    region: 'us-east-1',
    encryption: true
  }
};
```

## 📊 Monitoring and Analytics

### System Monitoring

#### 1. Health Checks
```javascript
// services/health-monitor.js
class HealthMonitor {
  async checkSystemHealth() {
    const checks = [
      this.checkDatabase(),
      this.checkAuthentication(),
      this.checkSlotService(),
      this.checkResourceUsage(),
      this.checkNetworkConnectivity()
    ];
    
    const results = await Promise.allSettled(checks);
    const health = this.processHealthResults(results);
    
    if (health.overall === 'unhealthy') {
      await this.triggerAlert(health);
    }
    
    return health;
  }
  
  async checkDatabase() {
    try {
      const startTime = Date.now();
      await this.database.query('RETURN 1');
      const responseTime = Date.now() - startTime;
      
      return {
        component: 'database',
        status: 'healthy',
        responseTime,
        timestamp: new Date()
      };
    } catch (error) {
      return {
        component: 'database',
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date()
      };
    }
  }
}
```

#### 2. Metrics Collection
```javascript
// services/metrics-collector.js
class MetricsCollector {
  async collectSystemMetrics() {
    const metrics = {
      timestamp: new Date(),
      system: {
        cpu: await this.getCPUUsage(),
        memory: await this.getMemoryUsage(),
        disk: await this.getDiskUsage(),
        network: await this.getNetworkUsage()
      },
      application: {
        activeUsers: await this.getActiveUserCount(),
        activeSlots: await this.getActiveSlotCount(),
        responseTime: await this.getAverageResponseTime(),
        errorRate: await this.getErrorRate()
      },
      business: {
        newUsers: await this.getNewUserCount(),
        slotsCreated: await this.getSlotsCreatedCount(),
        revenue: await this.getRevenueMetrics()
      }
    };
    
    await this.storeMetrics(metrics);
    return metrics;
  }
}
```

### Alerting System

#### 1. Alert Configuration
```javascript
// config/alerts.js
const alertConfig = {
  rules: [
    {
      name: 'high_cpu_usage',
      condition: 'metrics.system.cpu > 90',
      severity: 'warning',
      channels: ['email', 'slack'],
      cooldown: 300000 // 5 minutes
    },
    {
      name: 'high_memory_usage',
      condition: 'metrics.system.memory > 95',
      severity: 'critical',
      channels: ['email', 'sms', 'slack'],
      cooldown: 300000
    },
    {
      name: 'database_error',
      condition: 'health.database.status === "unhealthy"',
      severity: 'critical',
      channels: ['email', 'sms', 'slack'],
      cooldown: 60000 // 1 minute
    },
    {
      name: 'auth_failure',
      condition: 'metrics.application.errorRate > 5',
      severity: 'warning',
      channels: ['email'],
      cooldown: 300000
    }
  ],
  channels: {
    email: {
      enabled: true,
      recipients: ['admin@claudebox.com'],
      smtp: {
        host: 'smtp.claudebox.com',
        port: 587,
        secure: false,
        auth: {
          user: 'alerts@claudebox.com',
          pass: 'password'
        }
      }
    },
    slack: {
      enabled: true,
      webhook: 'https://hooks.slack.com/services/...',
      channel: '#alerts'
    },
    sms: {
      enabled: true,
      provider: 'twilio',
      accountSid: 'AC...',
      authToken: 'your_auth_token',
      fromNumber: '+1234567890',
      toNumbers: ['+1234567890']
    }
  }
};
```

## 🔧 Troubleshooting

### Common Issues

#### 1. Authentication Problems
```bash
# Check Better Auth MCP connection
curl -X POST https://mcp.chonkie.ai/better-auth/better-auth-builder/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"health","id":1}'

# Check session store
redis-cli ping

# Check JWT configuration
node -e "console.log(require('jsonwebtoken').decode('your_jwt_token'))"
```

#### 2. Slot Issues
```bash
# Check PM2 processes
pm2 status

# Check slot registry
curl -X GET http://localhost:3000/api/admin/slots \
  -H "Authorization: Bearer your_admin_token"

# Check resource usage
docker stats

# Check SSH tunnels
ps aux | grep ssh
```

#### 3. Performance Issues
```bash
# Check system resources
htop
df -h
free -m

# Check database performance
neo4j-admin report

# Check application logs
pm2 logs claudebox-api --lines 100

# Check network connectivity
ping google.com
traceroute google.com
```

### Recovery Procedures

#### 1. System Recovery
```bash
# 1. Stop all services
pm2 stop all

# 2. Restore from backup
node scripts/restore-backup.js backup-id-123

# 3. Start services
pm2 start ecosystem.config.js

# 4. Verify system health
curl -X GET http://localhost:3000/api/health
```

#### 2. Database Recovery
```bash
# 1. Stop Neo4j
sudo systemctl stop neo4j

# 2. Restore database
neo4j-admin restore --database=neo4j --from=/path/to/backup

# 3. Start Neo4j
sudo systemctl start neo4j

# 4. Verify database
curl -X POST http://localhost:7474/db/data/transaction/commit \
  -H "Content-Type: application/json" \
  -d '{"statements":[{"statement":"RETURN 1"}]}'
```

## 📈 Performance Optimization

### System Optimization

#### 1. Database Optimization
```javascript
// config/database-optimization.js
const dbConfig = {
  neo4j: {
    memory: {
      heap_initial_size: '512m',
      heap_max_size: '2G',
      pagecache_size: '1G'
    },
    query_cache: {
      size: '1000'
    },
    indexing: {
      auto_indexing: true,
      schema_indexing: true
    }
  }
};
```

#### 2. Application Optimization
```javascript
// config/app-optimization.js
const appConfig = {
  server: {
    port: 3000,
    workers: 'max',
    timeout: 30000,
    keepAlive: 5000
  },
  cache: {
    enabled: true,
    ttl: 3600,
    store: 'redis',
    redis: {
      host: 'localhost',
      port: 6379,
      password: 'your_redis_password'
    }
  },
  compression: {
    enabled: true,
    level: 6
  }
};
```

### Resource Optimization

#### 1. CPU Optimization
```javascript
// services/cpu-optimizer.js
class CPUOptimizer {
  async optimizeCPUUsage() {
    const metrics = await this.getCPUMetrics();
    
    if (metrics.usage > 80) {
      // Implement CPU optimization strategies
      await this.throttleBackgroundProcesses();
      await this.optimizeDatabaseQueries();
      await this.scaleVertically();
    }
  }
}
```

#### 2. Memory Optimization
```javascript
// services/memory-optimizer.js
class MemoryOptimizer {
  async optimizeMemoryUsage() {
    const metrics = await this.getMemoryMetrics();
    
    if (metrics.usage > 85) {
      // Implement memory optimization strategies
      await this.clearUnusedCache();
      await this.optimizeGarbageCollection();
      await this.restartMemoryIntensiveServices();
    }
  }
}
```

---

## 📚 Additional Resources

### Documentation
- [User Guide](./user-guide.md)
- [API Reference](./api-reference.md)
- [Deployment Guide](./deployment-guide.md)
- [Troubleshooting Guide](./troubleshooting.md)

### Tools and Utilities
- [Admin CLI Tools](https://github.com/claudebox/admin-tools)
- [Monitoring Dashboard](https://monitor.claudebox.com)
- [Backup Tools](https://github.com/claudebox/backup-tools)

### Support
- **Admin Support**: admin-support@claudebox.com
- **Emergency Support**: +1 (555) 999-9999
- **Documentation**: docs.claudebox.com
- **Community**: admin-forum.claudebox.com

---

*Last Updated: September 28, 2025*  
*Version: 1.0.0*