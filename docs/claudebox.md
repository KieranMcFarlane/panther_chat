# 🚀 ClaudeBox Multi-Slot Architecture Plan

## 📋 Executive Summary

This document outlines a comprehensive plan to transform the existing ClaudeBox setup into a scalable, multi-user, multi-authentication platform using PM2 for process management and iframe-based access through `localhost:7681`.

## 🎯 Current State Analysis

### Existing Infrastructure
- **EC2 Instance**: `13.60.60.50` with ClaudeBox running
- **Active Slots**: 
  - `home_ec2_user_claude_955362c8-43ef8f48` (4 days running, waiting for auth)
  - `home_ec2_user_3709e788-292504d1` (9 days running)
- **Available Slots**: Multiple additional slots ready for provisioning
- **TTYD Service**: Running on port 7681 with SSH integration
- **Access**: Working SSH connection via `yellowpanther.pem`

### Current Architecture
```
User → Browser → Local App → Iframe → TTYD → SSH → EC2 → ClaudeBox Container
```

## 🏗️ Target Architecture

### Multi-Slot Design
```
User A → localhost:7681/slot/A → Slot A → Auth A → Claude Instance A
User B → localhost:7681/slot/B → Slot B → Auth B → Claude Instance B
User C → localhost:7681/slot/C → Slot C → Auth C → Claude Instance C
...
User N → localhost:7681/slot/N → Slot N → Auth N → Claude Instance N
```

### Key Components
1. **PM2 Process Manager**: Auto-restart, logging, monitoring
2. **Slot Management System**: Dynamic slot allocation and lifecycle
3. **Authentication Router**: Per-slot authentication management
4. **TTYD Web Interface**: Browser-based terminal access
5. **Session Persistence**: Maintain state across restarts
6. **Resource Monitor**: Track usage and scaling metrics

## 🚀 Implementation Phases

### Phase 1: PM2 Infrastructure Setup
**Goal**: Establish robust process management foundation

#### 1.1 PM2 Installation & Configuration
```bash
# Install PM2 on EC2
npm install -g pm2

# Create PM2 ecosystem file
pm2 ecosystem

# Configure auto-start on boot
pm2 startup
pm2 save
```

#### 1.2 Base Services Configuration
- **ClaudeBox Router**: Main request routing service
- **Slot Manager**: Dynamic slot allocation and management
- **Health Monitor**: Service health checking and reporting
- **Log Aggregator**: Centralized logging system

#### 1.3 Network & Security Setup
- Configure SSH tunnel persistence
- Set up firewall rules for port access
- Implement SSL/TLS termination
- Configure access controls

### Phase 1: Better Auth MCP Integration
**Goal**: Integrate advanced authentication capabilities using Better Auth MCP server

#### 1.1 Better Auth MCP Configuration
- **Service**: Better Auth MCP Server (HTTP transport)
- **URL**: https://mcp.chonkie.ai/better-auth/better-auth-builder/mcp
- **Status**: ✓ Connected and available
- **Purpose**: Enhanced authentication and session management

#### 1.2 Authentication Enhancement
- **Multi-Provider Support**: OAuth2, OpenID Connect, SAML
- **Session Management**: Advanced session handling and persistence
- **Security Features**: Token refresh, CSRF protection, rate limiting
- **User Management**: Registration, profile management, access control

#### 1.3 Integration Benefits
- **Simplified Auth Flow**: Reduce custom authentication code
- **Enhanced Security**: Enterprise-grade authentication features
- **Scalability**: Built-in support for distributed authentication
- **Compliance**: GDPR, CCPA, SOC2 compliance features

