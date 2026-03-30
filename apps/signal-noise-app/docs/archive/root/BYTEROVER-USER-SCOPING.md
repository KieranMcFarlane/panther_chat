# ByteRover User Scoping & Multi-Tenancy Guide

## Overview

This guide defines how Signal Noise App handles user scoping and data isolation with ByteRover integration for contact intelligence and memory management.

## Architecture Summary

### Current State
- **Authentication**: Better Auth with role-based access control
- **Database**: Neo4j knowledge graph + Supabase cache layer
- **API Layer**: 167 endpoints with authentication middleware
- **User Management**: Individual user sessions and permissions

### ByteRover Integration Requirements
- **Tenant Isolation**: Complete data separation between organizations
- **User Scoping**: Individual user access within tenant boundaries
- **Contact Intelligence**: Shared memory systems with permission controls
- **Cross-Tenant Collaboration**: Optional shared intelligence with explicit permissions

## Scoping Hierarchy

```
Global (System-wide)
├── Tenant (Organization)
│   ├── Team (Department/Group)
│   │   └── User (Individual)
│   └── User (Individual)
└── User (System admin)
```

## Data Classification System

### 1. Scope Levels

#### **Global Scope**
- **Definition**: System-wide knowledge available to all tenants
- **Examples**: Industry trends, public sports data, market intelligence
- **Storage**: `tenant_id = NULL` in database
- **Access**: All authenticated users
- **Visual Indicator**: 🌐 Global

#### **Tenant Scope**
- **Definition**: Organization-specific data and intelligence
- **Examples**: Customer relationships, internal contacts, proprietary research
- **Storage**: `tenant_id = [organization_id]`
- **Access**: All users within the tenant
- **Visual Indicator**: 🏢 Organization

#### **Team Scope**
- **Definition**: Department or group-specific data within tenant
- **Examples**: Sales team contacts, marketing campaign data
- **Storage**: `tenant_id + team_id`
- **Access**: Team members within tenant
- **Visual Indicator**: 👥 Team

#### **User Scope**
- **Definition**: Individual user's private data and preferences
- **Examples**: Personal notes, individual contacts, private research
- **Storage**: `tenant_id + user_id + access_level = 'private'`
- **Access**: Specific user only
- **Visual Indicator**: 🔒 Private

### 2. Access Control Matrix

| Scope | User | Team | Tenant | Global |
|-------|------|------|--------|--------|
| **Private** | ✅ | ❌ | ❌ | ❌ |
| **Team** | ✅ | ✅ | ❌ | ❌ |
| **Tenant** | ✅ | ✅ | ✅ | ❌ |
| **Shared** | ✅* | ✅* | ✅* | ✅ |
| **Global** | ✅ | ✅ | ✅ | ✅ |

*With explicit permission grants

## Database Schema Design

### Supabase Tables

#### Core Scoping Table
```sql
CREATE TABLE data_scopes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_type TEXT NOT NULL CHECK (scope_type IN ('global', 'tenant', 'team', 'user')),
  tenant_id UUID REFERENCES tenants(id),
  team_id UUID REFERENCES teams(id),
  user_id UUID REFERENCES users(id),
  access_level TEXT NOT NULL DEFAULT 'tenant' 
    CHECK (access_level IN ('private', 'team', 'tenant', 'shared', 'global')),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(tenant_id, team_id, user_id, scope_type)
);
```

#### ByteRover Memory Table
```sql
CREATE TABLE byterover_memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_id UUID REFERENCES data_scopes(id),
  contact_id UUID REFERENCES contacts(id),
  memory_type TEXT NOT NULL CHECK (memory_type IN ('contact', 'opportunity', 'interaction', 'research')),
  intelligence_data JSONB NOT NULL,
  confidence_score DECIMAL(3,2) DEFAULT 0.50,
  source_system TEXT DEFAULT 'byterover',
  is_verified BOOLEAN DEFAULT false,
  sharing_permissions JSONB DEFAULT '[]'::jsonb, -- Array of tenant/team/user IDs
  embargo_until TIMESTAMP,
  expires_at TIMESTAMP,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### Contacts Table (Enhanced)
```sql
CREATE TABLE contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_id UUID REFERENCES data_scopes(id),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  organization TEXT,
  title TEXT,
  entity_id UUID REFERENCES entities(id), -- Link to Neo4j sports entities
  contact_source TEXT DEFAULT 'manual',
  is_primary_contact BOOLEAN DEFAULT false,
  contact_quality_score DECIMAL(3,2) DEFAULT 0.50,
  last_contacted TIMESTAMP,
  preferred_communication TEXT DEFAULT 'email',
  notes TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Neo4j Graph Patterns

