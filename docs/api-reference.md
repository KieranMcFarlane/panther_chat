# ClaudeBox Multi-Slot System - API Reference

## 📚 API Overview

The ClaudeBox Multi-Slot System provides a comprehensive RESTful API for managing users, slots, authentication, and system administration. This reference covers all available endpoints, request/response formats, and authentication methods.

## 🔐 Authentication

### JWT Authentication
All API requests require authentication using JWT tokens. Include the token in the Authorization header:

```http
Authorization: Bearer your_jwt_token_here
```

### API Key Authentication
For service-to-service communication, you can use API keys:

```http
Authorization: ApiKey your_api_key_here
```

### Session Management
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123",
  "provider": "claude_pro"
}

Response:
{
  "success": true,
  "data": {
    "user": {
      "id": "user_123",
      "email": "user@example.com",
      "role": "user"
    },
    "session": {
      "id": "session_123",
      "token": "jwt_token_here",
      "expiresAt": "2025-09-29T10:00:00Z"
    }
  }
}
```

## 👥 User Management API

### Get User Profile
```http
GET /api/users/profile
Authorization: Bearer jwt_token_here

Response:
{
  "success": true,
  "data": {
    "id": "user_123",
    "email": "user@example.com",
    "username": "john_doe",
    "role": "user",
    "status": "active",
    "createdAt": "2025-09-28T10:00:00Z",
    "updatedAt": "2025-09-28T10:00:00Z",
    "settings": {
      "notifications": true,
      "theme": "light",
      "language": "en"
    },
    "limits": {
      "maxSlots": 5,
      "maxConcurrentSlots": 2,
      "resourceLimits": {
        "cpu": 4,
        "memory": 8,
        "storage": 100
      }
    }
  }
}
```

### Update User Profile
```http
PUT /api/users/profile
Authorization: Bearer jwt_token_here
Content-Type: application/json

{
  "username": "john_doe_updated",
  "settings": {
    "notifications": false,
    "theme": "dark"
  }
}

Response:
{
  "success": true,
  "data": {
    "id": "user_123",
    "email": "user@example.com",
    "username": "john_doe_updated",
    "role": "user",
    "status": "active",
    "settings": {
      "notifications": false,
      "theme": "dark",
      "language": "en"
    }
  }
}
```

### Get User Slots
```http
GET /api/users/slots
Authorization: Bearer jwt_token_here

Response:
{
  "success": true,
  "data": [
    {
      "id": "slot_123",
      "name": "Development Slot",
      "status": "active",
      "userId": "user_123",
      "authType": "claude_pro",
      "createdAt": "2025-09-28T10:00:00Z",
      "resourceUsage": {
        "cpu": 1.5,
        "memory": 2.1,
        "storage": 15.3
      },
      "resourceLimits": {
        "cpu": 2,
        "memory": 4,
        "storage": 50
      }
    }
  ]
}
```

### Get User Statistics
```http
GET /api/users/statistics
Authorization: Bearer jwt_token_here
Query Parameters:
- period: daily|weekly|monthly (default: weekly)
- startDate: ISO date string (optional)
- endDate: ISO date string (optional)

Response:
{
  "success": true,
  "data": {
    "period": "weekly",
    "startDate": "2025-09-22T00:00:00Z",
    "endDate": "2025-09-29T00:00:00Z",
    "statistics": {
      "totalSlotsCreated": 3,
      "activeSlots": 2,
      "totalSessionTime": 86400000,
      "totalRequests": 1520,
      "averageResponseTime": 450,
      "resourceUsage": {
        "cpu": {
          "total": 120,
          "average": 1.2
        },
        "memory": {
          "total": 240,
          "average": 2.4
        },
        "storage": {
          "total": 120,
          "average": 12
        }
      },
      "cost": {
        "estimated": 12.50,
        "currency": "USD"
      }
    }
  }
}
```

## 🎰 Slot Management API

### Create Slot
```http
POST /api/slots
Authorization: Bearer jwt_token_here
Content-Type: application/json

{
  "name": "Development Slot",
  "description": "For development work",
  "authType": "claude_pro",
  "resourceLimits": {
    "cpu": 2,
    "memory": 4,
    "storage": 50
  },
  "environment": {
    "variables": {
      "NODE_ENV": "development",
      "DEBUG": "true"
    }
  }
}