#### 1.4 Auth Bridge Service
```javascript
// services/auth-bridge.js
class AuthBridgeService {
  constructor() {
    this.betterAuthMCP = new BetterAuthMCPClient();
    this.authCache = new Map();
  }
  
  async authenticateUser(credentials, authType) {
    switch (authType) {
      case 'oauth':
        return await this.betterAuthMCP.authenticateOAuth(credentials);
      case 'oidc':
        return await this.betterAuthMCP.authenticateOpenIDConnect(credentials);
      case 'saml':
        return await this.betterAuthMCP.authenticateSAML(credentials);
      case 'claude':
        return await this.authenticateClaude(credentials);
      default:
        throw new Error(`Unsupported auth type: ${authType}`);
    }
  }
  
  async createSession(userId, authData) {
    const session = await this.betterAuthMCP.createSession({
      userId,
      authData,
      metadata: {
        platform: 'claudebox-multi-slot',
        version: '1.0.0'
      }
    });
    
    this.authCache.set(session.id, session);
    return session;
  }
  
  async validateSession(sessionId) {
    if (this.authCache.has(sessionId)) {
      return this.authCache.get(sessionId);
    }
    
    const session = await this.betterAuthMCP.validateSession(sessionId);
    if (session.valid) {
      this.authCache.set(sessionId, session);
    }
    return session;
  }
}
```

### Phase 3: Multi-Slot Management System
**Goal**: Dynamic slot provisioning and user mapping

#### 2.1 Slot Registry Implementation
```json
{
  "slots": {
    "slot-A": {
      "status": "active",
      "user": "user123",
      "auth_type": "claude_pro",
      "container": "claudebox-user123-abc123",
      "port": 7682,
      "last_active": "2024-01-15T10:30:00Z"
    },
    "slot-B": {
      "status": "available",
      "user": null,
      "auth_type": "api_key",
      "container": null,
      "port": null,
      "last_active": null
    }
  }
}
```

#### 2.2 Dynamic Slot Allocation
- **User Registration**: Assign slots to new users
- **Slot Provisioning**: Start new ClaudeBox containers on demand
- **Resource Monitoring**: Track memory, CPU, and disk usage per slot
- **Cleanup Process**: Terminate and clean up inactive slots

#### 2.3 Authentication Management
- **Per-Slot Auth**: Independent authentication per slot
- **Token Management**: Handle API key refresh and validation
- **Session Isolation**: Separate `.claude.json` files per slot
- **Auth Type Support**: Claude Pro, Max, Team, API key, Custom

### Phase 4: User Interface & Access
**Goal**: Seamless user experience through iframe interface

#### 3.1 URL Routing Structure
```
# User-specific slots
http://localhost:7681/slot/{user_id}      → User's dedicated slot
http://localhost:7681/team/{team_id}     → Team shared slot
http://localhost:7681/demo                → Public demo slot

# Administrative interfaces
http://localhost:7681/admin/slots        → Slot management
http://localhost:7681/admin/users        → User management
http://localhost:7681/admin/stats        → Usage statistics
http://localhost:7681/admin/logs         → System logs
```

#### 3.2 Iframe Integration
- **Seamless Embedding**: Direct ClaudeBox access within existing interface
- **Session Persistence**: Maintain user sessions across page refreshes
- **Error Handling**: Graceful handling of connection issues
- **Loading States**: Proper feedback during slot initialization

#### 3.3 User Dashboard
- **Slot Overview**: View all available slots and their status
- **Usage Statistics**: Track personal usage and activity
- **Authentication Management**: Configure auth methods per slot
- **Settings**: Customize ClaudeBox preferences per slot

### Phase 5: Scaling & Optimization
**Goal**: Production-ready scalability and performance

#### 4.1 Auto-scaling Implementation
- **Horizontal Scaling**: Add more EC2 instances as needed
- **Load Balancing**: Distribute users across multiple instances
- **Resource Optimization**: Optimize memory and CPU usage
- **Graceful Degradation**: Handle resource constraints

#### 4.2 Monitoring & Alerting
- **Performance Metrics**: Track response times, resource usage
- **Error Tracking**: Monitor and alert on system errors
- **Usage Analytics**: User behavior and usage patterns
- **Health Checks**: Automated system health verification