#### User-Entity Relationships
```cypher
// User belongs to tenant
(:User {id: $user_id})-[:BELONGS_TO]->(:Tenant {id: $tenant_id})

// User belongs to team (optional)
(:User {id: $user_id})-[:MEMBER_OF]->(:Team {id: $team_id})-[:PART_OF]->(:Tenant {id: $tenant_id})

// User has access to contacts
(:User {id: $user_id})-[:CAN_ACCESS]->(:Contact {scope_level: $access_level})

// Contact belongs to entity
(:Contact {id: $contact_id})-[:WORKS_AT]->(:Entity {id: $entity_id})

// Memory about contact/entity
(:Memory {id: $memory_id})-[:ABOUT]->(:Contact {id: $contact_id})
(:Memory {id: $memory_id})-[:HAS_SCOPE]->(:Scope {level: $scope_level})
```

## API Implementation

### Middleware Stack

```typescript
// 1. Authentication (Better Auth)
app.use(authMiddleware);

// 2. Tenant Resolution
app.use(tenantResolutionMiddleware);

// 3. User Context
app.use(userContextMiddleware);

// 4. Scope Validation
app.use(scopeValidationMiddleware);
```

### Middleware Implementation

#### Tenant Resolution
```typescript
interface TenantContext {
  tenant_id: string;
  user_id: string;
  team_ids: string[];
  role: 'admin' | 'user' | 'viewer';
  permissions: string[];
}

function tenantResolutionMiddleware(req: Request, res: Response, next: NextFunction) {
  const user = req.user; // From Better Auth
  const tenantId = req.headers['x-tenant-id'] || user.default_tenant;
  
  // Validate user belongs to tenant
  if (!user.tenants.includes(tenantId)) {
    return res.status(403).json({ error: 'Unauthorized tenant access' });
  }
  
  req.tenant = {
    tenant_id: tenantId,
    user_id: user.id,
    team_ids: user.teams[tenantId] || [],
    role: user.roles[tenantId] || 'user',
    permissions: user.permissions[tenantId] || []
  };
  
  next();
}
```

#### Scope Validation
```typescript
function scopeValidationMiddleware(req: Request, res: Response, next: NextFunction) {
  const { tenant } = req;
  const requestedScope = req.query.scope || 'tenant';
  const targetUserId = req.params.user_id;
  const targetTeamId = req.params.team_id;
  
  // Validate scope access
  switch (requestedScope) {
    case 'private':
      if (targetUserId !== tenant.user_id && tenant.role !== 'admin') {
        return res.status(403).json({ error: 'Cannot access private data' });
      }
      break;
      
    case 'team':
      if (!tenant.team_ids.includes(targetTeamId) && tenant.role !== 'admin') {
        return res.status(403).json({ error: 'Cannot access team data' });
      }
      break;
      
    case 'tenant':
      // All authenticated users can access tenant data
      break;
      
    case 'global':
      // All authenticated users can access global data
      break;
  }
  
  req.scope = {
    type: requestedScope,
    tenant_id: tenant.tenant_id,
    user_id: targetUserId || tenant.user_id,
    team_id: targetTeamId
  };
  
  next();
}
```

### ByteRover Integration Endpoints

#### Memory Storage with Scoping
```typescript
app.post('/api/byterover/memory', async (req, res) => {
  const { scope } = req;
  const { 
    contact_id, 
    memory_type, 
    intelligence_data, 
    access_level = 'tenant',
    sharing_permissions = []
  } = req.body;
  
  // Determine scope_id based on access level
  let scope_id;
  switch (access_level) {
    case 'private':
      scope_id = await getScopeId(scope.tenant_id, null, scope.user_id, 'user');
      break;
    case 'team':
      scope_id = await getScopeId(scope.tenant_id, scope.team_id, null, 'team');
      break;
    case 'tenant':
      scope_id = await getScopeId(scope.tenant_id, null, null, 'tenant');
      break;
    case 'global':
      scope_id = await getScopeId(null, null, null, 'global');
      break;
  }
  
  const memory = await supabase.from('byterover_memories').insert({
    scope_id,
    contact_id,
    memory_type,
    intelligence_data,
    access_level,
    sharing_permissions,
    created_by: scope.user_id
  });
  
  res.json(memory);
});
```