Response:
{
  "success": true,
  "data": {
    "id": "slot_123",
    "name": "Development Slot",
    "description": "For development work",
    "status": "creating",
    "userId": "user_123",
    "authType": "claude_pro",
    "resourceLimits": {
      "cpu": 2,
      "memory": 4,
      "storage": 50
    },
    "resourceUsage": {
      "cpu": 0,
      "memory": 0,
      "storage": 0
    },
    "environment": {
      "variables": {
        "NODE_ENV": "development",
        "DEBUG": "true"
      }
    },
    "createdAt": "2025-09-28T10:00:00Z",
    "updatedAt": "2025-09-28T10:00:00Z"
  }
}
```

### Get Slot
```http
GET /api/slots/{slotId}
Authorization: Bearer jwt_token_here

Response:
{
  "success": true,
  "data": {
    "id": "slot_123",
    "name": "Development Slot",
    "description": "For development work",
    "status": "active",
    "userId": "user_123",
    "authType": "claude_pro",
    "resourceUsage": {
      "cpu": 1.2,
      "memory": 2.1,
      "storage": 15.3
    },
    "resourceLimits": {
      "cpu": 2,
      "memory": 4,
      "storage": 50
    },
    "connectionInfo": {
      "url": "https://claudebox.com/slot/slot_123",
      "port": 7681,
      "terminalUrl": "https://claudebox.com/terminal/slot_123"
    },
    "createdAt": "2025-09-28T10:00:00Z",
    "updatedAt": "2025-09-28T10:00:00Z"
  }
}
```

### Update Slot
```http
PUT /api/slots/{slotId}
Authorization: Bearer jwt_token_here
Content-Type: application/json

{
  "name": "Updated Development Slot",
  "resourceLimits": {
    "cpu": 4,
    "memory": 8,
    "storage": 100
  }
}

Response:
{
  "success": true,
  "data": {
    "id": "slot_123",
    "name": "Updated Development Slot",
    "description": "For development work",
    "status": "active",
    "resourceLimits": {
      "cpu": 4,
      "memory": 8,
      "storage": 100
    },
    "updatedAt": "2025-09-28T10:30:00Z"
  }
}
```

### Delete Slot
```http
DELETE /api/slots/{slotId}
Authorization: Bearer jwt_token_here

Response:
{
  "success": true,
  "data": {
    "message": "Slot deleted successfully",
    "slotId": "slot_123"
  }
}
```

### List Slots
```http
GET /api/slots
Authorization: Bearer jwt_token_here
Query Parameters:
- status: active|inactive|creating|deleting (optional)
- limit: number (default: 50, max: 100)
- offset: number (default: 0)
- sortBy: name|createdAt|status (default: createdAt)
- sortOrder: asc|desc (default: desc)

Response:
{
  "success": true,
  "data": {
    "slots": [
      {
        "id": "slot_123",
        "name": "Development Slot",
        "status": "active",
        "userId": "user_123",
        "createdAt": "2025-09-28T10:00:00Z"
      }
    ],
    "pagination": {
      "total": 1,
      "limit": 50,
      "offset": 0,
      "hasMore": false
    }
  }
}
```

### Start Slot
```http
POST /api/slots/{slotId}/start
Authorization: Bearer jwt_token_here

Response:
{
  "success": true,
  "data": {
    "slotId": "slot_123",
    "status": "starting",
    "message": "Slot is starting up"
  }
}
```

### Stop Slot
```http
POST /api/slots/{slotId}/stop
Authorization: Bearer jwt_token_here

Response:
{
  "success": true,
  "data": {
    "slotId": "slot_123",
    "status": "stopping",
    "message": "Slot is stopping"
  }
}
```

### Restart Slot
```http
POST /api/slots/{slotId}/restart
Authorization: Bearer jwt_token_here

Response:
{
  "success": true,
  "data": {
    "slotId": "slot_123",
    "status": "restarting",
    "message": "Slot is restarting"
  }
}
```

### Get Slot Metrics
```http
GET /api/slots/{slotId}/metrics
Authorization: Bearer jwt_token_here
Query Parameters:
- period: hour|day|week|month (default: day)
- startDate: ISO date string (optional)
- endDate: ISO date string (optional)

