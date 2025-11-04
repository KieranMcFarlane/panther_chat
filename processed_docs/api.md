# 🔌 Yellow Panther AI - API Documentation

Complete API reference for the Yellow Panther AI Sports Intelligence Platform.

## 📚 Table of Contents

- [Authentication](#authentication)
- [Sports Intelligence APIs](#sports-intelligence-apis)
- [RFP Processing APIs](#rfp-processing-apis)
- [LinkedIn Intelligence APIs](#linkedin-intelligence-apis)
- [Knowledge Graph APIs](#knowledge-graph-apis)
- [Real-time APIs](#real-time-apis)
- [Error Handling](#error-handling)
- [Rate Limiting](#rate-limiting)

## 🔐 Authentication

All admin endpoints require JWT authentication via cookies or Authorization header.

### Login
```http
POST /api/auth
Content-Type: application/json

{
  "username": "admin",
  "password": "yellowpanther2024"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "user": {
    "username": "admin",
    "role": "admin"
  }
}
```

### Check Authentication Status
```http
GET /api/auth
```

**Response:**
```json
{
  "authenticated": true,
  "user": {
    "username": "admin",
    "role": "admin"
  }
}
```

### Logout
```http
DELETE /api/auth
```

## ⚽ Sports Intelligence APIs

### Premier League Intelligence

#### List All Clubs
```http
GET /api/sports/premier-league?action=list
```

**Response:**
```json
{
  "clubs": ["Arsenal FC", "Manchester United FC", "..."],
  "total": 20
}
```

#### Research Specific Club
```http
GET /api/sports/premier-league?action=research&club=arsenal-fc
```

**Response:**
```json
{
  "club": "arsenal-fc",
  "intelligence": {
    "digitalMaturity": 82,
    "opportunities": ["Mobile app development", "Fan engagement platform"],
    "stakeholders": [...],
    "recentActivity": [...]
  }
}
```

#### Research All Clubs
```http
GET /api/sports/premier-league?action=research-all
```

#### Custom Club Research
```http
POST /api/sports/premier-league
Content-Type: application/json

{
  "club": "arsenal-fc",
  "query": "digital transformation initiatives"
}
```

### Rugby Union Intelligence

#### List All Teams
```http
GET /api/sports/rugby?action=list
```

**Response:**
```json
{
  "teams": ["saracens", "leicester-tigers", "bath-rugby", "exeter-chiefs", "harlequins"],
  "total": 5,
  "data": {
    "saracens": {
      "name": "Saracens",
      "league": "Premiership",
      "location": "London",
      "founded": 1876,
      "stadium": "StoneX Stadium"
    }
  }
}
```

#### Get Team Information
```http
GET /api/sports/rugby?action=team-info&team=saracens
```

#### Team Intelligence Analysis
```http
GET /api/sports/rugby?action=intelligence&team=saracens
```

## 📋 RFP Processing APIs

### List RFPs
```http
GET /api/rfp?limit=20&category=Mobile%20App&status=open&minScore=0.8
```

**Query Parameters:**
- `limit` (number): Maximum results to return (default: 20)
- `category` (string): Filter by RFP category
- `status` (string): Filter by status (open, closed, awarded)
- `minScore` (number): Minimum relevance score (0-1)

**Response:**
```json
{
  "rfps": [
    {
      "id": "rfp-001",
      "title": "Premier League Mobile Fan Engagement Platform",
      "organization": "Premier League",
      "description": "Development of a comprehensive mobile application...",
      "value": "£2.5M",
      "location": "London, UK",
      "deadline": "2024-03-15",
      "publishDate": "2024-01-15",
      "category": "Mobile App Development",
      "status": "open",
      "relevanceScore": 0.92,
      "opportunityType": "mobile-app"
    }
  ],
  "total": 1,
  "filters": {
    "category": "Mobile App",
    "status": "open",
    "minScore": 0.8
  },
  "timestamp": "2024-01-25T10:30:00Z"
}
```

### Analyze RFP
```http
POST /api/rfp
Content-Type: application/json

{
  "action": "analyze",
  "url": "https://example.com/rfp",
  "content": "RFP content here...",
  "title": "Mobile App Development RFP"
}
```

**Response:**
```json
{
  "success": true,
  "analysis": {
    "id": "rfp-1234567890",
    "title": "Mobile App Development RFP",
    "url": "https://example.com/rfp",
    "relevanceScore": 0.87,
    "keywords": ["mobile app", "sports", "fan engagement", "digital platform"],
    "estimatedValue": 1250000,
    "competition": "medium",
    "suitability": "high",
    "nextSteps": [
      "Schedule discovery call",
      "Prepare capability statement",
      "Identify key stakeholders"
    ],
    "deadline": "2024-02-24",
    "analysis": {
      "technicalRequirements": ["React Native", "Node.js", "Real-time data"],
      "businessRequirements": ["Fan engagement", "Mobile-first", "Scalable architecture"],
      "riskFactors": ["Tight timeline", "Integration complexity"],
      "opportunities": ["Long-term partnership", "Portfolio expansion"]
    }
  },
  "timestamp": "2024-01-25T10:30:00Z"
}
```

### Search RFPs
```http
POST /api/rfp
Content-Type: application/json

{
  "action": "search",
  "query": "mobile app development",
  "filters": {
    "category": "Technology",
    "maxValue": 5000000
  }
}
```

### Process RFP
```http
POST /api/rfp
Content-Type: application/json

{
  "action": "process",
  "rfpId": "rfp-001",
  "action": "assign"
}
```

## 🔗 LinkedIn Intelligence APIs

### Search Profiles
```http
GET /api/linkedin?action=search&query=Premier%20League&limit=10
```

### Company Search
```http
GET /api/linkedin?action=company-search&company=Arsenal%20FC&limit=5
```

**Response:**
```json
{
  "company": "Arsenal FC",
  "results": {
    "profiles": [
      {
        "id": "arsenal-fc-ceo",
        "name": "Arsenal FC CEO",
        "headline": "Chief Executive Officer at Arsenal FC",
        "company": "Arsenal FC",
        "location": "London, UK",
        "connections": "500+",
        "profileUrl": "https://linkedin.com/in/arsenal-fc-ceo",
        "influence": "high",
        "recentActivity": "Posted about digital transformation in sports",
        "relevanceScore": 0.95
      }
    ],
    "total": 3,
    "digitalTransformationOpportunity": "high"
  },
  "timestamp": "2024-01-25T10:30:00Z"
}
```

### Digital Transformation Targets
```http
GET /api/linkedin?action=digital-transformation-targets
```

### Enhanced Profile Search
```http
POST /api/linkedin
Content-Type: application/json

{
  "action": "enhanced-search",
  "query": "Chief Digital Officer Premier League",
  "useEnhanced": true,
  "limit": 20
}
```

### Profile Analysis
```http
POST /api/linkedin
Content-Type: application/json

{
  "action": "analyze-profile",
  "profileUrl": "https://linkedin.com/in/john-smith-cdo"
}
```

**Response:**
```json
{
  "profileUrl": "https://linkedin.com/in/john-smith-cdo",
  "analysis": {
    "influence": {
      "score": 85,
      "factors": ["High connection count", "Regular posting", "Industry recognition"]
    },
    "interests": ["Digital transformation", "Sports technology", "Fan engagement"],
    "recentActivity": [
      "Posted about mobile app development",
      "Shared article on sports analytics",
      "Commented on digital transformation post"
    ],
    "connectionRecommendation": {
      "priority": "high",
      "approach": "Comment on recent post about digital transformation",
      "timing": "Next 48 hours",
      "customMessage": "Great insights on digital transformation in sports!"
    },
    "digitalTransformationSignals": [
      "Recently posted about mobile apps",
      "Mentioned digital strategy in bio",
      "Connected with tech vendors"
    ]
  },
  "timestamp": "2024-01-25T10:30:00Z"
}
```

### Company Monitoring Setup
```http
POST /api/linkedin
Content-Type: application/json

{
  "action": "monitor-company",
  "companyId": "arsenal-fc",
  "monitoringType": "digital-transformation"
}
```

## 🕸️ Knowledge Graph APIs

### Graph Status
```http
GET /api/knowledge-graph?action=status
```

**Response:**
```json
{
  "status": "operational",
  "graphStatus": {
    "nodes": {
      "byLabel": [
        { "label": "Organization", "count": 50 },
        { "label": "Club", "count": 25 },
        { "label": "Person", "count": 150 },
        { "label": "Contact", "count": 150 },
        { "label": "Sport", "count": 6 }
      ],
      "orphaned": []
    },
    "relationships": {
      "byType": [
        { "type": "WORKS_FOR", "count": 120 },
        { "type": "MEMBER_OF", "count": 25 },
        { "type": "GOVERNS", "count": 10 }
      ]
    },
    "summary": "Graph contains 231 nodes and 155 relationships. System is healthy."
  },
  "timestamp": "2024-01-25T10:30:00Z"
}
```

### Search Graph
```http
GET /api/knowledge-graph?action=search&query=Arsenal%20FC&entityType=club
```

### Get Entity Insights
```http
GET /api/knowledge-graph?action=insights&entityType=club&entityId=arsenal-fc
```

### Get Relationships
```http
GET /api/knowledge-graph?action=relationships&entityId=john-smith-cdo
```

### Initialize Graph
```http
POST /api/knowledge-graph
Content-Type: application/json

{
  "action": "initialize"
}
```

### Add Contacts
```http
POST /api/knowledge-graph
Content-Type: application/json

{
  "action": "add-contacts",
  "contacts": [
    {
      "name": "John Smith",
      "role": "Chief Digital Officer",
      "company": "Arsenal FC",
      "email": "j.smith@arsenal.com",
      "influence": "High"
    }
  ]
}
```

### Create Opportunity
```http
POST /api/knowledge-graph
Content-Type: application/json

{
  "action": "create-opportunity",
  "title": "Arsenal Mobile App Development",
  "organization": "Arsenal FC",
  "value": 2500000,
  "type": "mobile-app"
}
```

### Execute Cypher Query
```http
POST /api/knowledge-graph
Content-Type: application/json

{
  "action": "query",
  "cypherQuery": "MATCH (c:Club)-[:MEMBER_OF]->(o:Organization) RETURN c.name, o.name LIMIT 10"
}
```

## 🔄 Real-time APIs

### Event Stream
```http
GET /api/realtime/events
Accept: text/event-stream
```

**Server-Sent Events Format:**
```
data: {"id":"update-1234","type":"notification","data":{"title":"New RFP Alert","message":"High-value opportunity detected"},"timestamp":"2024-01-25T10:30:00Z","priority":"high"}

data: {"id":"signal-5678","type":"update","data":{"title":"LinkedIn Signal","message":"Arsenal FC posts new Digital Innovation job"},"timestamp":"2024-01-25T10:31:00Z","priority":"medium"}
```

## ❌ Error Handling

### Standard Error Response
```json
{
  "success": false,
  "error": "Error message here",
  "code": "ERROR_CODE",
  "timestamp": "2024-01-25T10:30:00Z"
}
```

### Common Error Codes

| Code | Status | Description |
|------|--------|-------------|
| `INVALID_REQUEST` | 400 | Malformed request body or parameters |
| `UNAUTHORIZED` | 401 | Authentication required |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `VALIDATION_ERROR` | 422 | Input validation failed |
| `RATE_LIMITED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Server error |
| `SERVICE_UNAVAILABLE` | 503 | External service unavailable |

## 🚦 Rate Limiting

- **Default**: 100 requests per 15 minutes per IP
- **Authenticated**: 1000 requests per 15 minutes per user
- **Real-time**: No limit on EventSource connections
- **Bulk operations**: 10 requests per minute for bulk endpoints

### Rate Limit Headers
```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1642781400
```

## 📝 Examples

### Complete Workflow Example

```javascript
// 1. Authenticate
const authResponse = await fetch('/api/auth', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    username: 'admin',
    password: 'yellowpanther2024'
  })
});

// 2. Search for RFPs
const rfpResponse = await fetch('/api/rfp?category=Mobile%20App&minScore=0.8');
const rfps = await rfpResponse.json();

// 3. Analyze top RFP
const analysisResponse = await fetch('/api/rfp', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    action: 'analyze',
    url: rfps.rfps[0].sourceUrl,
    title: rfps.rfps[0].title
  })
});

// 4. Search for relevant contacts
const linkedinResponse = await fetch(`/api/linkedin?action=company-search&company=${rfps.rfps[0].organization}`);
const contacts = await linkedinResponse.json();

// 5. Add contacts to knowledge graph
const graphResponse = await fetch('/api/knowledge-graph', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    action: 'add-contacts',
    contacts: contacts.results.profiles.slice(0, 3)
  })
});
```

---

**📖 Need more help?** Check out the [main documentation](../README.md) or [open an issue](https://github.com/your-org/yellow-panther-ai/issues).