#### Memory Retrieval with Scope Filtering
```typescript
app.get('/api/byterover/memory', async (req, res) => {
  const { scope } = req;
  const { 
    contact_id, 
    memory_type, 
    include_shared = true,
    include_global = true 
  } = req.query;
  
  let query = supabase
    .from('byterover_memories')
    .select(`
      *,
      data_scopes!inner(
        scope_type,
        tenant_id,
        team_id,
        user_id
      ),
      contacts(
        first_name,
        last_name,
        organization,
        title
      )
    `);
  
  // Base scope filtering
  const scopeConditions = [];
  
  // User's own data (any access level)
  scopeConditions.push(`data_scopes.user_id = '${scope.user_id}'`);
  
  // Team data
  if (scope.team_ids.length > 0) {
    scopeConditions.push(`data_scopes.team_id IN (${scope.team_ids.map(id => `'${id}'`).join(',')})`);
  }
  
  // Tenant data
  scopeConditions.push(`data_scopes.tenant_id = '${scope.tenant_id}' AND data_scopes.scope_type = 'tenant'`);
  
  // Shared data
  if (include_shared === 'true') {
    scopeConditions.push(`'${scope.tenant_id}' = ANY(sharing_permissions)`);
  }
  
  // Global data
  if (include_global === 'true') {
    scopeConditions.push(`data_scopes.scope_type = 'global'`);
  }
  
  query = query.or(scopeConditions.join(','));
  
  // Additional filters
  if (contact_id) query = query.eq('contact_id', contact_id);
  if (memory_type) query = query.eq('memory_type', memory_type);
  
  const { data, error } = await query.order('created_at', { ascending: false });
  
  res.json({ memories: data, error });
});
```

## Frontend Implementation

### Context Providers

#### Scoping Context
```typescript
interface ScopingContext {
  user: User;
  tenant: TenantContext;
  currentScope: {
    type: 'private' | 'team' | 'tenant' | 'global';
    team_id?: string;
  };
  setCurrentScope: (scope: any) => void;
  hasPermission: (permission: string) => boolean;
  canAccess: (resourceScope: any) => boolean;
}

const ScopingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [tenant, setTenant] = useState<TenantContext | null>(null);
  const [currentScope, setCurrentScope] = useState({
    type: 'tenant' as const
  });
  
  const hasPermission = useCallback((permission: string) => {
    return tenant?.permissions.includes(permission) || tenant?.role === 'admin';
  }, [tenant]);
  
  const canAccess = useCallback((resourceScope: any) => {
    if (!tenant) return false;
    
    switch (resourceScope.type) {
      case 'private':
        return resourceScope.user_id === tenant.user_id;
      case 'team':
        return tenant.team_ids.includes(resourceScope.team_id);
      case 'tenant':
        return resourceScope.tenant_id === tenant.tenant_id;
      case 'global':
        return true;
      default:
        return false;
    }
  }, [tenant]);
  
  return (
    <ScopingContext.Provider value={{
      user,
      tenant,
      currentScope,
      setCurrentScope,
      hasPermission,
      canAccess
    }}>
      {children}
    </ScopingContext.Provider>
  );
};
```

### UI Components

#### Scope Selector
```typescript
const ScopeSelector: React.FC = () => {
  const { tenant, currentScope, setCurrentScope } = useScoping();
  
  const scopeOptions = [
    { value: 'private', label: 'Private', icon: '🔒' },
    { value: 'team', label: 'Team', icon: '👥', disabled: tenant.team_ids.length === 0 },
    { value: 'tenant', label: 'Organization', icon: '🏢' },
    { value: 'global', label: 'Global', icon: '🌐' }
  ];
  
  return (
    <div className="flex items-center space-x-2">
      <span className="text-sm font-medium">Scope:</span>
      <Select value={currentScope.type} onValueChange={(value) => setCurrentScope({ type: value })}>
        {scopeOptions.map(option => (
          <SelectOption 
            key={option.value} 
            value={option.value}
            disabled={option.disabled}
          >
            <span className="mr-2">{option.icon}</span>
            {option.label}
          </SelectOption>
        ))}
      </Select>
    </div>
  );
};
```