Response:
{
  "success": true,
  "data": {
    "slotId": "slot_123",
    "period": "day",
    "metrics": {
      "resourceUsage": {
        "cpu": [
          {"timestamp": "2025-09-28T10:00:00Z", "value": 1.2},
          {"timestamp": "2025-09-28T11:00:00Z", "value": 1.5}
        ],
        "memory": [
          {"timestamp": "2025-09-28T10:00:00Z", "value": 2.1},
          {"timestamp": "2025-09-28T11:00:00Z", "value": 2.3}
        ],
        "storage": [
          {"timestamp": "2025-09-28T10:00:00Z", "value": 15.3},
          {"timestamp": "2025-09-28T11:00:00Z", "value": 16.1}
        ]
      },
      "performance": {
        "responseTime": [
          {"timestamp": "2025-09-28T10:00:00Z", "value": 450},
          {"timestamp": "2025-09-28T11:00:00Z", "value": 380}
        ],
        "throughput": [
          {"timestamp": "2025-09-28T10:00:00Z", "value": 120},
          {"timestamp": "2025-09-28T11:00:00Z", "value": 150}
        ]
      },
      "activity": {
        "requests": 1520,
        "activeConnections": 3,
        "uptime": 86400
      }
    }
  }
}
```

## 🔐 Authentication API

### Configure Slot Authentication
```http
POST /api/slots/{slotId}/auth
Authorization: Bearer jwt_token_here
Content-Type: application/json

{
  "authType": "claude_pro",
  "config": {
    "apiKey": "sk-ant-api03-...",
    "baseUrl": "https://api.anthropic.com",
    "model": "claude-3-sonnet-20240229"
  }
}

Response:
{
  "success": true,
  "data": {
    "slotId": "slot_123",
    "authType": "claude_pro",
    "status": "configured",
    "config": {
      "provider": "claude_pro",
      "apiKey": "sk-ant-api03-...",
      "baseUrl": "https://api.anthropic.com",
      "model": "claude-3-sonnet-20240229"
    },
    "validatedAt": "2025-09-28T10:00:00Z"
  }
}
```

### Validate Authentication
```http
POST /api/slots/{slotId}/auth/validate
Authorization: Bearer jwt_token_here

Response:
{
  "success": true,
  "data": {
    "slotId": "slot_123",
    "valid": true,
    "validatedAt": "2025-09-28T10:00:00Z",
    "expiresAt": "2025-09-29T10:00:00Z",
    "details": {
      "provider": "claude_pro",
      "apiKey": "sk-ant-api03-...",
      "model": "claude-3-sonnet-20240229"
    }
  }
}
```

### Refresh Authentication
```http
POST /api/slots/{slotId}/auth/refresh
Authorization: Bearer jwt_token_here

Response:
{
  "success": true,
  "data": {
    "slotId": "slot_123",
    "status": "refreshed",
    "newToken": "new_jwt_token_here",
    "expiresAt": "2025-09-29T10:00:00Z"
  }
}
```

### Get Authentication Status
```http
GET /api/slots/{slotId}/auth/status
Authorization: Bearer jwt_token_here

Response:
{
  "success": true,
  "data": {
    "slotId": "slot_123",
    "authType": "claude_pro",
    "status": "active",
    "configuredAt": "2025-09-28T10:00:00Z",
    "validatedAt": "2025-09-28T10:00:00Z",
    "expiresAt": "2025-09-29T10:00:00Z",
    "lastUsedAt": "2025-09-28T10:00:00Z"
  }
}
```

### List Available Authentication Providers
```http
GET /api/auth/providers
Authorization: Bearer jwt_token_here

Response:
{
  "success": true,
  "data": {
    "providers": [
      {
        "id": "claude_pro",
        "name": "Claude Pro",
        "description": "Claude Pro subscription authentication",
        "configurable": true,
        "requiredFields": ["apiKey", "baseUrl", "model"]
      },
      {
        "id": "claude_api_key",
        "name": "Claude API Key",
        "description": "Anthropic API key authentication",
        "configurable": true,
        "requiredFields": ["apiKey", "baseUrl"]
      },
      {
        "id": "google_oauth",
        "name": "Google OAuth",
        "description": "Google OAuth2 authentication",
        "configurable": true,
        "requiredFields": ["clientId", "clientSecret", "redirectUri"]
      },
      {
        "id": "github_oauth",
        "name": "GitHub OAuth",
        "description": "GitHub OAuth2 authentication",
        "configurable": true,
        "requiredFields": ["clientId", "clientSecret", "redirectUri"]
      }
    ]
  }
}
```

## 📊 System Administration API

### System Health Check
```http
GET /api/admin/health
Authorization: Bearer admin_jwt_token_here

