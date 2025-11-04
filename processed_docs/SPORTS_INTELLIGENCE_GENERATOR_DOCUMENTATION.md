# Sports Intelligence Generator Documentation

## 🎯 **Overview**

The Sports Intelligence Generator is a powerful tool that allows users to automatically generate intelligence pages for any sport by selecting from seed data and adding the information to the Neo4j knowledge graph. This feature enables rapid scaling of sports intelligence across multiple sports and divisions.

## 🚀 **Features**

### **1. Seed Data Integration**
- **Source**: Reads from `scraping_data/sportsWorldSeed.json` and `scraping_data/international_federations_seed.json`
- **Sports Coverage**: Tier 1, 2, and 3 sports leagues and international federations
- **Data Types**: Leagues and federations with priority scores and estimated values

### **2. Automatic Page Generation**
- **Data Files**: Creates `src/lib/[sport][division]IntelligenceData.ts`
- **Page Files**: Creates `src/app/[sport]-[division]-intel/linkedin-overview/page.tsx`
- **Templates**: Uses standardized intelligence page templates
- **Interfaces**: Generates TypeScript interfaces for type safety

### **3. Neo4j Knowledge Graph Integration**
- **Sport Nodes**: Creates sport entities with metadata
- **Intelligence Relationships**: Links sports to intelligence data
- **Digital Maturity**: Tracks digital transformation opportunities
- **Graph Structure**: Maintains relationships for analytics

### **4. UI Components**
- **Sport Selection**: Interactive grid of available sports
- **Filtering**: Search by name, filter by tier and type
- **Generation Panel**: Simple form for sport and division selection
- **Progress Tracking**: Real-time generation status

## 📊 **Data Sources**

### **Sports World Seed Data**
```json
{
  "tier_1": [
    {
      "name": "Australian Football League (AFL)",
      "description": "AFL Live Pass (WatchAFL internationally), advanced fan data analytics...",
      "digitalWeakness": "Limited mobile engagement",
      "opportunityType": "Mobile App Enhancement"
    }
  ],
  "tier_2": [...],
  "tier_3": [...]
}
```

### **International Federations Seed Data**
```json
{
  "international_federations": [
    {
      "name": "World Aquatics",
      "sport": "Swimming/Diving/Water Polo",
      "website": "worldaquatics.com",
      "mobileApp": true,
      "digitalWeakness": "Site shows legacy design; app unclear or limited",
      "opportunityType": "Website (potential app audit)",
      "tier": "tier_2",
      "priorityScore": 7.5,
      "estimatedValue": "£500K-£1M"
    }
  ]
}
```

## 🔧 **API Endpoints**

### **1. Get Available Sports**
```typescript
POST /api/admin/sports-intelligence-generator
{
  "action": "get_available_sports"
}

Response:
{
  "success": true,
  "sports": [
    {
      "name": "Australian Football League (AFL)",
      "description": "...",
      "tier": "tier_1",
      "source": "sportsWorldSeed",
      "type": "league"
    }
  ],
  "total": 150
}
```

### **2. Generate Intelligence Page**
```typescript
POST /api/admin/sports-intelligence-generator
{
  "action": "generate_intelligence_page",
  "sport": "Australian Football League (AFL)",
  "division": "Premier Division",
  "selectedData": {
    "name": "Australian Football League (AFL)",
    "description": "...",
    "tier": "tier_1",
    "priorityScore": 8.5,
    "estimatedValue": "£1M-£2M"
  }
}
```

### **3. Add to Knowledge Graph**
```typescript
POST /api/admin/sports-intelligence-generator
{
  "action": "add_to_knowledge_graph",
  "sport": "Australian Football League (AFL)",
  "division": "Premier Division",
  "selectedData": {...}
}
```

### **4. Create Complete Sport Intelligence**
```typescript
POST /api/admin/sports-intelligence-generator
{
  "action": "create_sport_intelligence",
  "sport": "Australian Football League (AFL)",
  "division": "Premier Division",
  "selectedData": {...}
}
```

## 📁 **Generated File Structure**

### **Data File Example**
```typescript
// src/lib/australianFootballLeaguePremierDivisionIntelligenceData.ts
export interface AustralianFootballLeaguePremierDivisionClub {
  clubName: string;
  website: string;
  linkedinUrl: string;
  totalMembers: number;
  digitalMaturity: number;
  opportunityScore: number;
  keyContacts: LinkedInContact[];
  websiteStatus: 'VERIFIED' | 'ACCESSIBLE' | 'INACCESSIBLE';
  linkedinStatus: 'VERIFIED' | 'ACCESSIBLE' | 'INACCESSIBLE';
  insights: ClubInsights;
  division: string;
  league: string;
}

export const AUSTRALIAN_FOOTBALL_LEAGUE_PREMIER_DIVISION_INTELLIGENCE_DATA: Record<string, AustralianFootballLeaguePremierDivisionClub> = {
  // Generated club data
};

// Helper functions
export function getOpportunityLevel(score: number): 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
export function getOpportunityColor(level: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'): string
export function getTotalStats()
```