#### 4.3 Backup & Recovery
- **Data Backup**: Regular backups of user data and configurations
- **Disaster Recovery**: Automated failover and recovery procedures
- **Snapshot Management**: Regular system snapshots for quick recovery
- **Testing**: Regular testing of backup and recovery procedures

## 🔧 Technical Specifications

### PM2 Ecosystem Configuration
```json
{
  "apps": [
    {
      "name": "claudebox-router",
      "script": "./services/router.js",
      "instances": 1,
      "exec_mode": "fork",
      "env": {
        "NODE_ENV": "production",
        "PORT": 7681
      }
    },
    {
      "name": "slot-manager",
      "script": "./services/slot-manager.js",
      "instances": 1,
      "exec_mode": "fork",
      "env": {
        "MAX_SLOTS": "50",
        "SLOT_TIMEOUT": "3600000"
      }
    },
    {
      "name": "health-monitor",
      "script": "./services/health-monitor.js",
      "instances": 1,
      "exec_mode": "fork",
      "cron_restart": "0 */6 * * * *"
    }
  ]
}
```

### Slot Service Configuration
```bash
#!/bin/bash
# start-slot.sh - Individual slot startup script

SLOT_ID=$1
USER_ID=$2
AUTH_TYPE=$3
PORT=$4

# Start ClaudeBox container for this slot
docker run -d \
  --name "claudebox-${USER_ID}-${SLOT_ID}" \
  -v "/home/ec2-user/.claudebox/projects/${USER_ID}:/home/claude/.claudebox" \
  -v "/home/ec2-user/.ssh:/home/claude/.ssh:ro" \
  -e "CLAUDEBOX_SLOT_NAME=${SLOT_ID}" \
  -e "CLAUDEBOX_USER_ID=${USER_ID}" \
  -e "CLAUDEBOX_AUTH_TYPE=${AUTH_TYPE}" \
  -p "${PORT}:22" \
  claudebox/claudebox:latest

# Start TTYD for this slot
ttyd -p $((PORT + 1000)) \
  -W \
  --prefer-dark-theme \
  ssh -i /home/ec2-user/yellowpanther.pem \
  -o StrictHostKeyChecking=no \
  -p $PORT \
  claude@localhost
```

### Authentication Types Support
1. **Claude Individual**: Pro/Max subscriptions
2. **Claude Team**: Team/Enterprise accounts
3. **Anthropic Console**: API key billing
4. **Custom Authentication**: Organization-specific auth
5. **Demo Mode**: Limited public access with rate limits

## 📊 Scaling Capabilities

### User Capacity Planning
| Scale Level | Concurrent Users | Slots Required | Memory (GB) | CPU Cores | Storage (GB) |
|-------------|------------------|----------------|-------------|-----------|--------------|
| Small Team | 5-20 | 10-25 | 4-8 | 2-4 | 50-100 |
| Medium Team | 20-50 | 25-75 | 8-16 | 4-8 | 100-200 |
| Large Org | 50-200 | 75-300 | 16-32 | 8-16 | 200-500 |
| Enterprise | 200-1000 | 300-1500 | 32-64 | 16-32 | 500-2000 |
| Public Service | 1000+ | 1500+ | 64+ | 32+ | 2000+ |

### Resource Requirements per Slot
- **Memory**: ~200MB RAM per active slot
- **CPU**: Minimal when idle, moderate during active usage
- **Storage**: ~100MB per slot (isolated directories)
- **Network**: ~1Mbps per active session

## 🎯 User Experience

### Access Methods
1. **Direct URL Access**: `http://localhost:7681/slot/{user_id}`
2. **Dashboard Access**: Through main application dashboard
3. **API Access**: RESTful API for programmatic access
4. **CLI Access**: Command-line interface for power users

### Session Features
- **Persistent Sessions**: Work saved between sessions
- **Collaborative Access**: Team slots for shared workspaces
- **Isolated Environments**: Complete separation between users
- **Custom Settings**: Individual ClaudeBox preferences per slot

