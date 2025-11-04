# A2A RFP Discovery System - User Guide

## 🌐 Access the System

### Main Web Interface
1. **URL**: http://localhost:3005/a2a-rfp-discovery
2. **Navigation**: Look in the left sidebar for "A2A RFP Discovery" with AI badge
3. **Direct Access**: Click the Radar icon in the navigation

### What You'll See

#### 📊 Dashboard Overview
- **System Status**: Shows if agents are running/idle
- **Agent Status**: 4 specialized AI agents with their capabilities
- **Live Statistics**: RFPs discovered, processing cards created
- **Control Panel**: Start/stop discovery, generate demo data

#### 🎯 Discovered RFPs Tab
- **RFP Cards**: Visual cards showing each opportunity
- **Entity Information**: Which sports entity (club, league, etc.)
- **Fit Scores**: Percentage match and priority levels
- **Details**: Value estimates, deadlines, keywords
- **Evidence Links**: Source URLs and confidence scores

#### 📇 Processing Cards Tab
- **Workflow Management**: Cards showing RFP processing status
- **Status Tracking**: Discovered → Analyzing → Qualified/Rejected
- **Next Steps**: Action items for each opportunity
- **Assignment**: Can assign to team members

## 🎮 How to Use the System

### Step 1: Start the Discovery
1. Go to the dashboard
2. Click **"Start Discovery"** button
3. Agents will begin scanning entities automatically

### Step 2: Generate Demo Data (if needed)
1. Click **"Generate Demo Data"** 
2. Creates sample RFPs from your cached entities
3. Shows immediate results for testing

### Step 3: Review Discovered Opportunities
1. Browse **Discovered RFPs** tab
2. Click on any RFP card to expand details
3. Review fit scores, entity info, and evidence links

### Step 4: Process Opportunities
1. Go to **Processing Cards** tab
2. Click **"Analyze"** to run AI analysis
3. **"Qualify"** or **"Reject"** opportunities
4. **"Assign"** to team members if qualified

### Step 5: Monitor Agent Activity
1. **Overview** tab shows real-time agent status
2. Monitor processing time and success rates
3. View entity counts and opportunity discovery

## 🔗 API Access

### Get System Status
```bash
curl "http://localhost:3005/api/a2a-rfp-discovery?action=status"
```

### Get Discovered RFPs
```bash
curl "http://localhost:3005/api/a2a-rfp-discovery?action=rfps&limit=10"
```

### Get Processing Cards
```bash
curl "http://localhost:3005/api/a2a-rfp-discovery?action=cards&limit=5"
```

### Generate Demo Data
```bash
curl "http://localhost:3005/api/a2a-rfp-discovery?action=demo"
```

## 🤖 Agent Capabilities

### 1. LinkedIn Opportunity Scanner
- **Purpose**: Scans LinkedIn for job postings and procurement signals
- **Capabilities**: LinkedIn search, job posting analysis, company monitoring
- **Data Sources**: LinkedIn job postings, company updates

### 2. Neo4j Relationship Analyzer  
- **Purpose**: Analyzes entity relationships in your knowledge graph
- **Capabilities**: Relationship mapping, entity analysis, pattern recognition
- **Data Sources**: Neo4j database with entity relationships

### 3. Entity Pattern Matcher
- **Purpose**: Matches patterns in entity data to identify opportunities
- **Capabilities**: Pattern matching, similarity scoring, prediction
- **Data Sources**: Supabase cached_entities with enrichment data

### 4. Opportunity Generator
- **Purpose**: Creates structured RFP opportunities from findings
- **Capabilities**: Opportunity creation, value estimation, priority scoring
- **Data Sources**: All agent outputs combined

## 📊 Real Data Examples

### Current Working Results
The system has discovered real opportunities from your sports entities:

**1. FC Köln** - Digital Transformation (£250K-£500K)
**1. FC Nürnberg** - Digital Transformation (£250K-£500K)  
**2. Bundesliga** - Strategic Partnership (£100K-£300K annually)

Each opportunity includes:
- ✅ Real entity data from your database
- ✅ Fit scoring and priority levels
- ✅ Value estimates and timelines
- ✅ Evidence links and sources
- ✅ Processing workflow cards

## 🔄 Workflow Integration

### From Discovery to Action
1. **Discovery**: Agents find opportunities automatically
2. **Analysis**: AI scoring and feasibility assessment  
3. **Qualification**: Human review and decision making
4. **Assignment**: Team assignment for follow-up
5. **Tracking**: Status updates and progress monitoring

### Integration with Existing Systems
- **Neo4j Database**: Uses your existing entity relationships
- **Supabase Cache**: Leverages cached_entities table
- **Navigation**: Integrated into main app navigation
- **UI/UX**: Matches your Football Manager theme