### **Page File Example**
```typescript
// src/app/australian-football-league-premier-division-intel/linkedin-overview/page.tsx
export default function AustralianFootballLeaguePremierDivisionLinkedInOverview() {
  // Standard intelligence page component
  // Includes statistics, club cards, contact management
  // MCP integration and LinkedIn verification
}
```

## 🗄️ **Neo4j Knowledge Graph Structure**

### **Nodes Created**
```cypher
// Sport Node
CREATE (s:Sport {
  name: "Australian Football League (AFL)",
  division: "Premier Division",
  description: "AFL Live Pass (WatchAFL internationally)...",
  tier: "tier_1",
  priorityScore: 8.5,
  estimatedValue: "£1M-£2M",
  generatedAt: "2024-01-15T10:30:00Z"
})

// Intelligence Node
CREATE (i:Intelligence {
  type: "sports_intelligence",
  sport: "Australian Football League (AFL)",
  division: "Premier Division",
  status: "generated",
  generatedAt: "2024-01-15T10:30:00Z"
})

// Digital Maturity Node
CREATE (d:DigitalMaturity {
  sport: "Australian Football League (AFL)",
  assessment: "initial",
  score: 8.5,
  weaknesses: "Limited mobile engagement",
  opportunities: "£1M-£2M",
  assessedAt: "2024-01-15T10:30:00Z"
})
```

### **Relationships Created**
```cypher
// Sport has Intelligence
MATCH (s:Sport {name: "Australian Football League (AFL)"})
MATCH (i:Intelligence {type: "sports_intelligence"})
CREATE (s)-[:HAS_INTELLIGENCE]->(i)

// Sport has Digital Maturity
MATCH (s:Sport {name: "Australian Football League (AFL)"})
MATCH (d:DigitalMaturity {sport: "Australian Football League (AFL)"})
CREATE (s)-[:HAS_DIGITAL_MATURITY]->(d)
```

## 🎨 **UI Components**

### **Sports Intelligence Generator Page**
- **URL**: `/sports-intelligence-generator`
- **Features**:
  - Interactive sport selection grid
  - Search and filtering capabilities
  - Generation panel with form
  - Real-time progress tracking
  - Success/error notifications

### **Generated Intelligence Pages**
- **URL Pattern**: `/[sport]-[division]-intel/linkedin-overview`
- **Features**:
  - Statistics dashboard
  - Club cards with opportunity scores
  - Clickable contact management
  - LinkedIn integration
  - MCP verification indicators

## 📈 **Usage Workflow**

### **1. Access the Generator**
1. Navigate to `/sports-intelligence-generator`
2. View available sports from seed data
3. Use search and filters to find desired sport

### **2. Select Sport and Division**
1. Click on a sport card to select it
2. Enter division name (e.g., "Premier League", "Super League")
3. Review sport details and priority information

### **3. Generate Intelligence**
1. Click "Generate Sport Intelligence" button
2. Monitor progress indicators
3. Review generation results and file paths

### **4. Access Generated Pages**
1. Navigate to generated page URL
2. Review intelligence data and statistics
3. Use contact management features
4. Export data or generate outreach strategies

## 🔍 **Quality Assurance**

### **Generated File Standards**
- ✅ **TypeScript Interfaces**: All generated files include proper TypeScript interfaces
- ✅ **Helper Functions**: Standard helper functions for opportunity scoring and statistics
- ✅ **MCP Integration**: Bright Data MCP verification indicators
- ✅ **LinkedIn Integration**: Clickable contact cards with profile URLs
- ✅ **Responsive Design**: Mobile-friendly layouts

### **Knowledge Graph Standards**
- ✅ **Node Consistency**: Standardized node properties across all sports
- ✅ **Relationship Integrity**: Proper relationship types and directions
- ✅ **Metadata Tracking**: Generation timestamps and source information
- ✅ **Scalability**: Graph structure supports unlimited sports

## 🚀 **Scaling Benefits**

### **1. Rapid Deployment**
- **Time Savings**: Generate complete intelligence pages in seconds
- **Consistency**: Standardized templates ensure quality
- **Automation**: No manual coding required

### **2. Data Integration**
- **Seed Data**: Leverages existing comprehensive sports database
- **Knowledge Graph**: Automatic Neo4j integration for analytics
- **MCP Verification**: Bright Data integration for real-time verification

### **3. Quality Standards**
- **Type Safety**: Generated TypeScript interfaces
- **UI Consistency**: Standardized page layouts
- **Contact Management**: Verified LinkedIn profile integration

## 📚 **Related Documentation**

### **Standards and Templates**
- **`INTELLIGENCE_PAGES_STANDARDS_GUIDE.md`** - Complete implementation standards
- **`docs/intelligence-verification/`** - LinkedIn verification procedures

### **Implementation Examples**
- **Rugby League**: `src/lib/rugbyLeagueIntelligenceData.ts` - Manual implementation
- **Premier League**: `src/lib/premierLeagueIntelligenceData.ts` - Manual implementation
- **Generated Sports**: Auto-generated files following same standards

### **API Integration**
- **Bright Data MCP**: Real-time web data verification
- **Neo4j Database**: Knowledge graph storage and analytics
- **Next.js Framework**: React-based page generation

The Sports Intelligence Generator enables rapid scaling of sports intelligence across multiple sports and divisions while maintaining high quality standards and comprehensive data integration. 