#### Memory Card with Scope Indicators
```typescript
const MemoryCard: React.FC<{ memory: ByteRoverMemory }> = ({ memory }) => {
  const { canAccess } = useScoping();
  
  if (!canAccess(memory.data_scopes)) {
    return null;
  }
  
  const getScopeIcon = (scopeType: string) => {
    switch (scopeType) {
      case 'private': return '🔒';
      case 'team': return '👥';
      case 'tenant': return '🏢';
      case 'global': return '🌐';
      default: return '📄';
    }
  };
  
  return (
    <Card className="mb-4">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-lg">{getScopeIcon(memory.data_scopes.scope_type)}</span>
            <h3 className="font-semibold">{memory.contacts?.full_name}</h3>
          </div>
          <Badge variant="secondary">{memory.memory_type}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-gray-600 mb-2">
          {memory.intelligence_data.summary}
        </p>
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>Confidence: {Math.round(memory.confidence_score * 100)}%</span>
          <span>{new Date(memory.created_at).toLocaleDateString()}</span>
        </div>
      </CardContent>
    </Card>
  );
};
```

## MCP Integration Patterns

### ByteRover MCP Client with Scoping
```typescript
class ScopedByteRoverClient {
  constructor(private tenantContext: TenantContext) {}
  
  async storeMemory(data: {
    contact_id: string;
    intelligence: any;
    access_level: 'private' | 'team' | 'tenant' | 'global';
    sharing_permissions?: string[];
  }) {
    return await mcpClient.storeMemory({
      ...data,
      tenant_id: this.tenantContext.tenant_id,
      user_id: this.tenantContext.user_id,
      team_ids: this.tenantContext.team_ids,
      scope: data.access_level
    });
  }
  
  async retrieveMemory(query: {
    text: string;
    scope?: string[];
    contact_id?: string;
  }) {
    const scopedQuery = {
      ...query,
      tenant_id: this.tenantContext.tenant_id,
      user_id: this.tenantContext.user_id,
      team_ids: this.tenantContext.team_ids,
      scope: query.scope || ['private', 'team', 'tenant', 'global']
    };
    
    return await mcpClient.retrieveMemory(scopedQuery);
  }
}
```

## Implementation Checklist

### Phase 1: Foundation
- [ ] Implement data_scopes table
- [ ] Add tenant_id columns to existing tables
- [ ] Create scoping middleware
- [ ] Implement scope validation
- [ ] Add row-level security policies

### Phase 2: ByteRover Integration
- [ ] Create byterover_memories table
- [ ] Implement scoped MCP client
- [ ] Add scoping context provider
- [ ] Create scope-aware API endpoints
- [ ] Build UI components for scope selection

### Phase 3: Advanced Features
- [ ] Implement cross-tenant sharing
- [ ] Add embargo and expiration features
- [ ] Create advanced permission system
- [ ] Implement audit logging
- [ ] Add data residency controls

### Phase 4: Monitoring & Compliance
- [ ] Add access logging
- [ ] Implement data classification
- [ ] Create compliance reports
- [ ] Add data retention policies
- [ ] Implement GDPR controls

## Migration Strategy

### Existing Data
1. **Audit current data** - Identify existing records without tenant context
2. **Create default tenant** - Migrate orphaned data to default organization
3. **Implement scoping gradually** - Start with new data, migrate existing records
4. **Backwards compatibility** - Maintain API compatibility during transition

### User Migration
1. **User onboarding** - Assign existing users to appropriate tenants
2. **Permission mapping** - Convert existing roles to new permission system
3. **Data access review** - Validate data access permissions post-migration
4. **User communication** - Communicate changes and provide training

## Security Considerations

### Data Isolation
- **Database level**: Row-level security + tenant isolation
- **API level**: Scope validation + permission checks
- **Application level**: Context-based filtering + UI indicators

### Access Control
- **Principle of least privilege**: Default to minimal access
- **Audit trails**: Log all access and modifications
- **Permission escalation**: Require explicit approval for elevated access

### Compliance
- **Data residency**: Control where data is stored
- **Retention policies**: Automatic cleanup of expired data
- **Right to deletion**: Complete data removal on request

This scoping system ensures proper data isolation while enabling flexible collaboration patterns across the Signal Noise App with ByteRover integration.