Response:
{
  "success": true,
  "data": {
    "overall": "healthy",
    "components": [
      {
        "name": "database",
        "status": "healthy",
        "responseTime": 15,
        "lastChecked": "2025-09-28T10:00:00Z"
      },
      {
        "name": "authentication",
        "status": "healthy",
        "responseTime": 25,
        "lastChecked": "2025-09-28T10:00:00Z"
      },
      {
        "name": "slot_service",
        "status": "healthy",
        "responseTime": 30,
        "lastChecked": "2025-09-28T10:00:00Z"
      },
      {
        "name": "load_balancer",
        "status": "healthy",
        "responseTime": 5,
        "lastChecked": "2025-09-28T10:00:00Z"
      }
    ],
    "timestamp": "2025-09-28T10:00:00Z"
  }
}
```

### System Metrics
```http
GET /api/admin/metrics
Authorization: Bearer admin_jwt_token_here
Query Parameters:
- period: hour|day|week|month (default: day)
- type: system|application|business|all (default: all)

Response:
{
  "success": true,
  "data": {
    "period": "day",
    "system": {
      "cpu": {
        "current": 45.2,
        "average": 42.1,
        "max": 68.5,
        "min": 25.3
      },
      "memory": {
        "current": 65.8,
        "average": 62.3,
        "max": 78.2,
        "min": 45.1,
        "total": 16384,
        "available": 5596
      },
      "disk": {
        "current": 342.5,
        "total": 1000,
        "available": 657.5,
        "usage": 34.25
      },
      "network": {
        "incoming": 1542000,
        "outgoing": 2345000,
        "total": 3887000
      }
    },
    "application": {
      "activeUsers": 145,
      "activeSlots": 89,
      "totalRequests": 12580,
      "averageResponseTime": 420,
      "errorRate": 0.8,
      "uptime": 99.98
    },
    "business": {
      "newUsers": 12,
      "slotsCreated": 8,
      "revenue": 245.50,
      "conversionRate": 3.2
    }
  }
}
```

### User Management (Admin)
```http
GET /api/admin/users
Authorization: Bearer admin_jwt_token_here
Query Parameters:
- status: active|inactive|all (default: active)
- role: admin|user|readonly|all (default: all)
- search: string (optional)
- limit: number (default: 50, max: 100)
- offset: number (default: 0)

Response:
{
  "success": true,
  "data": {
    "users": [
      {
        "id": "user_123",
        "email": "user@example.com",
        "username": "john_doe",
        "role": "user",
        "status": "active",
        "createdAt": "2025-09-28T10:00:00Z",
        "lastLoginAt": "2025-09-28T09:30:00Z",
        "slotCount": 2,
        "totalSessionTime": 86400000
      }
    ],
    "pagination": {
      "total": 1,
      "limit": 50,
      "offset": 0,
      "hasMore": false
    }
  }
}
```

### Create User (Admin)
```http
POST /api/admin/users
Authorization: Bearer admin_jwt_token_here
Content-Type: application/json

{
  "email": "newuser@example.com",
  "username": "new_user",
  "password": "secure_password123",
  "role": "user",
  "status": "active"
}

Response:
{
  "success": true,
  "data": {
    "id": "user_456",
    "email": "newuser@example.com",
    "username": "new_user",
    "role": "user",
    "status": "active",
    "createdAt": "2025-09-28T10:00:00Z"
  }
}
```

### Update User (Admin)
```http
PUT /api/admin/users/{userId}
Authorization: Bearer admin_jwt_token_here
Content-Type: application/json

{
  "role": "admin",
  "status": "active",
  "limits": {
    "maxSlots": 10,
    "maxConcurrentSlots": 5,
    "resourceLimits": {
      "cpu": 8,
      "memory": 16,
      "storage": 200
    }
  }
}

Response:
{
  "success": true,
  "data": {
    "id": "user_123",
    "email": "user@example.com",
    "username": "john_doe",
    "role": "admin",
    "status": "active",
    "limits": {
      "maxSlots": 10,
      "maxConcurrentSlots": 5,
      "resourceLimits": {
        "cpu": 8,
        "memory": 16,
        "storage": 200
      }
    },
    "updatedAt": "2025-09-28T10:30:00Z"
  }
}
```

### Delete User (Admin)
```http
DELETE /api/admin/users/{userId}
Authorization: Bearer admin_jwt_token_here