### Authentication Flow
1. **User Registration**: Create account and select auth method
2. **Slot Assignment**: Automatic allocation of dedicated slot
3. **Authentication**: Configure Claude authentication for the slot
4. **Access**: Direct access to personalized ClaudeBox environment

## 🛠️ Development Roadmap

### Milestone 1 (Weeks 1-2)
- [ ] Better Auth MCP integration and testing
- [ ] PM2 installation and configuration
- [ ] Auth bridge service implementation
- [ ] Basic slot management system

### Milestone 2 (Weeks 3-4)
- [ ] Multi-slot support implementation
- [ ] User management system with Better Auth
- [ ] Enhanced authentication per slot
- [ ] Session management with Better Auth

### Milestone 3 (Weeks 5-6)
- [ ] User interface and iframe integration
- [ ] Admin interface development
- [ ] Better Auth advanced features integration
- [ ] Security and compliance features

### Milestone 4 (Weeks 7-8)
- [ ] Auto-scaling capabilities
- [ ] Monitoring and alerting
- [ ] Performance optimization
- [ ] Documentation and testing

### Milestone 5 (Weeks 9-10)
- [ ] Production deployment
- [ ] User acceptance testing
- [ ] Security audit with Better Auth features
- [ ] Go-live preparation

## ⚠️ Risk Assessment

### Technical Risks
- **Resource Exhaustion**: Memory/CPU limits with many concurrent slots
- **Authentication Complexity**: Managing multiple auth types and tokens
- **Network Reliability**: SSH tunnel stability and performance
- **Data Isolation**: Ensuring proper separation between user slots

### Mitigation Strategies
- **Resource Monitoring**: Real-time monitoring and alerting
- **Graceful Degradation**: Handle resource constraints gracefully
- **Connection Pooling**: Optimize SSH connection management
- **Regular Audits**: Security and performance audits

### Security Considerations
- **Access Control**: Proper authentication and authorization
- **Data Encryption**: Encrypt sensitive data in transit and at rest
- **Audit Logging**: Comprehensive logging for security analysis
- **Regular Updates**: Keep dependencies updated and secure

## 📈 Success Metrics

### Technical Metrics
- **Uptime**: 99.9%+ service availability
- **Response Time**: <1s for slot initialization
- **Error Rate**: <0.1% failed requests
- **Resource Usage**: Efficient memory and CPU utilization

### User Experience Metrics
- **User Satisfaction**: High satisfaction survey results
- **Adoption Rate**: Percentage of target users actively using the system
- **Feature Usage**: Utilization of key features and capabilities
- **Support Tickets**: Low number of support requests

### Business Metrics
- **Cost Efficiency**: Optimized resource usage and costs
- **Scalability**: Ability to handle growing user base
- **ROI**: Return on investment for the implementation
- **Competitive Advantage**: Improved capabilities over alternatives

## 🏆 Conclusion

This multi-slot ClaudeBox architecture provides a robust, scalable solution for transforming the current single-user setup into a multi-user platform. The implementation leverages PM2 for reliable process management, maintains the existing iframe-based access pattern, and supports multiple authentication methods per user.

The solution is designed to scale from small team usage to enterprise-wide deployment while maintaining security, performance, and user experience. The phased approach allows for incremental implementation with minimal disruption to existing workflows.

**Key Benefits:**
- ✅ Multi-user support with isolated environments
- ✅ Scalable architecture for growing user base
- ✅ Multiple authentication methods per user
- ✅ Reliable process management with PM2
- ✅ Seamless iframe integration
- ✅ Production-ready monitoring and alerting

**Next Steps:**
1. Review and approve the implementation plan
2. Allocate resources for development
3. Begin with Milestone 1 implementation
4. Establish regular progress reviews and checkpoints

---

*Document Version: 1.0*
*Last Updated: 2024-01-15*
*Status: Planning Phase*