Response:
{
  "success": true,
  "data": {
    "message": "User deleted successfully",
    "userId": "user_123"
  }
}
```

### System Configuration (Admin)
```http
GET /api/admin/config
Authorization: Bearer admin_jwt_token_here

Response:
{
  "success": true,
  "data": {
    "system": {
      "name": "ClaudeBox Multi-Slot",
      "version": "1.0.0",
      "environment": "production",
      "maxConcurrentSlots": 100,
      "defaultResourceLimits": {
        "cpu": 2,
        "memory": 4,
        "storage": 50
      }
    },
    "authentication": {
      "providers": ["claude_pro", "claude_api_key", "google_oauth", "github_oauth"],
      "sessionTimeout": 86400000,
      "maxLoginAttempts": 5,
      "lockoutDuration": 900000
    },
    "features": {
      "autoScaling": true,
      "backup": true,
      "monitoring": true,
      "alerting": true
    }
  }
}
```

### Update System Configuration (Admin)
```http
PUT /api/admin/config
Authorization: Bearer admin_jwt_token_here
Content-Type: application/json

{
  "system": {
    "maxConcurrentSlots": 150,
    "defaultResourceLimits": {
      "cpu": 4,
      "memory": 8,
      "storage": 100
    }
  },
  "authentication": {
    "sessionTimeout": 172800000,
    "maxLoginAttempts": 10
  }
}

Response:
{
  "success": true,
  "data": {
    "message": "Configuration updated successfully",
    "updatedFields": ["system.maxConcurrentSlots", "system.defaultResourceLimits", "authentication.sessionTimeout", "authentication.maxLoginAttempts"],
    "updatedAt": "2025-09-28T10:30:00Z"
  }
}
```

## 📈 Analytics API

### Usage Analytics
```http
GET /api/analytics/usage
Authorization: Bearer jwt_token_here
Query Parameters:
- period: hour|day|week|month|year (default: week)
- type: users|slots|requests|revenue|all (default: all)
- startDate: ISO date string (optional)
- endDate: ISO date string (optional)

Response:
{
  "success": true,
  "data": {
    "period": "week",
    "startDate": "2025-09-22T00:00:00Z",
    "endDate": "2025-09-29T00:00:00Z",
    "analytics": {
      "users": {
        "total": 1250,
        "active": 890,
        "new": 45,
        "returning": 120,
        "growth": 3.6
      },
      "slots": {
        "total": 2100,
        "active": 1580,
        "created": 120,
        "deleted": 45,
        "utilization": 75.2
      },
      "requests": {
        "total": 456780,
        "successful": 453210,
        "failed": 3570,
        "successRate": 99.2,
        "averageResponseTime": 420
      },
      "revenue": {
        "total": 4567.80,
        "currency": "USD",
        "growth": 12.5
      }
    }
  }
}
```

### Performance Analytics
```http
GET /api/analytics/performance
Authorization: Bearer jwt_token_here
Query Parameters:
- period: hour|day|week|month (default: day)
- metric: response_time|throughput|error_rate|resource_usage|all (default: all)

Response:
{
  "success": true,
  "data": {
    "period": "day",
    "metrics": {
      "responseTime": {
        "average": 420,
        "p50": 350,
        "p95": 1200,
        "p99": 2500,
        "max": 5800
      },
      "throughput": {
        "requestsPerSecond": 15.2,
        "peak": 28.5,
        "total": 1313280
      },
      "errorRate": {
        "total": 0.8,
        "byType": {
          "authentication": 0.2,
          "authorization": 0.1,
          "validation": 0.3,
          "server": 0.2
        }
      },
      "resourceUsage": {
        "cpu": {
          "average": 42.1,
          "peak": 68.5,
          "utilization": 52.6
        },
        "memory": {
          "average": 62.3,
          "peak": 78.2,
          "utilization": 63.1
        },
        "storage": {
          "total": 342.5,
          "available": 657.5,
          "utilization": 34.3
        }
      }
    }
  }
}
```

## 🚨 Error Handling

### Standard Error Response
```http
HTTP/1.1 400 Bad Request
Content-Type: application/json

{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request data",
    "details": {
      "field": "email",
      "message": "Email is required"
    },
    "timestamp": "2025-09-28T10:00:00Z",
    "requestId": "req_123"
  }
}
```

### Authentication Error
```http
HTTP/1.1 401 Unauthorized
Content-Type: application/json

{
  "success": false,
  "error": {
    "code": "AUTHENTICATION_ERROR",
    "message": "Invalid or expired token",
    "timestamp": "2025-09-28T10:00:00Z",
    "requestId": "req_123"
  }
}
```

### Authorization Error
```http
HTTP/1.1 403 Forbidden
Content-Type: application/json

{
  "success": false,
  "error": {
    "code": "AUTHORIZATION_ERROR",
    "message": "Insufficient permissions",
    "requiredPermission": "users:write",
    "userPermissions": ["users:read"],
    "timestamp": "2025-09-28T10:00:00Z",
    "requestId": "req_123"
  }
}
```

### Resource Not Found
```http
HTTP/1.1 404 Not Found
Content-Type: application/json

{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Resource not found",
    "resource": "slot",
    "resourceId": "slot_999",
    "timestamp": "2025-09-28T10:00:00Z",
    "requestId": "req_123"
  }
}
```

### Rate Limit Error
```http
HTTP/1.1 429 Too Many Requests
Content-Type: application/json

{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests",
    "limit": 100,
    "window": "60s",
    "retryAfter": 30,
    "timestamp": "2025-09-28T10:00:00Z",
    "requestId": "req_123"
  }
}
```

### Server Error
```http
HTTP/1.1 500 Internal Server Error
Content-Type: application/json

{
  "success": false,
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "Internal server error",
    "timestamp": "2025-09-28T10:00:00Z",
    "requestId": "req_123"
  }
}
```

## 🔄 Webhooks

### Webhook Configuration
```http
POST /api/admin/webhooks
Authorization: Bearer admin_jwt_token_here
Content-Type: application/json

{
  "url": "https://your-webhook-url.com",
  "events": ["slot.created", "slot.deleted", "user.created"],
  "secret": "your_webhook_secret",
  "active": true
}

Response:
{
  "success": true,
  "data": {
    "id": "webhook_123",
    "url": "https://your-webhook-url.com",
    "events": ["slot.created", "slot.deleted", "user.created"],
    "secret": "your_webhook_secret",
    "active": true,
    "createdAt": "2025-09-28T10:00:00Z"
  }
}
```

### Webhook Payload Example
```json
{
  "event": "slot.created",
  "timestamp": "2025-09-28T10:00:00Z",
  "data": {
    "slot": {
      "id": "slot_123",
      "name": "Development Slot",
      "userId": "user_123",
      "status": "creating",
      "createdAt": "2025-09-28T10:00:00Z"
    }
  },
  "signature": "sha256=..."
}
```

## 📚 SDK Examples

### JavaScript SDK
```javascript
import { ClaudeBoxAPI } from '@claudebox/sdk';

const api = new ClaudeBoxAPI({
  baseURL: 'https://api.claudebox.com',
  apiKey: 'your_api_key_here'
});

// Create a user
const user = await api.users.create({
  email: 'user@example.com',
  username: 'john_doe',
  password: 'secure_password123'
});

// Create a slot
const slot = await api.slots.create({
  name: 'Development Slot',
  authType: 'claude_pro',
  resourceLimits: {
    cpu: 2,
    memory: 4,
    storage: 50
  }
});

// Get slot metrics
const metrics = await api.slots.getMetrics(slot.id, {
  period: 'day'
});
```

### Python SDK
```python
from claudebox import ClaudeBoxAPI

api = ClaudeBoxAPI(
    base_url='https://api.claudebox.com',
    api_key='your_api_key_here'
)

# Create a user
user = api.users.create(
    email='user@example.com',
    username='john_doe',
    password='secure_password123'
)

# Create a slot
slot = api.slots.create(
    name='Development Slot',
    auth_type='claude_pro',
    resource_limits={
        'cpu': 2,
        'memory': 4,
        'storage': 50
    }
)

# Get slot metrics
metrics = api.slots.get_metrics(slot.id, period='day')
```

### cURL Examples
```bash
# Login
curl -X POST https://api.claudebox.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password123","provider":"claude_pro"}'

# Create slot
curl -X POST https://api.claudebox.com/api/slots \
  -H "Authorization: Bearer your_jwt_token" \
  -H "Content-Type: application/json" \
  -d '{"name":"Development Slot","authType":"claude_pro","resourceLimits":{"cpu":2,"memory":4,"storage":50}}'

# Get user slots
curl -X GET https://api.claudebox.com/api/users/slots \
  -H "Authorization: Bearer your_jwt_token"
```

---

*Last Updated: September 28, 2025*  
*Version: 1.0.0*